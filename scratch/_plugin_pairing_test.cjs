// Prueba del flujo de vinculación del plugin (ui.html) contra un hub real.
// ui.html se carga como file:// → el navegador envía Origin: null, igual que el iframe de Figma.
// code.ts se simula: GET/SET_PAIRING_CODE sobre un almacenamiento en memoria.
// Uso: node scratch/_plugin_pairing_test.cjs
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startHub(file, port, home) {
  const hub = spawn(process.execPath, [require.resolve('tsx/cli'), path.join(ROOT, 'packages/mcp-server/src', file)], {
    env: { ...process.env, WS_PORT: String(port), USERPROFILE: home, HOME: home }, cwd: ROOT });
  let out = ''; hub.stdout.on('data', d => out += d); hub.stderr.on('data', d => out += d);
  for (let i = 0; i < 60 && !/vinculación para el plugin|Hub en ejecución/.test(out); i++) await sleep(250);
  return { hub, get out() { return out; } };
}

function figmaConnected(port) {
  return new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'GET_STATUS' })));
    ws.on('message', d => { const m = JSON.parse(d); if (m.type === 'STATUS_RESPONSE') { ws.close(); res(m.payload.figmaConnected); } });
    ws.on('error', () => res(false));
  });
}

function sendRender(port) {
  return new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => { ws.send(JSON.stringify({ type: 'RENDER_NODES', payload: { rootNode: { id: 'r', type: 'FRAME', name: 'DesdeElHub', layout: {}, children: [] } } })); setTimeout(() => { ws.close(); res(); }, 300); });
    ws.on('error', () => res());
  });
}

async function openPlugin(browser, port, store) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-ui-'));
  const html = fs.readFileSync(path.join(ROOT, 'packages/figma-plugin/src/ui.html'), 'utf8').replace("'ws://localhost:8080'", `'ws://localhost:${port}'`);
  fs.writeFileSync(path.join(tmp, 'ui.html'), html);
  const page = await browser.newPage();
  await page.exposeFunction('__store', (op, v) => { if (op === 'set') store.code = v; return store.code || ''; });
  await page.addInitScript(() => {
    window.__sent = [];
    const orig = window.postMessage.bind(window);
    window.postMessage = (data, origin) => {
      const m = data && data.pluginMessage;
      if (!m) return orig(data, origin);
      if (m.type === 'GET_PAIRING_CODE') window.__store('get').then(code => window.dispatchEvent(new MessageEvent('message', { data: { pluginMessage: { type: 'PAIRING_CODE', code } } })));
      else if (m.type === 'SET_PAIRING_CODE') window.__store('set', m.code);
      else window.__sent.push(m.type);
    };
  });
  await page.goto('file:///' + path.join(tmp, 'ui.html').replace(/\\/g, '/'));
  return page;
}

const bannerVisible = page => page.evaluate(() => document.getElementById('pairingBanner').classList.contains('visible'));

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-home-'));
  const PORT = 18081, OLD_PORT = 18082;
  const hub = await startHub('ws-hub.ts', PORT, home);
  const code = (hub.out.match(/vinculación para el plugin de Figma: ([A-Z0-9-]+)/) || [])[1];
  const browser = await chromium.launch();
  const store = {};

  // A. Primera apertura sin código
  let page = await openPlugin(browser, PORT, store);
  await sleep(1500);
  check('Primera vez: aparece el aviso de vinculación', await bannerVisible(page));
  check('Primera vez: el plugin aún NO recibe renders', !(await figmaConnected(PORT)));
  await sleep(10500); // el hub cierra por tiempo de vinculación (4401)
  const reconnects = (hub.out.match(/Código de vinculación incorrecto/g) || []).length;
  check('Esperando código: no reintenta en bucle (no activa el bloqueo)', reconnects === 0, `${reconnects} fallos registrados`);

  // B. Código incorrecto
  await page.fill('#pairingInput', 'ABCD-EFGH');
  await page.click('.pairing-row button');
  await sleep(1200);
  const err = await page.textContent('#pairingError');
  check('Código incorrecto: muestra el error', /incorrecto/i.test(err), err);

  // C. Código correcto
  await page.fill('#pairingInput', code.toLowerCase().replace('-', ''));
  await page.click('.pairing-row button');
  await sleep(1500);
  check('Código correcto: se oculta el aviso', !(await bannerVisible(page)));
  check('Código correcto: se guarda para la próxima vez', store.code === code, store.code);
  check('Código correcto: el hub ve el plugin conectado', await figmaConnected(PORT));
  await sendRender(PORT);
  await sleep(800);
  check('Plugin vinculado: recibe un render y lo pasa a Figma', (await page.evaluate(() => window.__sent)).includes('RENDER_NODES'));
  await page.close();

  // D. Reapertura con código guardado
  page = await openPlugin(browser, PORT, store);
  await sleep(1800);
  check('Reapertura: conecta sin pedir el código', !(await bannerVisible(page)) && await figmaConnected(PORT));
  await page.close();

  // E. Compatibilidad con un hub sin actualizar (el que tienes corriendo hoy)
  const oldFile = path.join(ROOT, 'packages/mcp-server/src/_ws-hub-old.ts');
  fs.writeFileSync(oldFile, require('child_process').execSync('git show HEAD:packages/mcp-server/src/ws-hub.ts', { cwd: ROOT }));
  const oldHub = await startHub('_ws-hub-old.ts', OLD_PORT, home);
  page = await openPlugin(browser, OLD_PORT, {});
  await sleep(1800);
  check('Hub antiguo: el plugin nuevo se conecta sin pedir código', !(await bannerVisible(page)) && await figmaConnected(OLD_PORT));
  await page.close();
  oldHub.hub.kill();
  fs.rmSync(oldFile, { force: true });

  await browser.close();
  hub.hub.kill();
  fs.rmSync(home, { recursive: true, force: true });
  const failed = results.filter(r => !r).length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
