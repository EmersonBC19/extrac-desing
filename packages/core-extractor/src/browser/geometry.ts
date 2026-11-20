/**
 * Ajuste de Auto Layout a la geometría medida (padding, gap, alineación, wrap) y posición de pseudo-elementos.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
import type { RawNode } from './types';

/** Caja medida de un hijo (posición y tamaño relativos al padre). */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Reescribe padding / gap / alineación de un nodo Auto Layout a partir de las posiciones
 * MEDIDAS de sus hijos, para que Figma los coloque exactamente donde los pinta el navegador.
 *  - eje principal: padding inicial/final = espacio real antes del primero / después del último;
 *    gap = separación real (si las separaciones no son uniformes → modo NONE, posiciones exactas)
 *  - eje transversal: MIN / MAX / CENTER según dónde caen realmente los hijos (si no encaja → NONE)
 * Los hijos sin posición medida (etiquetas sintéticas de botones) dejan el nodo como estaba.
 */
export function fitAutoLayoutToGeometry(node: RawNode) {
  const L = node.layout;
  if (!L || (L.mode !== 'VERTICAL' && L.mode !== 'HORIZONTAL')) return;
  if (L.counterAxisAlignItems === 'BASELINE') return;
  const W = L.measuredWidth;
  const H = L.measuredHeight;
  if (!(W > 0 && H > 0)) return;
  if (L.layoutWrap === 'WRAP' && L.mode === 'HORIZONTAL') {
    fitWrapToGeometry(node, W, H);
    return;
  }

  const dim = (c: RawNode, horizontal: boolean): number | null => {
    const m = horizontal ? c.layout.measuredWidth : c.layout.measuredHeight;
    if (typeof m === 'number') return m;
    const n = horizontal ? c.layout.width : c.layout.height;
    return typeof n === 'number' ? n : null;
  };
  const flow: RawNode[] = (node.children || []).filter((c: RawNode) => c.layout && c.layout.positioning !== 'ABSOLUTE');
  if (flow.length === 0) return;
  const boxes: Box[] = [];
  for (const c of flow) {
    const x = c.layout.x,
      y = c.layout.y,
      w = dim(c, true),
      h = dim(c, false);
    if (typeof x !== 'number' || typeof y !== 'number' || w == null || h == null) return;
    boxes.push({ x, y, w, h });
  }

  const V = L.mode === 'VERTICAL';
  const main = (b: Box) => (V ? b.y : b.x);
  const mainSize = (b: Box) => (V ? b.h : b.w);
  const cross = (b: Box) => (V ? b.x : b.y);
  const crossSize = (b: Box) => (V ? b.w : b.h);
  const MAIN = V ? H : W;
  const CROSS = V ? W : H;

  const sorted = [...boxes].sort((a, b) => main(a) - main(b));
  const last = sorted[sorted.length - 1];
  const lead = main(sorted[0]);
  const trail = MAIN - (main(last) + mainSize(last));

  // SPACE_BETWEEN: conservarlo solo si Figma colocaría a los hijos donde están
  if (L.primaryAxisAlignItems === 'SPACE_BETWEEN') {
    const P = L.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const pStart = V ? P.top : P.left;
    const pEnd = V ? P.bottom : P.right;
    const sum = sorted.reduce((a, b) => a + mainSize(b), 0);
    const step = sorted.length > 1 ? (MAIN - pStart - pEnd - sum) / (sorted.length - 1) : 0;
    let cur = pStart,
      ok = step >= 0;
    for (const b of sorted) {
      if (Math.abs(main(b) - cur) > 2) {
        ok = false;
        break;
      }
      cur += mainSize(b) + step;
    }
    const cStart = V ? P.left : P.top;
    const cEnd = V ? W - P.right : H - P.bottom;
    const ca = L.counterAxisAlignItems || 'MIN';
    if (ok)
      ok = boxes.every(b => {
        const exp =
          ca === 'CENTER' ? cStart + (cEnd - cStart - crossSize(b)) / 2 : ca === 'MAX' ? cEnd - crossSize(b) : cStart;
        return Math.abs(cross(b) - exp) <= 2 || Math.abs(crossSize(b) - (cEnd - cStart)) <= 2;
      });
    if (ok) return;
  }
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(main(sorted[i]) - (main(sorted[i - 1]) + mainSize(sorted[i - 1])));

  // Separaciones irregulares, solapes o desbordes: Auto Layout no puede reproducirlo → posiciones exactas
  if (gaps.length && (Math.max(...gaps) - Math.min(...gaps) > 2 || Math.min(...gaps) < -1)) {
    L.mode = 'NONE';
    return;
  }
  if (lead < -1 || trail < -1) {
    L.mode = 'NONE';
    return;
  }

  const before = boxes.map(cross);
  const after = boxes.map(b => CROSS - (cross(b) + crossSize(b)));
  const same = (arr: number[]) => Math.max(...arr) - Math.min(...arr) <= 1.5;
  let counter, padBefore, padAfter;
  // CENTER primero: si los hijos están centrados, seguir centrados al redimensionar en Figma
  // (antes un icono centrado salía como MIN + padding: igual a la vista, pero se descentraba al editar)
  if (boxes.every((_, i) => Math.abs(before[i] - after[i]) <= 2)) {
    counter = 'CENTER';
    padBefore = padAfter = Math.min(...before);
  } else if (same(before)) {
    counter = 'MIN';
    padBefore = before[0];
    padAfter = Math.min(...after);
  } else if (same(after)) {
    counter = 'MAX';
    padAfter = after[0];
    padBefore = Math.min(...before);
  } else {
    L.mode = 'NONE';
    return;
  }
  if (padBefore < -1 || padAfter < -1) {
    L.mode = 'NONE';
    return;
  }

  const r = (v: number) => Math.max(0, Math.round(v));
  // Hijos marcados FILL en el eje transversal que en la web NO ocupan todo el ancho/alto
  // disponible (ej. bloque con max-width centrado): FILL los estiraría → tamaño fijo real.
  const available = CROSS - padBefore - padAfter;
  const crossProp = V ? 'width' : 'height';
  flow.forEach((c: RawNode, i: number) => {
    if (c.layout[crossProp] === 'FILL' && Math.abs(crossSize(boxes[i]) - available) > 2) {
      c.layout[crossProp] = Math.round(crossSize(boxes[i]));
    }
  });
  L.primaryAxisAlignItems = 'MIN';
  L.counterAxisAlignItems = counter;
  if (gaps.length) L.itemSpacing = r(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  L.padding = V
    ? { top: r(lead), bottom: r(trail), left: r(padBefore), right: r(padAfter) }
    : { left: r(lead), right: r(trail), top: r(padBefore), bottom: r(padAfter) };
}

/**
 * Auto Layout horizontal con wrap: ordenar por fila y columna y conservar el wrap solo si
 * Figma lo puede reproducir (filas alineadas arriba, gap horizontal y entre filas uniformes,
 * todas las filas empiezan en el mismo x). Una sola fila → fila normal. Si no → NONE.
 */
export function fitWrapToGeometry(node: RawNode, W: number, H: number) {
  const L = node.layout;
  const kids: RawNode[] = (node.children || []).filter((c: RawNode) => c.layout && c.layout.positioning !== 'ABSOLUTE');
  const sz = (c: RawNode, h: boolean): number | null => {
    const m = h ? c.layout.measuredWidth : c.layout.measuredHeight;
    if (typeof m === 'number') return m;
    const v = h ? c.layout.width : c.layout.height;
    return typeof v === 'number' ? v : null;
  };
  if (
    !kids.length ||
    kids.some(
      (c: RawNode) =>
        typeof c.layout.x !== 'number' || typeof c.layout.y !== 'number' || sz(c, true) == null || sz(c, false) == null,
    )
  )
    return;

  // Agrupar en filas por y
  const rows: Array<{ y: number; items: RawNode[] }> = [];
  for (const c of [...kids].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)) {
    const row = rows.find(r => Math.abs(r.y - c.layout.y) <= 2);
    if (row) row.items.push(c);
    else rows.push({ y: c.layout.y, items: [c] });
  }
  rows.forEach(r => r.items.sort((a, b) => a.layout.x - b.layout.x));
  // Reordenar hijos: fila por fila (los absolutos al final, conservan su posición)
  const abs = (node.children || []).filter((c: RawNode) => !kids.includes(c));
  node.children = rows.flatMap(r => r.items).concat(abs);

  if (rows.length === 1) {
    L.layoutWrap = 'NO_WRAP';
    fitAutoLayoutToGeometry(node);
    return;
  }

  const gaps: number[] = [];
  for (const r of rows)
    for (let i = 1; i < r.items.length; i++) {
      const a = r.items[i - 1],
        b = r.items[i];
      gaps.push(b.layout.x - (a.layout.x + sz(a, true)));
    }
  const rowGaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prevBottom = Math.max(...rows[i - 1].items.map(c => c.layout.y + sz(c, false)));
    rowGaps.push(rows[i].y - prevBottom);
  }
  const uniform = (arr: number[]) => !arr.length || Math.max(...arr) - Math.min(...arr) <= 2;
  const starts = rows.map(r => r.items[0].layout.x);
  if (
    !uniform(gaps) ||
    !uniform(rowGaps) ||
    !uniform(starts) ||
    Math.min(...rowGaps) < -1 ||
    (gaps.length && Math.min(...gaps) < -1)
  ) {
    L.mode = 'NONE';
    return;
  }
  const r = (v: number) => Math.max(0, Math.round(v));
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const top = rows[0].y;
  const lastRowBottom = Math.max(...rows[rows.length - 1].items.map(c => c.layout.y + sz(c, false)));
  const maxRight = Math.max(...kids.map(c => c.layout.x + sz(c, true)));
  L.primaryAxisAlignItems = 'MIN';
  L.counterAxisAlignItems = 'MIN';
  if (gaps.length) L.itemSpacing = r(avg(gaps));
  L.counterAxisSpacing = r(avg(rowGaps));
  L.padding = { left: r(starts[0]), top: r(top), right: r(W - maxRight), bottom: r(H - lastRowBottom) };
}

