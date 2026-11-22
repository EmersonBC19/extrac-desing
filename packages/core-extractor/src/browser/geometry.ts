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

  // Para que el wrap en Figma rompa las filas exactamente en los mismos elementos que la web,
  // el ancho debe ser el medido (W), nunca FILL, ya que si el contenedor se estirase en Figma
  // subiría elementos de la segunda fila a la primera.
  if (L.width === 'FILL') {
    L.width = Math.round(W);
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
  const gap = gaps.length ? r(avg(gaps)) : 0;

  // Hijos que sobresalen del contenedor (margen negativo, franjas decorativas): el padding de
  // Figma no puede ser negativo, se recortaría a 0 y desplazaría todo → posiciones exactas.
  if (top < -1 || starts[0] < -1 || W - maxRight < -1 || H - lastRowBottom < -1) {
    L.mode = 'NONE';
    return;
  }

  // Figma llena cada fila con todo lo que quepa: si a una fila le sobra sitio para el primer
  // elemento de la siguiente, lo subiría y movería todo lo demás (filas incompletas, celdas que
  // ocupan varias columnas). En ese caso no se puede expresar con wrap → posiciones exactas.
  for (let i = 0; i < rows.length - 1; i++) {
    const last = rows[i].items[rows[i].items.length - 1];
    const rowEnd = last.layout.x + sz(last, true)!;
    const next = rows[i + 1].items[0];
    if (rowEnd + gap + sz(next, true)! <= maxRight + 0.5) {
      L.mode = 'NONE';
      return;
    }
  }

  L.primaryAxisAlignItems = 'MIN';
  L.counterAxisAlignItems = 'MIN';
  if (gaps.length) L.itemSpacing = gap;
  L.counterAxisSpacing = r(avg(rowGaps));
  L.padding = { left: r(starts[0]), top: r(top), right: r(W - maxRight), bottom: r(H - lastRowBottom) };
  // Celdas de un grid CSS: tamaño fijo. El ancho de cada celda sale de la posición de la siguiente
  // (x siguiente − x − gap): las columnas fraccionarias (1fr = 293,33 px) no acumulan error de
  // redondeo y el ancho disponible queda justo para las columnas de la web, así Figma parte las
  // filas en el mismo sitio aunque cambie la fuente.
  if (node._gridWrap) {
    node._gridWrapOk = true;
    for (const row of rows) {
      row.items.forEach((c, i) => {
        const nextItem = row.items[i + 1];
        c.layout.width = nextItem ? nextItem.layout.x - c.layout.x - gap : Math.round(sz(c, true)!);
        c.layout.height = Math.round(sz(c, false)!);
      });
    }
  }
}

/** ¿Crea este elemento bloque contenedor para descendientes absolutos (o fijos, si fixedToo)? */
function isContainingBlock(s: CSSStyleDeclaration, fixedToo: boolean): boolean {
  const transformed = s.transform !== 'none' || s.filter !== 'none' || /paint|layout|strict|content/.test(s.contain || '');
  return fixedToo ? transformed : transformed || s.position !== 'static';
}

/**
 * Posición de un pseudo-elemento absoluto/fijo relativa a su elemento anfitrión (left/top/right/bottom
 * + translate). Los valores se resuelven contra su bloque contenedor REAL (el anfitrión si está
 * posicionado; si no, el ancestro posicionado más cercano o el viewport) y se pasan a coordenadas del
 * anfitrión. Con ambos lados en `auto` queda en su posición estática ≈ inicio del contenido del anfitrión.
 */
export function pseudoPosition(element: Element, ps: CSSStyleDeclaration, w: number, h: number) {
  const er = element.getBoundingClientRect();
  const es = window.getComputedStyle(element);
  const fixed = ps.position === 'fixed';

  // Caja de relleno (padding box) del bloque contenedor, en coordenadas del viewport
  let cb: { left: number; top: number; width: number; height: number } | null = null;
  for (let el: Element | null = element; el && el !== document.documentElement; el = el.parentElement) {
    const s = window.getComputedStyle(el);
    if (!isContainingBlock(s, fixed)) continue;
    const r = el.getBoundingClientRect();
    const bl = parseFloat(s.borderLeftWidth) || 0;
    const bt = parseFloat(s.borderTopWidth) || 0;
    const br = parseFloat(s.borderRightWidth) || 0;
    const bb = parseFloat(s.borderBottomWidth) || 0;
    cb = { left: r.left + bl, top: r.top + bt, width: r.width - bl - br, height: r.height - bt - bb };
    break;
  }
  if (!cb) {
    // Viewport (fixed) o bloque contenedor inicial (absolute sin ancestro posicionado)
    cb = fixed
      ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      : { left: -window.scrollX, top: -window.scrollY, width: window.innerWidth, height: window.innerHeight };
  }

  const parseVal = (v: string, dim: number) => {
    if (!v || v === 'auto') return null;
    if (v.endsWith('%')) {
      const pct = parseFloat(v);
      return !isNaN(pct) ? (pct / 100) * dim : null;
    }
    const num = parseFloat(v);
    return !isNaN(num) ? num : null;
  };
  const left = parseVal(ps.left, cb.width),
    right = parseVal(ps.right, cb.width),
    top = parseVal(ps.top, cb.height),
    bottom = parseVal(ps.bottom, cb.height);

  let x: number, y: number;
  if (left !== null) x = cb.left + left - er.left;
  else if (right !== null) x = cb.left + cb.width - right - w - er.left;
  else x = (parseFloat(es.borderLeftWidth) || 0) + (parseFloat(es.paddingLeft) || 0);
  if (top !== null) y = cb.top + top - er.top;
  else if (bottom !== null) y = cb.top + cb.height - bottom - h - er.top;
  else y = (parseFloat(es.borderTopWidth) || 0) + (parseFloat(es.paddingTop) || 0);

  // translate de transform: matrix(a, b, c, d, tx, ty)
  const m = (ps.transform || '').match(/^matrix\(([^)]+)\)$/);
  if (m) {
    const k = m[1].split(',').map(parseFloat);
    x += k[4] || 0;
    y += k[5] || 0;
  }
  return { x: Math.round(x), y: Math.round(y) };
}
