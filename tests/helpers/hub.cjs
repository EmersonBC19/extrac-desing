// Arranca un hub real (packages/mcp-server/src/ws-hub.ts) aislado para pruebas:
// puerto libre y HOME temporal → no toca el hub ni el código de vinculación del usuario.
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const ROOT = path.resolve(__dirname, '../..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * opts.gitRef: arrancar la versión del hub de ese commit (para comparar con versiones antiguas)
 * Devuelve { port, url, home, code, output(), stop() }
 */
async function startHub(opts = {}) {
  const port = opts.port || (await freePort());
  const home = opts.home || fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-hub-'));
  let file = path.join(ROOT, 'packages/mcp-server/src/ws-hub.ts');
  let tempFile = null;
  if (opts.gitRef) {
    tempFile = path.join(ROOT, 'packages/mcp-server/src', `_ws-hub-${opts.gitRef.replace(/\W/g, '')}.ts`);
    fs.writeFileSync(tempFile, execSync(`git show ${opts.gitRef}:packages/mcp-server/src/ws-hub.ts`, { cwd: ROOT }));
    file = tempFile;
  }
  const proc = spawn(process.execPath, [require.resolve('tsx/cli'), file], {
    env: { ...process.env, WS_PORT: String(port), USERPROFILE: home, HOME: home, ...(opts.env || {}) },
    cwd: ROOT,
  });
  let out = '';
  proc.stdout.on('data', d => {
    out += d;
  });
  proc.stderr.on('data', d => {
    out += d;
  });
  for (let i = 0; i < 120 && !/vinculación para el plugin|Hub en ejecución/.test(out); i++) await sleep(250);
  if (!/vinculación para el plugin|Hub en ejecución/.test(out)) {
    proc.kill();
    throw new Error('El hub no arrancó:\n' + out);
  }
  const code = (out.match(/vinculación para el plugin de Figma: ([A-Z0-9-]+)/) || [])[1] || null;
  return {
    port,
    home,
    code,
    url: `ws://127.0.0.1:${port}`,
    output: () => out,
    async stop() {
      proc.kill();
      await sleep(150);
      if (tempFile) fs.rmSync(tempFile, { force: true });
      if (!opts.home) fs.rmSync(home, { recursive: true, force: true });
    },
  };
}

/**
 * Cliente de prueba. origin: undefined = proceso local (sin header Origin).
 * Devuelve { ws, msgs, opened, status, closeCode(), waitFor(pred, ms) }
 */
function connectClient(url, origin) {
  return new Promise(resolve => {
    const ws = new WebSocket(url, origin === undefined ? {} : { origin });
    const msgs = [];
    let closeCode = null;
    const client = {
      ws,
      msgs,
      opened: false,
      status: null,
      closeCode: () => closeCode,
      async waitFor(pred, ms = 2000) {
        for (let t = 0; t < ms; t += 50) {
          const m = msgs.find(pred);
          if (m) return m;
          await sleep(50);
        }
        return null;
      },
      send: obj => ws.send(JSON.stringify(obj)),
      close: () => {
        try {
          ws.close();
        } catch (_e) {}
      },
    };
    ws.on('message', d => {
      try {
        msgs.push(JSON.parse(d.toString()));
      } catch (_e) {}
    });
    ws.on('close', c => {
      closeCode = c;
    });
    ws.on('open', () => {
      client.opened = true;
      resolve(client);
    });
    ws.on('unexpected-response', (_req, res) => {
      client.status = res.statusCode;
      resolve(client);
    });
    ws.on('error', () => resolve(client));
  });
}

module.exports = { startHub, connectClient, freePort, sleep };
