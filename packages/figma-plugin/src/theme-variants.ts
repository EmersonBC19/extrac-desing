/**
 * Breakpoints y claro/oscuro en Figma (Función A de la propuesta).
 *
 * El payload trae el bloque a varios anchos (`responsive.variants`) y, opcionalmente, cada uno en tema
 * oscuro (`dark`). Aquí:
 *  - cada ancho es un componente `Breakpoint=Mobile|Tablet|Desktop` y se unen en un set de variantes;
 *  - los colores que cambian entre temas pasan a Variables de una colección "Tema · …" con modos Light y
 *    Dark, enlazadas a rellenos, bordes y textos. Las dos extracciones salen del mismo DOM, así que se
 *    emparejan nodo a nodo: no hay que adivinar qué gris oscuro corresponde a qué blanco;
 *  - al lado, una vista del bloque con el modo Dark activado.
 */
import type { Logger, PluginSandboxMessage } from '@code-to-figma/contracts';
import type { UINode } from './types';
import { buildFigmaNode, setColorBinder } from './render';
import { newCollection, safeVarName, variablesAvailable } from './board/variables';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const isSolid = (f: any) => !!f && (!f.type || f.type === 'SOLID') && typeof f.r === 'number';
const rgba = (f: any): RGBA => ({ r: f.r, g: f.g, b: f.b, a: f.a !== undefined ? f.a : 1 });
const sameColor = (x: RGBA, y: RGBA) =>
  Math.abs(x.r - y.r) < 0.004 &&
  Math.abs(x.g - y.g) < 0.004 &&
  Math.abs(x.b - y.b) < 0.004 &&
  Math.abs(x.a - y.a) < 0.01;
