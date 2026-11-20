// Valida extracciones reales (no deben rechazarse) y payloads maliciosos (deben rechazarse)
const { chromium } = require('playwright'); const fs = require('fs');
const { validateRenderPayload } = require('../packages/contracts/dist/index.js');
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const ext = fs.readFileSync('packages/browser-extension/extractor.js', 'utf8');
  for (const [url, sel] of [['https://www.apple.com/co/', 'document.querySelector("main")'], ['https://github.com/', 'document.body'], ['https://es.wikipedia.org/wiki/Colombia', 'document.querySelector("#content")'], ['http://localhost:8765/', 'document.getElementById("root")']]) {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.evaluate(c => (0, eval)(c), ext);
    const res = await p.evaluate(async s => { const el = eval(s); const r = await window.__codeToFigmaExtract(el); return r; }, sel);
    const t0 = Date.now(); const v = validateRenderPayload({ rootNode: res.rootNode, tokens: res.tokens, board: true, source: { url } }); const ms = Date.now() - t0;
    check(`Extracción real aceptada: ${url}`, v.ok, v.ok ? `${v.nodeCount} nodos, prof. ${v.maxDepth}, ${ms} ms` : v.error);
  }
  await b.close();
  const base = () => ({ id: 'r', type: 'FRAME', name: 'x', layout: {}, children: [] });
  const bad = [
    ['Tipo de nodo inválido', { rootNode: { ...base(), type: 'SCRIPT' } }],
    ['SVG con <script>', { rootNode: { ...base(), children: [{ type: 'SVG', svgContent: '<svg><script>alert(1)</script></svg>' }] } }],
    ['SVG con javascript:', { rootNode: { ...base(), children: [{ type: 'SVG', svgContent: '<svg><a href="javascript:alert(1)"/></svg>' }] } }],
    ['imageData que no es imagen', { rootNode: { ...base(), imageData: 'data:text/html;base64,PHNjcmlwdD4=' } }],
    ['imageData con URL externa', { rootNode: { ...base(), imageData: 'https://evil.example/x.png' } }],
    ['Coordenada no numérica', { rootNode: { ...base(), layout: { x: 'NaN' } } }],
    ['Coordenada infinita', { rootNode: { ...base(), layout: { x: Infinity } } }],
    ['Texto gigante (> 200k)', { rootNode: { type: 'TEXT', textData: { characters: 'a'.repeat(200_001) } } }],
    ['Sin rootNode válido', { rootNode: 'hola' }],
    ['board no booleano', { rootNode: base(), board: 'si' }],
  ];
  for (const [n, payload] of bad) { const v = validateRenderPayload(payload); check(`Rechaza: ${n}`, !v.ok, v.ok ? 'ACEPTADO' : v.error); }
  // Árbol muy profundo (ataque a la pila): debe rechazarse sin reventar
  let deep = { type: 'FRAME', children: [] }; const root = deep; for (let i = 0; i < 5000; i++) { const c = { type: 'FRAME', children: [] }; deep.children.push(c); deep = c; }
  let v = validateRenderPayload({ rootNode: root }); check('Rechaza árbol de 5000 niveles sin desbordar la pila', !v.ok, v.ok ? '' : v.error);
  // Demasiados nodos
  v = validateRenderPayload({ rootNode: { type: 'FRAME', children: Array.from({ length: 150_001 }, () => ({ type: 'FRAME' })) } }); check('Rechaza más de 150.000 nodos', !v.ok, v.ok ? '' : v.error);
  const failed = results.filter(r => !r).length; console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
