import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const require = createRequire(import.meta.url);
const { startHub, connectClient, sleep } = require('../helpers/hub.cjs');
const WebSocket = require('ws');

let hub: any;
const marker = path.join(os.tmpdir(), `ctf-pwned-${process.pid}.txt`);
const injection = `x" & echo PWNED > "${marker}" & "`;

beforeAll(async () => { hub = await startHub(); });
afterAll(async () => { await hub?.stop(); fs.rmSync(marker, { force: true }); });

const frame = (name: string, extra: Record<string, unknown> = {}) => ({ id: 'r', type: 'FRAME', name, layout: {}, children: [], ...extra });

async function pairedPlugin() {
  const plugin = await connectClient(hub.url, 'null');
  plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: hub.code.toLowerCase() });
  await plugin.waitFor((m: any) => m.type === 'AUTH_OK');
  return plugin;
}

describe('hub WebSocket: autenticación y origen', () => {
  it('muestra un código de vinculación y lo persiste', () => {
    expect(hub.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(fs.readFileSync(path.join(hub.home, '.code-to-figma', 'pairing-code'), 'utf8').trim()).toBe(hub.code);
  });

  it('rechaza conexiones de páginas web en el handshake (403)', async () => {
    const evil = await connectClient(hub.url, 'https://sitio-malicioso.example');
    expect(evil.opened).toBe(false);
    expect(evil.status).toBe(403);
  });

  it('origen "null" sin código: se le pide vincularse y no recibe nada', async () => {
    const nul = await connectClient(hub.url, 'null');
    nul.send({ type: 'GET_VIEWS_CATALOG' });
    nul.send({ type: 'GET_STATUS' });
    await sleep(500);
    expect(nul.msgs.map((m: any) => m.type)).toEqual(['AUTH_REQUIRED']);
    nul.close();
  });

  it('plugin con el código correcto: AUTH_OK y catálogo', async () => {
    const plugin = await pairedPlugin();
    expect(await plugin.waitFor((m: any) => m.type === 'VIEWS_CATALOG')).toBeTruthy();
    plugin.close();
  });

  it('extensión → render → llega al plugin vinculado, no a un espía sin código', async () => {
    const plugin = await pairedPlugin();
    const spy = await connectClient(hub.url, 'null');
    const ext = await connectClient(hub.url, 'chrome-extension://abcdefghijklmnopabcdefghijklmnop');
    expect(ext.opened).toBe(true);
    ext.send({ type: 'RENDER_NODES', payload: { rootNode: frame('Prueba') } });
    expect(await plugin.waitFor((m: any) => m.type === 'RENDER_NODES' && m.payload.rootNode.name === 'Prueba')).toBeTruthy();
    await sleep(200);
    expect(spy.msgs.some((m: any) => m.type === 'RENDER_NODES')).toBe(false);
    for (const c of [plugin, spy, ext]) c.close();
  });

  it('payload malicioso de un cliente autorizado: RENDER_ERROR y no llega a Figma', async () => {
    const plugin = await pairedPlugin();
    const ext = await connectClient(hub.url, 'chrome-extension://abcdefghijklmnopabcdefghijklmnop');
    ext.send({ type: 'RENDER_NODES', payload: { rootNode: frame('Malicioso', { children: [{ type: 'SVG', svgContent: '<svg><script>alert(1)</script></svg>' }] }) } });
    const err = await ext.waitFor((m: any) => m.type === 'RENDER_ERROR');
    expect(err?.error).toMatch(/script/i);
    await sleep(200);
    expect(plugin.msgs.some((m: any) => m.type === 'RENDER_NODES' && m.payload.rootNode.name === 'Malicioso')).toBe(false);
    plugin.close(); ext.close();
  });

  it('cliente local (CLI/MCP, sin Origin) funciona sin código', async () => {
    const cli = await connectClient(hub.url, undefined);
    cli.send({ type: 'GET_STATUS' });
    expect(await cli.waitFor((m: any) => m.type === 'STATUS_RESPONSE')).toBeTruthy();
    cli.close();
  });
});

describe('hub WebSocket: inyección y abuso', () => {
  it('REQUEST_VIEW_RENDER: inyección de comandos, path traversal e inyección en route rechazadas; nada se ejecuta', async () => {
    const cli = await connectClient(hub.url, undefined);
    cli.send({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: injection } });
    cli.send({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: '../../../package' } });
    cli.send({ type: 'REQUEST_VIEW_RENDER', payload: { viewId: 'dashboard', route: '/x"; calc; "' } });
    await sleep(1500);
    const errors = cli.msgs.filter((m: any) => m.type === 'RENDER_ERROR').map((m: any) => m.error);
    expect(errors.filter((e: string) => e === 'viewId inválido')).toHaveLength(2);
    expect(errors.some((e: string) => /route inválida|no está en el catálogo/.test(e))).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
    cli.close();
  });

  it('fuerza bruta del código: bloqueo tras 5 intentos', async () => {
    let locked = false;
    for (let i = 0; i < 7 && !locked; i++) {
      const c = await connectClient(hub.url, 'null');
      c.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: `ZZZZ-ZZZ${i}` });
      const r = await c.waitFor((m: any) => m.type === 'AUTH_FAILED', 1000);
      if (r && /Demasiados/.test(r.reason)) locked = true;
    }
    expect(locked).toBe(true);
  });

  it('no escucha en otras interfaces de red', async () => {
    const lanIp = Object.values(os.networkInterfaces()).flat().find((i: any) => i && i.family === 'IPv4' && !i.internal)?.address;
    if (!lanIp) return; // equipo sin red: nada que comprobar
    const reachable = await new Promise<boolean>((resolve) => {
      const w = new WebSocket(`ws://${lanIp}:${hub.port}`);
      w.on('open', () => { w.close(); resolve(true); });
      w.on('error', () => resolve(false));
    });
    expect(reachable).toBe(false);
  });

  it('no guarda capturas de diagnóstico por defecto', () => {
    expect(hub.output()).not.toMatch(/CTF_DEBUG_CAPTURE=1/);
  });
});