/**
 * Posición de un pseudo-elemento absoluto relativa a su elemento (left/top/right/bottom + translate).
 * Solo cuando el elemento es su bloque contenedor (está posicionado); si no, null.
 */
export function pseudoPosition(element: Element, ps: CSSStyleDeclaration, w: number, h: number) {
  const es = window.getComputedStyle(element);
  if (es.position === 'static') return null;
  const er = element.getBoundingClientRect();
  const bl = parseFloat(es.borderLeftWidth) || 0,
    bt = parseFloat(es.borderTopWidth) || 0;
  const br = parseFloat(es.borderRightWidth) || 0,
    bb = parseFloat(es.borderBottomWidth) || 0;
  const px = (v: string) => (v && v.endsWith('px') ? parseFloat(v) : null);
  let x = null,
    y = null;
  const left = px(ps.left),
    right = px(ps.right),
    top = px(ps.top),
    bottom = px(ps.bottom);
  if (left !== null) x = bl + left;
  else if (right !== null) x = er.width - br - right - w;
  if (top !== null) y = bt + top;
  else if (bottom !== null) y = er.height - bb - bottom - h;
  // translate de transform: matrix(a, b, c, d, tx, ty)
  const m = (ps.transform || '').match(/^matrix\(([^)]+)\)$/);
  if (m) {
    const k = m[1].split(',').map(parseFloat);
    if (x !== null) x += k[4] || 0;
    if (y !== null) y += k[5] || 0;
  }
  if (x === null || y === null) return null;
  return { x: Math.round(x), y: Math.round(y) };
}
