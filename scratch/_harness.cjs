// Simula la extensión: extractor + background (fetch sin CORS + captureVisibleTab) + normalizador de ui.html
const { chromium } = require('playwright');
const fs = require('fs');
const [url, selectorJs] = [process.argv[2], process.argv[3]];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
  await page.exposeFunction('__nodeFetch', async (u) => {
    try { const r = await fetch(u); if (!r.ok) return { success:false, error:'HTTP '+r.status };
      const ct = r.headers.get('content-type')||''; if (ct && !ct.startsWith('image/')) return {success:false,error:ct};
      const b = Buffer.from(await r.arrayBuffer()); return { success:true, base64:`data:${ct||'image/png'};base64,${b.toString('base64')}` };
    } catch(e){ return {success:false,error:String(e)}; } });
  await page.exposeFunction('__nodeShot', async () => 'data:image/png;base64,' + (await page.screenshot()).toString('base64'));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  const bg = fs.readFileSync('packages/browser-extension/background.js','utf8');
  const fnSrc = ['uint8ArrayToBase64','blobToDataUrl','captureRegions'].map(n => { const i = bg.indexOf((n==='uint8ArrayToBase64'?'function ':'async function ')+n); const j = bg.indexOf('\n}\n', i); return bg.slice(i, j+2); }).join('\n');
  const ui = fs.readFileSync('packages/figma-plugin/src/ui.html','utf8');
  const uiSrc = ui.slice(ui.indexOf('const FIGMA_MAX_IMAGE_SIDE'), ui.indexOf('// ── Fin normalización de imágenes ──'));
  await page.addScriptTag({ content: fnSrc + '\nwindow.__bgCapture = captureRegions;\n' + uiSrc + '\nwindow.__normalizeTreeImages = normalizeTreeImages;\n' +
    `window.chrome = { tabs: { captureVisibleTab: async () => await window.__nodeShot() }, runtime: { lastError: null, sendMessage(m, cb) {
       if (m.type==='FETCH_IMAGE_AS_BASE64') window.__nodeFetch(m.url).then(cb);
       else if (m.type==='CAPTURE_REGIONS') window.__bgCapture(0, m.rects, m.viewportWidth).then(crops=>cb({success:true,crops}), e=>cb({success:false,error:String(e)}));
     } } };
     window.__codeToFigmaCaptureRegions = (rects) => new Promise(res => chrome.runtime.sendMessage({type:'CAPTURE_REGIONS', rects, viewportWidth: innerWidth}, r => res(r.crops)));` });
  await page.addScriptTag({ content: fs.readFileSync('packages/browser-extension/extractor.js','utf8') }); if (process.env.PRESCROLL) await page.evaluate(() => { window.__PRESCROLL = true; });
  const out = await page.evaluate(async (selectorJs) => {
    const el = eval(selectorJs);
    if (!el) return { err: 'selector not found' };
    if (window.__PRESCROLL) { const r0 = el.getBoundingClientRect(); for (let y = scrollY + r0.top; y < scrollY + r0.bottom; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 300)); } } el.scrollIntoView({ block: 'start' }); await new Promise(r => setTimeout(r, 2500));
    const res = await window.__codeToFigmaExtract(el);
    const stats = await window.__normalizeTreeImages(res.rootNode);
    const lines = []; let imgs = 0, missing = [];
    const walk = async (n, d) => {
      let dim = '';
      if (n.imageData) { imgs++; const im = new Image(); im.src = n.imageData; try { await im.decode(); dim = ` [IMG ${n.imageData.slice(5, n.imageData.indexOf(';'))} ${im.naturalWidth}x${im.naturalHeight}]`; } catch { dim = ' [IMG ¡NO DECODIFICA!]'; } }
      else if (/^(Image|Video|Embed|Chart)/.test(n.name)) missing.push(n.name);
      if (d < 8) lines.push('  '.repeat(d) + n.type + ' ' + n.name.replace(/\s+/g,' ').slice(0, 45) + ' ' + n.layout.width + 'x' + n.layout.height + ' @' + n.layout.x + ',' + n.layout.y + (n.layout.mode==='NONE'?' [NONE]':'') + (n.clipsContent?' [clip]':'') + dim);
      for (const c of n.children || []) await walk(c, d + 1);
    };
    await walk(res.rootNode, 0);
    const leftovers = JSON.stringify(res.rootNode).match(/"_(pending|vpRect|needsShot|hadPending)[A-Za-z]*"/g);
    return { stats, imgs, missing, leftovers, json_kb: Math.round(JSON.stringify(res.rootNode).length/1024), tree: lines };
  }, selectorJs);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
