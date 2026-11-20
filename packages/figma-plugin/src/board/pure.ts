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
  const c = (v: number) => Math.round((v || 0) * 255).toString(16).padStart(2, '0');
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
    sig = ['T', t.fontFamily, t.fontSize, t.fontWeight, t.textAlign, (S.fills || []).map(boardColorKey).join(',')].join('|');
  } else if (n.type === 'SVG') {
    sig = 'S|' + boardHash(n.svgContent || '') + '|' + L.width + 'x' + L.height;
  } else {
    const pad = L.padding || {};
    const style = [
      L.mode, L.primaryAxisAlignItems, L.counterAxisAlignItems, L.itemSpacing,
      [pad.top, pad.right, pad.bottom, pad.left].join(','),
      (S.fills || []).map(boardColorKey).join(','),
      (S.strokes || []).map((s: any) => boardColorKey(s) + '@' + s.width).join(','),
      JSON.stringify(S.cornerRadius ?? 0), S.opacity ?? 1, (S.boxShadow || []).length,
      n.imageData ? 'IMG:' + (S.imageScaleMode || 'FILL') : ''
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

export interface BoardGroup { id: string; name: string; occurrences: any[]; }

/**
 * Nombre legible para un componente a partir del nombre de capa extraído:
 * "Primer_Brand__Text-module__Text___XeGJJ Primer…" → "Text"
 * "Button / Primary (Más información)"               → "Button / Primary"
 * "Media-gallery-item theme-dark current"            → "Media Gallery Item"
 */
export function boardCleanName(raw: string): string {
  let s = String(raw || '').split('(')[0].trim();
  if (s.includes('/')) return s.replace(/\s+/g, ' ');           // ya es semántico (Button / Primary)
  if (!/[-_]/.test(s)) return s.replace(/\s+/g, ' ') || 'Componente'; // legible (Input Group)
  s = s.split(/\s+/)[0] || s;                                    // primera clase CSS
  // Hash de CSS Modules / styled-components: tiene dígitos o varias mayúsculas internas (XeGJJ, bCyRk, 3A2TYk)
  const isHash = (p: string) => /^[A-Za-z0-9]{4,8}$/.test(p) && (/\d/.test(p) || /[A-Z].*[A-Z]/.test(p.slice(1)) || /^[a-z][A-Z]/.test(p));
  const parts = s.split(/__|--/).map(p => p.replace(/^_+|_+$/g, ''))
    .filter(p => p && !isHash(p))
    .filter(p => !/-module$/i.test(p));
  let core = parts.length ? parts[parts.length - 1] : s;
  if (parts.length >= 2 && core.length <= 6) core = parts[parts.length - 2] + " " + core;
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
    if (!n.children || n.children.length === 0) return false;       // imagen/caja suelta: no es componente
    // Demasiado trivial, salvo una caja con estilo propio + contenido (botón, badge, chip):
    // es el componente más básico de un design system
    const styled = (n.styles?.fills || []).length > 0 || (n.styles?.strokes || []).length > 0;
    if (boardCountNodes(n) < 3 && !styled) return false;
    const area = (n.layout?.measuredWidth || 0) * (n.layout?.measuredHeight || 0);
    return area > 0 && area / rootArea < 0.35;                       // secciones enteras no
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
