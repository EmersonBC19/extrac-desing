/**
 * Variables de Figma (plan de mejoras, fase 6.2): colores, espaciados y radios del diseño extraído
 * como Variables nativas, vinculadas a las capas. Antes solo se creaban Paint Styles.
 * Si la API no está disponible (archivo o plan sin Variables) quien llama usa Paint Styles.
 */

export function variablesAvailable(): boolean {
  const v = (figma as any).variables;
  return !!v && typeof v.createVariableCollection === 'function' && typeof v.createVariable === 'function';
}

/** Figma no admite ciertos caracteres en nombres de variable ('.', '$', '{', '}') */
export function safeVarName(name: string): string {
  return name.replace(/\./g, ',').replace(/[${}]/g, '').trim() || 'Variable';
}

/** Colección nueva con nombre único en el archivo (cada tablero crea la suya) */
export async function newCollection(base: string): Promise<{ collection: VariableCollection; modeId: string }> {
  let existing: string[] = [];
  try {
    const cols =
      typeof (figma.variables as any).getLocalVariableCollectionsAsync === 'function'
        ? await (figma.variables as any).getLocalVariableCollectionsAsync()
        : figma.variables.getLocalVariableCollections?.() || [];
    existing = cols.map((c: any) => c.name);
  } catch (_e) {}
  let name = base;
  for (let i = 2; existing.includes(name); i++) name = `${base} ${i}`;
  const collection = figma.variables.createVariableCollection(name);
  return { collection, modeId: collection.modes[0].modeId };
}

export interface CollectionHandle {
  collection: VariableCollection;
  modeId: string;
  byName: Map<string, Variable>;
}

/** Reutiliza la colección existente del sitio (o crea una nueva) para actualizar tokens sin duplicar */
export async function upsertCollection(base: string): Promise<CollectionHandle> {
  let cols: any[] = [];
  try {
    cols =
      typeof (figma.variables as any).getLocalVariableCollectionsAsync === 'function'
        ? await (figma.variables as any).getLocalVariableCollectionsAsync()
        : figma.variables.getLocalVariableCollections?.() || [];
  } catch (_e) {}
  let collection = cols.find((c: any) => c.name === base);
  if (!collection) collection = figma.variables.createVariableCollection(base);
  const modeId = collection.modes[0].modeId;
  const byName = new Map<string, Variable>();
  try {
    const allVars =
      typeof (figma.variables as any).getLocalVariablesAsync === 'function'
        ? await (figma.variables as any).getLocalVariablesAsync()
        : figma.variables.getLocalVariables?.() || [];
    for (const v of allVars) {
      if (v.variableCollectionId === collection.id) byName.set(v.name, v);
    }
  } catch (_e) {}
  return { collection, modeId, byName };
}

export function colorVariable(collection: VariableCollection, modeId: string, name: string, rgb: RGB): Variable {
  const v = figma.variables.createVariable(safeVarName(name), collection, 'COLOR');
  v.setValueForMode(modeId, { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 });
  try {
    v.scopes = ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'];
  } catch (_e) {}
  return v;
}

export function upsertColorVariable(ctx: CollectionHandle, name: string, rgb: RGB): Variable {
  const safe = safeVarName(name);
  const existing = ctx.byName.get(safe);
  if (existing && existing.resolvedType === 'COLOR') {
    existing.setValueForMode(ctx.modeId, { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 });
    return existing;
  }
  const v = colorVariable(ctx.collection, ctx.modeId, existing ? `${safe} Color` : safe, rgb);
  ctx.byName.set(v.name, v);
  return v;
}

export function numberVariable(
  collection: VariableCollection,
  modeId: string,
  name: string,
  value: number,
  scopes: VariableScope[],
): Variable {
  const v = figma.variables.createVariable(safeVarName(name), collection, 'FLOAT');
  v.setValueForMode(modeId, value);
  try {
    v.scopes = scopes;
  } catch (_e) {}
  return v;
}

