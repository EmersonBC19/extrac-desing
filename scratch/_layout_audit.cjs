// Audita: ¿Figma Auto Layout colocaría cada hijo donde lo pinta el navegador?
const { chromium } = require('playwright'); const fs = require('fs');
const SRC = fs.readFileSync('packages/browser-extension/extractor.js', 'utf8');
const VARIANTS = { antes: SRC.replace(/fitAutoLayoutToGeometry\(node\);(\r?\n)+(\s*\/\/ ── 21\.)/, (m, a, b) => b), despues: SRC };
const TARGETS = JSON.parse(process.argv[2]);
function audit(root) {
  let frames = 0, bad = 0, childErrs = 0, children = 0; const worst = [];
  (function walk(n) {
    const L = n.layout || {}; const kids = (n.children || []).filter(c => c.layout && c.layout.positioning !== 'ABSOLUTE');
    const size = (c, h) => { const m = h ? c.layout.measuredWidth : c.layout.measuredHeight; if (typeof m === 'number') return m; const v = h ? c.layout.width : c.layout.height; return typeof v === 'number' ? v : null; };
    if ((L.mode === 'VERTICAL' || L.mode === 'HORIZONTAL') && kids.length && L.measuredWidth > 0 && L.measuredHeight > 0 &&
        kids.every(c => typeof c.layout.x === 'number' && typeof c.layout.y === 'number' && size(c, true) != null && size(c, false) != null)) {
      frames++;
      const V = L.mode === 'VERTICAL', P = L.padding || { top: 0, right: 0, bottom: 0, left: 0 };
      const W = L.measuredWidth, H = L.measuredHeight, gap = L.itemSpacing || 0;
      const ms = kids.map(c => V ? size(c, false) : size(c, true));
      const total = ms.reduce((a, b) => a + b, 0) + gap * (kids.length - 1);
      const start = V ? P.top : P.left, end = (V ? H - P.bottom : W - P.right);
      let cursor = start, step = gap;
      const pa = L.primaryAxisAlignItems || 'MIN';
      if (pa === 'CENTER') cursor = start + (end - start - total) / 2;
      else if (pa === 'MAX') cursor = end - total;
      else if (pa === 'SPACE_BETWEEN' && kids.length > 1) step = (end - start - ms.reduce((a, b) => a + b, 0)) / (kids.length - 1);
      let frameBad = false;
      if (L.layoutWrap === 'WRAP' && !V) {
        let cx = P.left, cy = P.top, rowH = 0;
        kids.forEach(c => {
          const w = size(c, true), h = size(c, false);
          if (cx > P.left && cx + w > W - P.right + 0.5) { cx = P.left; cy += rowH + (L.counterAxisSpacing ?? gap); rowH = 0; }
          const err = Math.max(Math.abs(cx - c.layout.x), Math.abs(cy - c.layout.y));
          children++; if (err > 2) { childErrs++; frameBad = true; if (worst.length < 6) worst.push(`WRAP ${n.name.slice(0, 28)} > ${c.name.slice(0, 22)}: err ${Math.round(err)}px`); }
          cx += w + gap; rowH = Math.max(rowH, h);
        });
        if (frameBad) bad++;
        (n.children || []).forEach(walk); return;
      }
      kids.forEach((c, i) => {
        const cs = V ? size(c, true) : size(c, false);
        const cStart = V ? P.left : P.top, cEnd = V ? W - P.right : H - P.bottom;
        const ca = L.counterAxisAlignItems || 'MIN';
        const fill = (V ? c.layout.width : c.layout.height) === 'FILL';
        let cp = fill ? cStart : ca === 'CENTER' ? cStart + (cEnd - cStart - cs) / 2 : ca === 'MAX' ? cEnd - cs : cStart;
        const px = V ? cp : cursor, py = V ? cursor : cp;
        const err = Math.max(Math.abs(px - c.layout.x), Math.abs(py - c.layout.y));
        children++; if (err > 2) { childErrs++; frameBad = true; if (worst.length < 6) worst.push(`${n.name.slice(0, 28)} > ${c.name.slice(0, 22)}: err ${Math.round(err)}px` + (process.env.DETAIL ? ` | ${L.mode} wrap=${L.layoutWrap} pa=${L.primaryAxisAlignItems} ca=${L.counterAxisAlignItems} size=${W}x${H} pad=${JSON.stringify(P)} gap=${gap} kids=${JSON.stringify(kids.map(k => [k.name.slice(0,14), k.layout.x, k.layout.y, size(k,true), size(k,false), k.layout.width]))}` : '')); }
        cursor += ms[i] + step;
      });
      if (frameBad) bad++;
    }
    (n.children || []).forEach(walk);
  })(root);
  return { autoLayoutFrames: frames, framesMal: bad, hijosMalUbicados: `${childErrs}/${children}`, ejemplos: worst };
}
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [url, sel] of TARGETS) {
    try {
      await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch { await p.waitForTimeout(3000); }
    const out = { url };
    for (const [k, code] of Object.entries(VARIANTS)) {
      await p.evaluate(c => { delete window.__codeToFigmaExtract; (0, eval)(c); }, code);
      const res = await p.evaluate(async (sel) => { const el = eval(sel); if (!el) return null; el.scrollIntoView({ block: 'start' }); await new Promise(r => setTimeout(r, 800)); const r = await window.__codeToFigmaExtract(el); return r && r.rootNode; }, sel);
      out[k] = res ? audit(res) : 'selector no encontrado';
    }
    console.log(JSON.stringify(out, null, 1));
  }
  await b.close();
})();
