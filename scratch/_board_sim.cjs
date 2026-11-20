// Extrae una página real y la pasa por el plugin (en el simulador de Figma) en modo tablero.
// Uso: node scratch/_board_sim.cjs <url> "<selector JS>"
const { chromium } = require('playwright');
const fs = require('fs');
const { runPlugin } = require('../tests/helpers/figma-mock.cjs');

(async () => {
  const [url, sel] = [process.argv[2], process.argv[3]];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.evaluate(c => (0, eval)(c), fs.readFileSync('packages/browser-extension/extractor.js', 'utf8'));
  const res = await p.evaluate(async (sel) => {
    const el = eval(sel);
    // prescroll: igual que prepareForExtraction de la extensión (dispara lazy-load y animaciones de entrada)
    const r0 = el.getBoundingClientRect();
    for (let y = scrollY + r0.top; y < scrollY + r0.bottom; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); }
    el.scrollIntoView();
    await new Promise(r => setTimeout(r, 800));
    return await window.__codeToFigmaExtract(el);
  }, sel);
  await b.close();

  const t0 = Date.now();
  const figma = await runPlugin({ rootNode: res.rootNode, tokens: res.tokens, board: true, source: { url } }, { preNodes: [{ name: 'Section (export previo)', x: 0, y: 0, w: 1905, h: 1753 }, { name: 'Electrodesk (export previo)', x: 2400, y: 0, w: 1905, h: 945 }] });
  console.log('raíz extraída:', res.rootNode.name.slice(0, 40), res.rootNode.layout.width + 'x' + res.rootNode.layout.height, '| hijos:', res.rootNode.children.map(c => c.name.slice(0, 18)).join(', '));
  const ms = Date.now() - t0;

  const page = figma.currentPage;
  const count = (n, pred) => { let c = 0; (function w(x) { for (const ch of x.children || []) { if (pred(ch)) c++; w(ch); } })(n); return c; };
  console.log(`Página: "${page.name}"  (${ms} ms en el simulador)`);
  for (const s of page.children) {
    if (s.type !== 'SECTION') { console.log(`  (previo) ${s.name} @${s.x},${s.y}`); continue; }
    console.log(`  ${s.type} "${s.name}"  ${Math.round(s.width)}x${Math.round(s.height)} @${Math.round(s.x)},${Math.round(s.y)}` +
      `  hijos=${s.children.length}  instancias=${count(s, n => n.type === "INSTANCE")}  componentes=${count(s, n => n.type === "COMPONENT")}`);
    if (s.name.startsWith("02")) console.log("     sub-vistas:", s.children.filter(c => c.type === "TEXT").map(c => c.characters).join(" | "));
  }
  console.log(`Estilos: ${figma.styles.text.length} de texto, ${figma.styles.paint.length} de color`);
  console.log(`Textos con estilo vinculado: ${count(page, n => n.type === 'TEXT' && n._ts)}/${count(page, n => n.type === 'TEXT')}`);
  const msgs = figma.logs.filter(m => m.type !== 'PAGE_INFO');
  const tally = {};
  for (const m of msgs) { const k = m.type + (m.level ? ':' + m.level : ''); tally[k] = (tally[k] || 0) + 1; }
  console.log('Mensajes:', JSON.stringify(tally));
  for (const e of msgs.filter(m => m.level === 'error' || m.level === 'warn' || m.type === 'RENDER_ERROR').slice(0, 8)) {
    console.log('   ⚠', e.message || e.error);
  }
  const ok = msgs.find(m => m.type === 'LOG' && m.level === 'success');
  if (ok) console.log('   ✓', ok.message);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