export function upsertNumberVariable(
  ctx: CollectionHandle,
  name: string,
  value: number,
  scopes: VariableScope[],
): Variable {
  const safe = safeVarName(name);
  const existing = ctx.byName.get(safe);
  if (existing && existing.resolvedType === 'FLOAT') {
    existing.setValueForMode(ctx.modeId, value);
    return existing;
  }
  const v = numberVariable(ctx.collection, ctx.modeId, existing ? `${safe} Float` : safe, value, scopes);
  ctx.byName.set(v.name, v);
  return v;
}

/** Relleno sólido vinculado a una variable de color (la opacidad queda en el relleno) */
export function boundSolidPaint(paint: SolidPaint, variable: Variable): SolidPaint {
  return figma.variables.setBoundVariableForPaint(paint, 'color', variable);
}

// ── Espaciados y radios ──────────────────────────────────────────────────────────────────────

export const SPACING_FIELDS = ['itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
export const RADIUS_FIELDS = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const;

export interface NumericUse {
  node: SceneNode;
  field: string;
}

/**
 * Valores numéricos repetidos (gaps/paddings con Auto Layout, radios) → mapa valor → usos.
 * Solo valores > 0 usados al menos `minUses` veces: un valor suelto no es un token.
 */
export function collectNumericTokens(nodes: SceneNode[], minUses = 2) {
  const spacing = new Map<number, NumericUse[]>();
  const radius = new Map<number, NumericUse[]>();
  const add = (map: Map<number, NumericUse[]>, value: number, use: NumericUse) => {
    const v = Math.round(value * 10) / 10;
    if (!(v > 0)) return;
    if (!map.has(v)) map.set(v, []);
    map.get(v)!.push(use);
  };
  for (const n of nodes) {
    const f = n as any;
    if (f.layoutMode && f.layoutMode !== 'NONE') {
      for (const field of SPACING_FIELDS) {
        if (field === 'itemSpacing' && f.primaryAxisAlignItems === 'SPACE_BETWEEN') continue;
        if (typeof f[field] === 'number') add(spacing, f[field], { node: n, field });
      }
    }
    if ('topLeftRadius' in f) {
      for (const field of RADIUS_FIELDS) if (typeof f[field] === 'number') add(radius, f[field], { node: n, field });
    }
  }
  const keep = (map: Map<number, NumericUse[]>) =>
    [...map.entries()].filter(([, uses]) => uses.length >= minUses).sort((a, b) => a[0] - b[0]);
  return { spacing: keep(spacing), radius: keep(radius) };
}

/**
 * Tokens de color de la web (variables CSS de :root) → colección "Tokens CSS" (fase 6.2).
 * Reenviar la misma web actualiza los valores en lugar de duplicar variables.
 */
export async function cssTokensToVariables(
  colors: Record<string, { r: number; g: number; b: number; a?: number }>,
): Promise<number> {
  const V = figma.variables;
  const collections =
    typeof (V as any).getLocalVariableCollectionsAsync === 'function'
      ? await (V as any).getLocalVariableCollectionsAsync()
      : V.getLocalVariableCollections?.() || [];
  const collection = collections.find((c: any) => c.name === 'Tokens CSS') || V.createVariableCollection('Tokens CSS');
  const modeId = collection.modes[0].modeId;
  const allVars =
    typeof (V as any).getLocalVariablesAsync === 'function'
      ? await (V as any).getLocalVariablesAsync('COLOR')
      : V.getLocalVariables?.('COLOR') || [];
  const existing = allVars.filter((v: any) => v.variableCollectionId === collection.id);
  let count = 0;
  for (const [token, c] of Object.entries(colors)) {
    try {
      const name = safeVarName(token.replace(/^--/, ''));
      const v = existing.find((x: any) => x.name === name) || V.createVariable(name, collection, 'COLOR');
      v.setValueForMode(modeId, { r: c.r, g: c.g, b: c.b, a: c.a !== undefined ? c.a : 1 });
      count++;
    } catch (_e) {}
  }
  return count;
}
