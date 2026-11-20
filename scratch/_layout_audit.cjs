// Auditoría de layout contra CUALQUIER sitio (herramienta manual; la suite usa los mismos helpers).
// Uso: node scratch/_layout_audit.cjs '[["https://sitio.com/","document.querySelector(\"main\")"]]'
//      DETAIL=1 para ver el detalle de cada frame mal ubicado
const { chromium } = require('playwright');
const { extract } = require('../tests/helpers/extension-sim.cjs');
const { auditLayout } = require('../tests/helpers/layout-audit.cjs');

(async () => {
  const targets = JSON.parse(process.argv[2]);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true })).newPage();
  for (const [url, selector] of targets) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.waitForTimeout(3000));
    try {
      const { rootNode } = await extract(page, selector, { normalize: false });
      const a = auditLayout(rootNode, { detail: !!process.env.DETAIL });
      console.log(JSON.stringify({ url, frames: a.frames, malUbicados: a.summary, ejemplos: a.examples }, null, 1));
    } catch (e) {
      console.log(JSON.stringify({ url, error: String(e.message || e) }));
    }
  }
  await browser.close();
})();
