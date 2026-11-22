/**
 * Lógica pura del tablero (sin API de Figma): firmas, detección de componentes, nombres. Probada en tests/unit/board.test.ts.
 */
export function boardHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function boardColorKey(f: any): string {
  if (!f) return '-';
  if (f.type && f.type !== 'SOLID') {
    return f.type + '(' + (f.stops || []).map((s: any) => boardColorKey(s.color)).join(',') + ')';
  }
  const c = (v: number) =>
    Math.round((v || 0) * 255)
      .toString(16)
      .padStart(2, '0');
  return '#' + c(f.r) + c(f.g) + c(f.b) + (f.a !== undefined && f.a < 0.995 ? '/' + Math.round(f.a * 100) : '');
}

/**
 * Firma estructural + de estilo de un nodo. Dos bloques con la misma firma se ven igual salvo
 * por su contenido (textos, imágenes) y su ancho → pueden ser instancias del mismo componente.
 */
export function boardSignature(n: any, memo: Map<any, string>): string {
  if (memo.has(n)) return memo.get(n)!;
  let sig: string;
  const L = n.layout || {};
  const S = n.styles || {};
  if (n.type === 'TEXT') {
    const t = n.textData || {};
    sig = ['T', t.fontFamily, t.fontSize, t.fontWeight, t.textAlign, (S.fills || []).map(boardColorKey).join(',')].join(
      '|',
    );
  } else if (n.type === 'SVG') {
    sig = 'S|' + boardHash(n.svgContent || '') + '|' + L.width + 'x' + L.height;
  } else {
    const pad = L.padding || {};
    const style = [
      L.mode,
      L.primaryAxisAlignItems,
      L.counterAxisAlignItems,
      L.itemSpacing,
      [pad.top, pad.right, pad.bottom, pad.left].join(','),
      (S.fills || []).map(boardColorKey).join(','),
      (S.strokes || []).map((s: any) => boardColorKey(s) + '@' + s.width).join(','),
      JSON.stringify(S.cornerRadius ?? 0),
      S.opacity ?? 1,
      (S.boxShadow || []).length,
      n.imageData ? 'IMG:' + (S.imageScaleMode || 'FILL') : '',
    ].join('|');
    const h = Math.round(L.measuredHeight ?? (typeof L.height === 'number' ? L.height : 0));
    sig = 'F|' + style + '|h' + h + '[' + (n.children || []).map((c: any) => boardSignature(c, memo)).join(';') + ']';
  }
  memo.set(n, sig);
  return sig;
}

export function boardCountNodes(n: any): number {
  let c = 1;
  for (const ch of n.children || []) c += boardCountNodes(ch);
  return c;
}

export interface BoardGroup {
  id: string;
  name: string;
  occurrences: any[];
}

/**
 * Nombre legible para un componente a partir del nombre de capa extraído:
 * "Primer_Brand__Text-module__Text___XeGJJ Primer…" → "Text"
 * "Button / Primary (Más información)"               → "Button / Primary"
 * "Media-gallery-item theme-dark current"            → "Media Gallery Item"
 */
export function boardCleanName(raw: string): string {
  let s = String(raw || '')
    .split('(')[0]
    .trim();
  if (s.includes('/')) return s.replace(/\s+/g, ' '); // ya es semántico (Button / Primary)
  if (!/[-_]/.test(s)) return s.replace(/\s+/g, ' ') || 'Componente'; // legible (Input Group)
  s = s.split(/\s+/)[0] || s; // primera clase CSS
  // CSS Modules de postcss-modules (Vite): _local_hash_línea → local (antes: "Head Pgjsj 6")
  const vite = s.match(/^_([A-Za-z][\w-]*?)_[a-z0-9]{5}(?:_\d+)?$/);
  if (vite) s = vite[1];
  // Hash de CSS Modules / styled-components: tiene dígitos o varias mayúsculas internas (XeGJJ, bCyRk, 3A2TYk)
  const isHash = (p: string) =>
    /^[A-Za-z0-9]{4,8}$/.test(p) && (/\d/.test(p) || /[A-Z].*[A-Z]/.test(p.slice(1)) || /^[a-z][A-Z]/.test(p));
  const parts = s
    .split(/__|--/)
    .map(p => p.replace(/^_+|_+$/g, ''))
    .filter(p => p && !isHash(p))
    .filter(p => !/-module$/i.test(p));
  let core = parts.length ? parts[parts.length - 1] : s;
  if (parts.length >= 2 && core.length <= 6) core = parts[parts.length - 2] + ' ' + core;
  core = core.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return core ? core.replace(/\b\w/g, c => c.toUpperCase()) : 'Componente';
}

