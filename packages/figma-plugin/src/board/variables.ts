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
export function newCollection(base: string): { collection: VariableCollection; modeId: string } {
  let existing: string[] = [];
  try {
    existing = (figma.variables.getLocalVariableCollections?.() || []).map(c => c.name);
  } catch (_e) {}
  let name = base;
  for (let i = 2; existing.includes(name); i++) name = `${base} ${i}`;
  const collection = figma.variables.createVariableCollection(name);
  return { collection, modeId: collection.modes[0].modeId };
}

export function colorVariable(collection: VariableCollection, modeId: string, name: string, rgb: RGB): Variable {
  const v = figma.variables.createVariable(safeVarName(name), collection, 'COLOR');
  v.setValueForMode(modeId, { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 });
  try {
    v.scopes = ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'];
  } catch (_e) {}
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
export function cssTokensToVariables(colors: Record<string, { r: number; g: number; b: number; a?: number }>): number {
  const V = figma.variables;
  const collection =
    (V.getLocalVariableCollections?.() || []).find(c => c.name === 'Tokens CSS') ||
    V.createVariableCollection('Tokens CSS');
  const modeId = collection.modes[0].modeId;
  const existing = (V.getLocalVariables?.('COLOR') || []).filter(v => v.variableCollectionId === collection.id);
  let count = 0;
  for (const [token, c] of Object.entries(colors)) {
    try {
      const name = safeVarName(token.replace(/^--/, ''));
      const v = existing.find(x => x.name === name) || V.createVariable(name, collection, 'COLOR');
      v.setValueForMode(modeId, { r: c.r, g: c.g, b: c.b, a: c.a !== undefined ? c.a : 1 });
      count++;
    } catch (_e) {}
  }
  return count;
}
