// Extracción completa de CUALQUIER sitio como lo haría la extensión (herramienta manual).
// Uso: node scratch/_harness.cjs <url> "<expresión JS del elemento>"   (PRESCROLL=1 para recorrer antes)
const { chromium } = require('playwright');
const { extract, flatten, imageDimensions } = require('../tests/helpers/extension-sim.cjs');

(async () => {
  const [url, selector] = [process.argv[2], process.argv[3]];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1000 }, bypassCSP: true })).newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => page.waitForTimeout(3000));
  const { rootNode, stats } = await extract(page, selector, { prescroll: !!process.env.PRESCROLL });
  const dims = await imageDimensions(page, rootNode);
  const nodes = flatten(rootNode);
  const missing = nodes.map(x => x.node).filter(n => !n.imageData && /^(Image|Video|Embed|Chart)/.test(n.name)).map(n => n.name);
  const tree = nodes.filter(x => x.depth < 8).map(({ node: n, depth }) => {
    const L = n.layout || {};
    return '  '.repeat(depth) + `${n.type} ${String(n.name).replace(/\s+/g, ' ').slice(0, 45)} ${L.width}x${L.height} @${L.x},${L.y}` +
      (L.mode === 'NONE' ? ' [NONE]' : '') + (n.clipsContent ? ' [clip]' : '') + (n.imageData ? ' [IMG]' : '');
  });
  console.log(JSON.stringify({ stats, imgs: dims.length, imgsInvalidas: dims.filter(d => !d.ok).length, missing, tree }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
