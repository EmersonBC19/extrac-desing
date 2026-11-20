// Auditoría de fidelidad de layout: simula cómo colocaría Figma (Auto Layout) a cada hijo
// según padding, gap, alineación y wrap, y lo compara con la posición MEDIDA en el navegador.
// Un hijo a más de `tolerance` px de su posición real cuenta como mal ubicado.

function auditLayout(root, { tolerance = 2, maxExamples = 6, detail = false } = {}) {
  let frames = 0,
    badFrames = 0,
    misplaced = 0,
    children = 0;
  const examples = [];
  // Misma precedencia que el plugin (render.ts): un tamaño fijo explícito manda sobre el medido
  const size = (c, horizontal) => {
    const v = horizontal ? c.layout.width : c.layout.height;
    if (typeof v === 'number') return v;
    const m = horizontal ? c.layout.measuredWidth : c.layout.measuredHeight;
    return typeof m === 'number' ? m : null;
  };
  const report = (n, c, err, L, W, H, P, gap, kids, prefix = '') => {
    misplaced++;
    if (examples.length < maxExamples) {
      examples.push(
        `${prefix}${String(n.name).slice(0, 28)} > ${String(c.name).slice(0, 22)}: err ${Math.round(err)}px` +
          (detail
            ? ` | ${L.mode} wrap=${L.layoutWrap} pa=${L.primaryAxisAlignItems} ca=${L.counterAxisAlignItems} size=${W}x${H} pad=${JSON.stringify(P)} gap=${gap} kids=${JSON.stringify(kids.map(k => [String(k.name).slice(0, 14), k.layout.x, k.layout.y, size(k, true), size(k, false), k.layout.width]))}`
            : ''),
      );
    }
  };

  (function walk(n) {
    const L = n.layout || {};
    const kids = (n.children || []).filter(c => c.layout && c.layout.positioning !== 'ABSOLUTE');
    const measurable =
      (L.mode === 'VERTICAL' || L.mode === 'HORIZONTAL') &&
      kids.length &&
      L.measuredWidth > 0 &&
      L.measuredHeight > 0 &&
      kids.every(
        c =>
          typeof c.layout.x === 'number' &&
          typeof c.layout.y === 'number' &&
          size(c, true) != null &&
          size(c, false) != null,
      );
    if (measurable) {
      frames++;
      const V = L.mode === 'VERTICAL';
      const P = L.padding || { top: 0, right: 0, bottom: 0, left: 0 };
      const W = L.measuredWidth,
        H = L.measuredHeight,
        gap = L.itemSpacing || 0;
      let frameBad = false;

      if (L.layoutWrap === 'WRAP' && !V) {
        let cx = P.left,
          cy = P.top,
          rowH = 0;
        for (const c of kids) {
          const w = size(c, true),
            h = size(c, false);
          if (cx > P.left && cx + w > W - P.right + 0.5) {
            cx = P.left;
            cy += rowH + (L.counterAxisSpacing ?? gap);
            rowH = 0;
          }
          const err = Math.max(Math.abs(cx - c.layout.x), Math.abs(cy - c.layout.y));
          children++;
          if (err > tolerance) {
            frameBad = true;
            report(n, c, err, L, W, H, P, gap, kids, 'WRAP ');
          }
          cx += w + gap;
          rowH = Math.max(rowH, h);
        }
      } else {
        const ms = kids.map(c => (V ? size(c, false) : size(c, true)));
        const total = ms.reduce((a, b) => a + b, 0) + gap * (kids.length - 1);
        const start = V ? P.top : P.left,
          end = V ? H - P.bottom : W - P.right;
        let cursor = start,
          step = gap;
        const pa = L.primaryAxisAlignItems || 'MIN';
        if (pa === 'CENTER') cursor = start + (end - start - total) / 2;
        else if (pa === 'MAX') cursor = end - total;
        else if (pa === 'SPACE_BETWEEN' && kids.length > 1)
          step = (end - start - ms.reduce((a, b) => a + b, 0)) / (kids.length - 1);
        kids.forEach((c, i) => {
          const cs = V ? size(c, true) : size(c, false);
          const cStart = V ? P.left : P.top,
            cEnd = V ? W - P.right : H - P.bottom;
          const ca = L.counterAxisAlignItems || 'MIN';
          const fill = (V ? c.layout.width : c.layout.height) === 'FILL';
          const cp = fill
            ? cStart
            : ca === 'CENTER'
              ? cStart + (cEnd - cStart - cs) / 2
              : ca === 'MAX'
                ? cEnd - cs
                : cStart;
          const px = V ? cp : cursor,
            py = V ? cursor : cp;
          const err = Math.max(Math.abs(px - c.layout.x), Math.abs(py - c.layout.y));
          children++;
          if (err > tolerance) {
            frameBad = true;
            report(n, c, err, L, W, H, P, gap, kids);
          }
          cursor += ms[i] + step;
        });
      }
      if (frameBad) badFrames++;
    }
    (n.children || []).forEach(walk);
  })(root);

  return { frames, badFrames, misplaced, children, examples, summary: `${misplaced}/${children}` };
}

module.exports = { auditLayout };