const hex = (c: RGBA) =>
  [c.r, c.g, c.b]
    .map(x =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('') + (c.a < 0.995 ? `-${Math.round(c.a * 100)}` : '');

/**
 * Empareja nodo a nodo dos extracciones del mismo bloque en otro tema. Mismo DOM → misma estructura;
 * si un tema tiene algo que el otro no (un icono que solo aparece en oscuro), se empareja por nombre y
 * tipo en orden, y lo que no casa se queda sin pareja (conserva su color fijo).
 */
export function pairTrees(light: any, dark: any, out: Map<any, any> = new Map()): Map<any, any> {
  if (!light || !dark || light.type !== dark.type) return out;
  out.set(light, dark);
  const lc: any[] = light.children || [];
  const dc: any[] = dark.children || [];
  if (lc.length === dc.length) {
    lc.forEach((c, i) => pairTrees(c, dc[i], out));
    return out;
  }
  let j = 0;
  for (const c of lc) {
    while (j < dc.length && (dc[j].type !== c.type || dc[j].name !== c.name)) j++;
    if (j >= dc.length) break;
    pairTrees(c, dc[j++], out);
  }
  return out;
}

type Role = 'fondo' | 'texto' | 'borde';
const ROLE_SCOPES: Record<Role, VariableScope[]> = {
  fondo: ['FRAME_FILL', 'SHAPE_FILL'],
  texto: ['TEXT_FILL'],
  borde: ['STROKE_COLOR'],
};

/** Variables de la colección del tema: una por pareja de colores (claro, oscuro) y uso */
class ThemeVariables {
  private vars = new Map<string, { variable: Variable; sameAlpha: boolean }>();
  constructor(
    readonly collection: VariableCollection,
    readonly lightId: string,
    readonly darkId: string | null,
  ) {}

  get size() {
    return this.vars.size;
  }

  get(role: Role, light: RGBA, dark: RGBA) {
    const key = `${role}|${hex(light)}|${hex(dark)}`;
    const hit = this.vars.get(key);
    if (hit) return hit;
    // Misma transparencia en los dos temas: queda en el relleno; si cambia, viaja en la variable
    const sameAlpha = Math.abs(light.a - dark.a) < 0.01;
    const value = (c: RGBA) => ({ r: c.r, g: c.g, b: c.b, a: sameAlpha ? 1 : c.a });
    const variable = figma.variables.createVariable(
      safeVarName(`${role}/${hex(light)} · ${hex(dark)}`),
      this.collection,
      'COLOR',
    );
    variable.setValueForMode(this.lightId, value(light));
    if (this.darkId) variable.setValueForMode(this.darkId, value(dark));
    try {
      variable.scopes = ROLE_SCOPES[role];
    } catch (_e) {}
    const entry = { variable, sameAlpha };
    this.vars.set(key, entry);
    return entry;
  }
}

/**
 * Enlaza los colores sólidos de un nodo recién creado: cada relleno/borde cuyo color cambia entre
 * el nodo claro y su pareja oscura pasa a una Variable.
 */
function makeBinder(pairs: Map<any, any>, theme: ThemeVariables) {
  const bind = (paints: readonly Paint[], lightList: any[] | undefined, darkList: any[] | undefined, role: Role) => {
    const ls = (lightList || []).filter(isSolid);
    const ds = (darkList || []).filter(isSolid);
    if (!ls.length || ls.length !== ds.length) return null;
    const out = paints.slice();
    let k = 0;
    let changed = false;
    for (let i = 0; i < out.length && k < ls.length; i++) {
      const p = out[i];
      if (p.type !== 'SOLID') continue;
      const l = rgba(ls[k]);
      const d = rgba(ds[k]);
      k++;
      if (sameColor(l, d)) continue;
      const { variable, sameAlpha } = theme.get(role, l, d);
      const base = { ...(p as SolidPaint), opacity: sameAlpha ? l.a : 1 };
      out[i] = figma.variables.setBoundVariableForPaint(base, 'color', variable);
      changed = true;
    }
    return changed ? out : null;
  };
  return (node: SceneNode, data: UINode) => {
    const dark = pairs.get(data);
    if (!dark) return;
    const n = node as any;
    if (Array.isArray(n.fills) && n.fills.length) {
      const r = bind(
        n.fills,
        data.styles?.fills as any[],
        dark.styles?.fills,
        node.type === 'TEXT' ? 'texto' : 'fondo',
      );
      if (r) n.fills = r;
    }
    if (Array.isArray(n.strokes) && n.strokes.length) {
      const r = bind(
        n.strokes,
        (data.styles?.strokes as any[])?.slice(0, 1),
        dark.styles?.strokes?.slice(0, 1),
        'borde',
      );
      if (r) n.strokes = r;
    }
  };
}

export interface ResponsiveBuild {
  root: SceneNode;
  /** Tras colocar el set en el lienzo: la vista Dark a su lado. Devuelve las capas añadidas */
  afterPlace: () => SceneNode[];
}

/**
 * Dibuja las variantes del payload. null si no hay variantes o no se pudo (quien llama dibuja el
 * bloque normal).
 */
export async function buildResponsiveVariants(
  payload: any,
  log: Logger,
  post: (m: PluginSandboxMessage) => void,
): Promise<ResponsiveBuild | null> {
  const variants: any[] = Array.isArray(payload?.responsive?.variants) ? payload.responsive.variants : [];
  if (!variants.length) return null;
  const baseName = String(payload.rootNode?.name || variants[0].rootNode?.name || 'Componente');
  const multi = variants.length > 1;
  if (multi && typeof (figma as any).combineAsVariants !== 'function') return null;

  // Tema: colección con modos Light y Dark
  let theme: ThemeVariables | null = null;
  const warnings: string[] = [];
  if (variants.some(v => v.dark)) {
    if (!variablesAvailable()) {
      warnings.push('Este archivo no admite Variables: el bloque llega solo con el tema claro');
    } else {
      const { collection, modeId } = await newCollection(`Tema · ${baseName}`.slice(0, 80));
      try {
        collection.renameMode(modeId, 'Light');
      } catch (_e) {}
      let darkId: string | null = null;
      try {
        darkId = collection.addMode('Dark');
      } catch (_e) {
        warnings.push(
          'Tu plan de Figma no permite varios modos por colección: las Variables quedan solo con el tema claro',
        );
      }
      theme = new ThemeVariables(collection, modeId, darkId);
    }
  }
  const pairs = new Map<any, any>();
  if (theme) for (const v of variants) if (v.dark) pairTrees(v.rootNode, v.dark, pairs);

  const built: SceneNode[] = [];
  setColorBinder(theme ? makeBinder(pairs, theme) : null);
  try {
    for (const v of variants) {
      const data: any = { ...v.rootNode, layout: { ...v.rootNode.layout, positioning: 'AUTO', x: 0, y: 0 } };
      if (multi) {
        data.type = 'COMPONENT';
        data.name = `Breakpoint=${String(v.name).replace(/[=,]/g, ' ').trim() || v.width}`;
      }
      if (pairs.has(v.rootNode)) pairs.set(data, pairs.get(v.rootNode));
      const node = await buildFigmaNode(data);
      if (!node) throw new Error(`la variante ${v.name} no se pudo dibujar`);
      built.push(node);
    }
  } catch (err: any) {
    setColorBinder(null);
    log.warn('No se pudieron dibujar los breakpoints', { error: String(err?.message || err) });
    for (const n of built) {
      try {
        n.remove();
      } catch (_e) {}
    }
    return null;
  }
  setColorBinder(null);

  let root: SceneNode = built[0];
  if (multi) {
    try {
      const set = figma.combineAsVariants(built as ComponentNode[], figma.currentPage);
      set.name = baseName;
      set.layoutMode = 'HORIZONTAL';
      set.primaryAxisSizingMode = 'AUTO';
      set.counterAxisSizingMode = 'AUTO';
      set.counterAxisAlignItems = 'MIN';
      set.itemSpacing = 80;
      set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 40;
      root = set;
    } catch (err: any) {
      log.warn('No se pudieron unir los breakpoints como variantes', { error: String(err?.message || err) });
      for (const n of built) {
        try {
          n.remove();
        } catch (_e) {}
      }
      return null;
    }
  }

  for (const w of warnings) post({ type: 'LOG', level: 'warn', message: w });
  post({
    type: 'LOG',
    level: 'success',
    message:
      (multi ? `Breakpoints: ${variants.map(v => `${v.name} ${v.width}px`).join(' · ')}` : `"${baseName}"`) +
      (theme && theme.darkId ? ` · ${theme.size} colores como Variables con modos Light y Dark` : ''),
  });

  const afterPlace = (): SceneNode[] => {
    if (!theme || !theme.darkId || !theme.size) return [];
    try {
      // La variante más ancha, en modo Dark, al lado del set
      const source = built[built.length - 1];
      const preview =
        source.type === 'COMPONENT' ? (source as ComponentNode).createInstance() : (source as FrameNode).clone();
      preview.name = `${baseName} · Dark`;
      (preview as any).setExplicitVariableModeForCollection(theme.collection, theme.darkId);
      const parent = (root.parent as BaseNode & ChildrenMixin) || figma.currentPage;
      parent.appendChild(preview);
      preview.x = Math.round(root.x + root.width + 120);
      preview.y = Math.round(root.y);
      return [preview];
    } catch (err: any) {
      log.warn('No se pudo crear la vista Dark', { error: String(err?.message || err) });
      return [];
    }
  };
  return { root, afterPlace };
}
