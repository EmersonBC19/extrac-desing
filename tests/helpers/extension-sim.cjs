// Simula la extensión dentro de una página de Playwright con el código REAL del repo:
//  - extractor.js (extracción)
//  - background.js: captureRegions (recorte desde captura de pantalla) y la descarga de imágenes
//    sin CORS (aquí con fetch de Node, como lo hace el service worker con sus permisos)
//  - ui.html: normalizador de imágenes de la UI del plugin (≤ 4096 px, PNG/JPEG/GIF)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const prepared = new WeakSet();

function backgroundSource() {
  const bg = read('packages/browser-extension/background.js');
  const pick = sig => {
    const i = bg.indexOf(sig);
    if (i < 0) throw new Error(`No se encontró "${sig}" en background.js`);
    return bg.slice(i, bg.indexOf('\n}\n', i) + 2);
  };
  return [
    pick('function uint8ArrayToBase64'),
    pick('async function blobToDataUrl'),
    pick('async function captureRegions'),
  ].join('\n');
}

function uiNormalizerSource() {
  const ui = read('packages/figma-plugin/src/ui.html');
  const a = ui.indexOf('const FIGMA_MAX_IMAGE_SIDE');
  const b = ui.indexOf('// ── Fin normalización de imágenes ──');
  if (a < 0 || b < 0) throw new Error('No se encontró el normalizador de imágenes en ui.html (¿se borró?)');
  return ui.slice(a, b);
}