/**
 * Detecta bloques repetidos (botones, tarjetas, tiles) y los marca con __cg = id de grupo.
 * Solo los bloques MÁS EXTERNOS: si una tarjeta se repite, la tarjeta es el componente,
 * no el botón que lleva dentro. Requiere ≥ 2 apariciones con firma idéntica.
 */
export function boardDetectComponents(root: any): BoardGroup[] {
  const memo = new Map<any, string>();
  boardSignature(root, memo);
  const rootArea = Math.max(1, (root.layout?.measuredWidth || 1) * (root.layout?.measuredHeight || 1));
  const eligible = (n: any) => {
    if (n === root || n.type === 'TEXT' || n.type === 'SVG') return false;
    if (!n.children || n.children.length === 0) return false; // imagen/caja suelta: no es componente
    // Un elemento absoluto (callout de diagrama, overlay, pin de escena) depende de sus
    // coordenadas exactas y no debe empaquetarse como componente compartido en el tablero.
    if (n.layout?.positioning === 'ABSOLUTE') return false;
    // Un elemento con hijos absolutos o dentro de un escenario/visor interactivo tampoco
    if ((n.children || []).some((c: any) => c.layout?.positioning === 'ABSOLUTE')) return false;
    if (/explorer|stage|scene|viewer|canvas/i.test(n.name || '')) return false;
    // Demasiado trivial, salvo una caja con estilo propio + contenido (botón, badge, chip):
    // es el componente más básico de un design system
    const styled = (n.styles?.fills || []).length > 0 || (n.styles?.strokes || []).length > 0;
    if (boardCountNodes(n) < 3 && !styled) return false;
    const area = (n.layout?.measuredWidth || 0) * (n.layout?.measuredHeight || 0);
    return area > 0 && area / rootArea < 0.35; // secciones enteras no
  };
  const counts = new Map<string, number>();
  (function count(n: any) {
    if (eligible(n)) counts.set(memo.get(n)!, (counts.get(memo.get(n)!) || 0) + 1);
    (n.children || []).forEach(count);
  })(root);

  let allowed = new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([s]) => s));
  let assigned = new Map<string, any[]>();
  for (let iter = 0; iter < 4; iter++) {
    assigned = new Map();
    (function pick(n: any) {
      const s = memo.get(n)!;
      if (eligible(n) && allowed.has(s)) {
        if (!assigned.has(s)) assigned.set(s, []);
        assigned.get(s)!.push(n);
        return; // el más externo gana: no descender
      }
      (n.children || []).forEach(pick);
    })(root);
    const next = new Set([...assigned.entries()].filter(([, occ]) => occ.length >= 2).map(([s]) => s));
    if (next.size === allowed.size) break;
    allowed = next;
  }

  const groups: BoardGroup[] = [];
  const usedNames = new Map<string, number>();
  for (const [, occ] of assigned) {
    if (occ.length < 2) continue;
    const base = boardCleanName(occ[0].name);
    const k = (usedNames.get(base) || 0) + 1;
    usedNames.set(base, k);
    const id = 'cg_' + groups.length;
    groups.push({ id, name: k > 1 ? `${base} ${k}` : base, occurrences: occ });
    for (const o of occ) o.__cg = id;
  }
  return groups;
}

/** Nodos de un subárbol en orden DFS (pre-orden), igual que el orden de construcción en Figma */
export function boardCollect(n: any, pred: (x: any) => boolean, out: any[] = []): any[] {
  if (pred(n)) out.push(n);
  for (const c of n.children || []) boardCollect(c, pred, out);
  return out;
}

// ── Variantes (fase 6.1) ─────────────────────────────────────────────────────────────────────

/** Forma de un nodo: tipos y Auto Layout, sin tamaños, colores ni textos */
export function boardShapeSignature(n: any): string {
  if (!n) return '';
  if (n.type === 'TEXT') return 'T';
  if (n.type === 'SVG') return 'S';
  const kids = (n.children || []).map(boardShapeSignature).join(',');
  return `F:${n.layout?.mode || 'NONE'}${n.imageData ? ':img' : ''}[${kids}]`;
}

/** Estilo de un nodo sin tamaños: colores, bordes, radios, sombras (recursivo) */
function boardStyleKey(n: any): string {
  const S = n.styles || {};
  const own = [
    (S.fills || []).map(boardColorKey).join(','),
    (S.strokes || []).map((s: any) => boardColorKey(s) + '@' + s.width).join(','),
    JSON.stringify(S.cornerRadius ?? 0),
    (S.boxShadow || []).length,
    n.type === 'TEXT' ? [n.textData?.fontWeight, (S.fills || []).map(boardColorKey).join(',')].join('|') : '',
  ].join('|');
  return own + '[' + (n.children || []).map(boardStyleKey).join(';') + ']';
}

