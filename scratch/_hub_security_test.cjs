// Prueba de seguridad del hub: arranca ws-hub en un puerto aparte y lo ataca como lo haría
// una página web maliciosa, además de verificar que los clientes legítimos siguen funcionando.
// Uso: node scratch/_hub_security_test.cjs
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const PORT = 18080;
const URL_ = `ws://127.0.0.1:${PORT}`;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-hub-test-'));
const marker = path.join(home, 'PWNED.txt');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connect(origin) {
  return new Promise((resolve) => {
    const opts = origin === undefined ? {} : { origin };
    const ws = new WebSocket(URL_, opts);
    const msgs = [];
    let closeCode = null;
    ws.on('message', d => { try { msgs.push(JSON.parse(d.toString())); } catch (_e) {} });
    ws.on('close', c => { closeCode = c; });
    ws.on('open', () => resolve({ ws, msgs, opened: true, get closeCode() { return closeCode; } }));
    ws.on('unexpected-response', (_req, res) => resolve({ ws, msgs, opened: false, status: res.statusCode }));
    ws.on('error', () => {});
  });
}

(async () => {
  const tsxCli = require.resolve('tsx/cli');
  const hub = spawn(process.execPath, [tsxCli, path.resolve(__dirname, '../packages/mcp-server/src/' + (process.env.HUB_FILE || 'ws-hub.ts'))], {
    env: { ...process.env, WS_PORT: String(PORT), USERPROFILE: home, HOME: home },
    cwd: path.resolve(__dirname, '..'),
  });
  let out = '';
  hub.stdout.on('data', d => { out += d; });
  hub.stderr.on('data', d => { out += d; });
  for (let i = 0; i < 60 && !out.includes('Código de vinculación') && !out.includes('Hub en ejecución'); i++) await sleep(250);
  const code = (out.match(/vinculación para el plugin de Figma: ([A-Z0-9-]+)/) || [])[1];
  check('El hub muestra un código de vinculación', !!code, code);
  check('El código se guarda en ~/.code-to-figma/pairing-code',
    fs.existsSync(path.join(home, '.code-to-figma', 'pairing-code')));

  // 1. Página web cualquiera
  const evil = await connect('https://sitio-malicioso.example');
  check('Página web: rechazada en el handshake', !evil.opened && evil.status === 403, `HTTP ${evil.status}`);

  // 2. Origen "null" sin código (iframe sandbox de un atacante)
  const nul = await connect('null');
  nul.ws.send(JSON.stringify({ type: 'GET_VIEWS_CATALOG' }));
  nul.ws.send(JSON.stringify({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: 'x" & echo PWNED > "' + marker + '" & "' } }));
  await sleep(600);
  check('Origen "null" sin código: se le pide vincularse', nul.msgs.some(m => m.type === 'AUTH_REQUIRED'));
  check('Origen "null" sin código: no recibe catálogo ni respuestas', !nul.msgs.some(m => m.type === 'VIEWS_CATALOG' || m.type === 'RENDER_ERROR'));

  // 3. Plugin legítimo con el código correcto
  const plugin = await connect('null');
  plugin.ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: (code || 'SIN-CODIGO').toLowerCase() }));
  await sleep(400);
  check('Plugin con código correcto: AUTH_OK + catálogo', plugin.msgs.some(m => m.type === 'AUTH_OK') && plugin.msgs.some(m => m.type === 'VIEWS_CATALOG'));

  // 4. Extensión (service worker) envía un render → el plugin lo recibe
  const ext = await connect('chrome-extension://abcdefghijklmnopabcdefghijklmnop');
  ext.ws.send(JSON.stringify({ type: 'RENDER_NODES', payload: { rootNode: { id: 'n1', type: 'FRAME', name: 'Prueba', layout: {}, children: [] } } }));
  await sleep(400);
  check('Extensión: puede enviar renders', ext.opened);
  check('Plugin vinculado: recibe el render', plugin.msgs.some(m => m.type === 'RENDER_NODES' && m.payload.rootNode.name === 'Prueba'));
  check('Origen "null" sin código: NO recibe el render (no espía exportaciones)', !nul.msgs.some(m => m.type === 'RENDER_NODES'));

  // 4b. Payload malicioso desde un cliente autorizado: validado antes de llegar a Figma
  ext.ws.send(JSON.stringify({ type: 'RENDER_NODES', payload: { rootNode: { type: 'FRAME', name: 'Malicioso', children: [{ type: 'SVG', svgContent: '<svg><script>alert(1)</script></svg>' }] } } }));
  await sleep(400);
  check('Payload malicioso: el emisor recibe RENDER_ERROR', ext.msgs.some(m => m.type === 'RENDER_ERROR' && /script/i.test(m.error)));
  check('Payload malicioso: NO llega al plugin', !plugin.msgs.some(m => m.type === 'RENDER_NODES' && m.payload.rootNode.name === 'Malicioso'));

  // 5. Cliente local (CLI / MCP, sin Origin)
  const cli = await connect(undefined);
  cli.ws.send(JSON.stringify({ type: 'GET_STATUS' }));
  await sleep(300);
  const st = cli.msgs.find(m => m.type === 'STATUS_RESPONSE');
  check('Cliente local (CLI/MCP): funciona sin código', !!st && st.payload.figmaConnected === true);

  // 6. Inyección de comandos desde un cliente autenticado
  cli.ws.send(JSON.stringify({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: 'x" & echo PWNED > "' + marker + '" & "' } }));
  cli.ws.send(JSON.stringify({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: '../../../package' } }));
  cli.ws.send(JSON.stringify({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: 'dashboard', route: '/x"; calc; "' } }));
  await sleep(1500);
  const errs = cli.msgs.filter(m => m.type === 'RENDER_ERROR').map(m => m.error);
  check('Inyección de comandos en viewId: rechazada', errs.includes('viewId inválido'));
  check('Path traversal en viewId: rechazado', errs.filter(e => e === 'viewId inválido').length >= 2);
  check('Inyección en route: rechazada', errs.some(e => /route inválida|no está en el catálogo/.test(e)));
  check('Ningún comando inyectado se ejecutó', !fs.existsSync(marker));

  // 7. Fuerza bruta del código
  let locked = false;
  for (let i = 0; i < 7; i++) {
    const c = await connect('null');
    c.ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: 'AAAA-AAA' + i }));
    await sleep(150);
    if (c.msgs.some(m => m.type === 'AUTH_FAILED' && /Demasiados/.test(m.reason))) locked = true;
  }
  check('Fuerza bruta: bloqueo tras 5 intentos fallidos', locked);

  // 8. No escucha en otras interfaces de red
  const lanIp = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
  if (lanIp) {
    const lan = await new Promise(r => { const w = new WebSocket(`ws://${lanIp}:${PORT}`); w.on('open', () => { w.close(); r(true); }); w.on('error', () => r(false)); });
    check(`No accesible desde la red (${lanIp})`, !lan);
  }

  check('Sin captura de diagnóstico por defecto', !out.includes('CTF_DEBUG_CAPTURE=1'));

  for (const c of [nul, plugin, ext, cli]) { try { c.ws.close(); } catch (_e) {} }
  hub.kill();
  fs.rmSync(home, { recursive: true, force: true });
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