/** Expone en la página el fetch sin CORS y la captura de pantalla (una vez por página) */
async function prepareExtensionSim(page) {
  if (prepared.has(page)) return;
  prepared.add(page);
  await page.exposeFunction('__nodeFetch', async u => {
    try {
      const r = await fetch(u);
      if (!r.ok) return { success: false, error: 'HTTP ' + r.status };
      const ct = r.headers.get('content-type') || '';
      if (ct && !ct.startsWith('image/')) return { success: false, error: ct };
      const b = Buffer.from(await r.arrayBuffer());
      return { success: true, base64: `data:${ct || 'image/png'};base64,${b.toString('base64')}` };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
  // Hojas de estilo de otro dominio: el service worker las descarga con sus permisos (FETCH_STYLESHEET)
  await page.exposeFunction('__nodeFetchText', async u => {
    try {
      const r = await fetch(u);
      return r.ok ? await r.text() : null;
    } catch (_e) {
      return null;
    }
  });
  await page.exposeFunction(
    '__nodeShot',
    async () => 'data:image/png;base64,' + (await page.screenshot()).toString('base64'),
  );
}

/** Inyecta el extractor y el entorno simulado de la extensión en la página actual */
async function injectExtension(page) {
  await prepareExtensionSim(page);
  const env =
    backgroundSource() +
    '\nwindow.__bgCapture = captureRegions;\n' +
    uiNormalizerSource() +
    '\nwindow.__normalizeTreeImages = normalizeTreeImages;\n' +
    `
    window.chrome = { tabs: { captureVisibleTab: async () => await window.__nodeShot() }, runtime: { lastError: null, sendMessage(m, cb) {
      if (m.type === 'FETCH_IMAGE_AS_BASE64') window.__nodeFetch(m.url).then(cb);
      else if (m.type === 'CAPTURE_REGIONS') window.__bgCapture(0, m.rects, m.viewportWidth).then(crops => cb({ success: true, crops }), e => cb({ success: false, error: String(e) }));
      else cb && cb({ success: false });
    } } };
    window.__codeToFigmaFetchCss = (url) => window.__nodeFetchText(url);
    window.__codeToFigmaCaptureRegions = (rects) => new Promise(res => chrome.runtime.sendMessage({ type: 'CAPTURE_REGIONS', rects, viewportWidth: innerWidth }, r => res(r.crops)));`;
  // evaluate + eval indirecto: funciona aunque el sitio tenga CSP estricta
  await page.evaluate(code => (0, eval)(code), env);
  await page.evaluate(code => (0, eval)(code), read('packages/browser-extension/extractor.js'));
}

/**
 * Extrae `selectorJs` (expresión JS que devuelve el elemento) como lo haría la extensión.
 * opts.prescroll: recorre la página antes (igual que prepareForExtraction)
 * opts.normalize: pasa las imágenes por el normalizador de la UI del plugin
 */
async function extract(page, selectorJs, opts = {}) {
  await injectExtension(page);
  return page.evaluate(
    async ({ selectorJs, prescroll, normalize }) => {
      const el = (0, eval)(selectorJs);
      if (!el) throw new Error('Selector sin resultado: ' + selectorJs);
      if (prescroll) {
        const r0 = el.getBoundingClientRect();
        for (let y = scrollY + r0.top; y < scrollY + r0.bottom; y += innerHeight * 0.8) {
          scrollTo(0, y);
          await new Promise(r => setTimeout(r, 250));
        }
      }
      el.scrollIntoView({ block: 'start' });
      await new Promise(r => setTimeout(r, 400));
      const res = await window.__codeToFigmaExtract(el);
      const stats = normalize ? await window.__normalizeTreeImages(res.rootNode) : null;
      return { rootNode: res.rootNode, tokens: res.tokens, stats };
    },
    { selectorJs, prescroll: !!opts.prescroll, normalize: opts.normalize !== false },
  );
}

/**
 * Exporta `selectorJs` como HTML + CSS + JS (botón "Exportar HTML" de la extensión).
 * opts.noFetch: sin descarga de hojas de otro dominio (quedan ilegibles)
 */
async function exportHtml(page, selectorJs, opts = {}) {
  await injectExtension(page);
  return page.evaluate(
    async ({ selectorJs, noFetch }) => {
      const el = (0, eval)(selectorJs);
      if (!el) throw new Error('Selector sin resultado: ' + selectorJs);
      const fetchCss = noFetch ? async () => null : undefined;
      const res = await window.__codeToFigmaExportHtml(el, { fetchCss });
      const zip = Array.from(window.__codeToFigmaZip(res.files));
      return { ...res, zip };
    },
    { selectorJs, noFetch: !!opts.noFetch },
  );
}

/**
 * Breakpoints y tema (Función A): `frameUrl` es render-frame.html servido por http (en la extensión,
 * chrome.runtime.getURL). El bloque en vivo se extrae antes, como hace content.js.
 */
async function captureVariants(page, selectorJs, opts) {
  await injectExtension(page);
  return page.evaluate(
    async ({ selectorJs, opts }) => {
      const el = (0, eval)(selectorJs);
      if (!el) throw new Error('Selector sin resultado: ' + selectorJs);
      const live = (await window.__codeToFigmaExtract(el)).rootNode;
      return window.__codeToFigmaCaptureVariants(el, { ...opts, liveRootNode: live });
    },
    { selectorJs, opts },
  );
}

/** Lista plana de nodos (para buscar y contar en las aserciones) */
function flatten(root) {
  const out = [];
  (function walk(n, depth, parent) {
    out.push({ node: n, depth, parent });
    for (const c of n.children || []) walk(c, depth + 1, n);
  })(root, 0, null);
  return out;
}

/** Dimensiones reales de cada imageData (decodificadas en el navegador) */
async function imageDimensions(page, root) {
  const datas = flatten(root)
    .map(x => x.node)
    .filter(n => n.imageData)
    .map(n => n.imageData);
  return page.evaluate(
    async list =>
      Promise.all(
        list.map(async src => {
          const im = new Image();
          im.src = src;
          try {
            await im.decode();
            return { ok: true, w: im.naturalWidth, h: im.naturalHeight, mime: src.slice(5, src.indexOf(';')) };
          } catch (_e) {
            return { ok: false, mime: src.slice(5, 30) };
          }
        }),
      ),
    datas,
  );
}

module.exports = { ROOT, read, injectExtension, extract, exportHtml, captureVariants, flatten, imageDimensions, prepareExtensionSim };