const areaOf = (n: any) => (n.layout?.measuredWidth || 0) * (n.layout?.measuredHeight || 0);
const SIZE_NAMES: Record<number, string[]> = {
  2: ['L', 'S'],
  3: ['L', 'M', 'S'],
  4: ['XL', 'L', 'M', 'S'],
  5: ['XL', 'L', 'M', 'S', 'XS'],
};

export interface VariantFamily {
  name: string;
  property: 'Size' | 'Style' | 'Variant';
  /** groupId → valor de la propiedad */
  members: { groupId: string; value: string }[];
}

/**
 * Agrupa componentes que son variantes uno de otro: mismo nombre base ("Tile Ctas", "Tile Ctas 2")
 * y misma forma. Si solo cambia el tamaño → Size=L/M/S; si solo el estilo → Style=<color>;
 * si cambian ambos → Variant=1..n.
 */
export function boardVariantFamilies(groups: BoardGroup[]): VariantFamily[] {
  const byKey = new Map<string, BoardGroup[]>();
  for (const g of groups) {
    const base = g.name.replace(/\s+\d+$/, '');
    // NO agrupar contenedores genéricos ni tarjetas como variantes: tarjetas de contenido,
    // bloques de escena o secciones no son variantes de un mismo control UI.
    if (/^(card|container|box|item|stage|explorer|row|col)\b/i.test(base)) continue;
    const key = base + '§' + boardShapeSignature(g.occurrences[0]);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(g);
  }
  const families: VariantFamily[] = [];
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    const name = key.split('§')[0];
    const reps = members.map(g => g.occurrences[0]);
    const sameStyle = new Set(reps.map(boardStyleKey)).size === 1;
    const areas = reps.map(areaOf);
    const sameSize = Math.max(...areas) - Math.min(...areas) <= Math.max(...areas) * 0.05;
    let property: VariantFamily['property'];
    let values: string[];
    if (sameStyle && !sameSize) {
      property = 'Size';
      const order = members.map((_, i) => i).sort((a, b) => areas[b] - areas[a]);
      const names = SIZE_NAMES[members.length] || members.map((_, i) => String(i + 1));
      values = new Array(members.length);
      order.forEach((idx, rank) => (values[idx] = names[rank]));
    } else if (sameSize && !sameStyle) {
      property = 'Style';
      const colors = reps.map(r => boardColorKey((r.styles?.fills || [])[0]));
      const distinct = new Set(colors).size === colors.length && !colors.includes('-');
      values = distinct ? colors : members.map((_, i) => String(i + 1));
    } else {
      property = 'Variant';
      values = members.map((_, i) => String(i + 1));
    }
    families.push({ name, property, members: members.map((g, i) => ({ groupId: g.id, value: values[i] })) });
  }
  return families;
}

// ── Paleta (fase 6.3): colores casi iguales → uno solo ──────────────────────────────────────

/** sRGB (0..1) → CIE Lab (D65) */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x),
    fy = f(y),
    fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Diferencia perceptual (ΔE 1976). ≈ 2,3 es la diferencia mínima que el ojo nota */
export function deltaE(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const [l1, a1, b1] = rgbToLab(a.r, a.g, a.b);
  const [l2, a2, b2] = rgbToLab(b.r, b.g, b.b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export interface PaletteEntry<T> {
  color: { r: number; g: number; b: number };
  alpha: number;
  items: T[];
}

/**
 * Une colores que el ojo no distingue (ΔE ≤ umbral y misma opacidad). El representante de cada
 * grupo es el más usado; los demás se suman a él. Devuelve los grupos de más a menos usados.
 */
export function boardMergeSimilarColors<T>(entries: PaletteEntry<T>[], threshold = 2.3): PaletteEntry<T>[] {
  const sorted = [...entries].sort((a, b) => b.items.length - a.items.length);
  const merged: PaletteEntry<T>[] = [];
  for (const e of sorted) {
    const home = merged.find(m => Math.abs(m.alpha - e.alpha) <= 0.02 && deltaE(m.color, e.color) <= threshold);
    if (home) home.items.push(...e.items);
    else merged.push({ color: e.color, alpha: e.alpha, items: [...e.items] });
  }
  return merged.sort((a, b) => b.items.length - a.items.length);
}
