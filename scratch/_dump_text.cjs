const { chromium } = require('playwright'); const fs = require('fs');
const [url, sel] = [process.argv[2], process.argv[3]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1905, height: 1000 } });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.addScriptTag({ content: fs.readFileSync('packages/browser-extension/extractor.js', 'utf8') });
  const out = await p.evaluate(async (sel) => {
    const t = eval(sel); t.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 1500));
    const res = await window.__codeToFigmaExtract(t);
    const lines = [];
    (function w(n, d) {
      const L = n.layout;
      lines.push('  '.repeat(d) + n.type + ' ' + n.name.replace(/\s+/g, ' ').slice(0, 30) + ' | ' + L.width + 'x' + L.height + ' @' + L.x + ',' + L.y + ' ' + L.mode + (n.textData ? ' ' + JSON.stringify(n.textData.characters) + ' noWrap=' + n.textData.noWrap + ' lines=' + n.textData.lineCount + (n.textData.segments ? ' segs=' + JSON.stringify(n.textData.segments.map(s => [s.start, s.end, s.fontSize, s.baseline, s.color && s.color.r.toFixed(2)])) : '') : ''));
      (n.children || []).forEach(x => w(x, d + 1));
    })(res.rootNode, 0);
    return lines;
  }, sel);
  console.log(out.join('\n'));
  await b.close();
})();
