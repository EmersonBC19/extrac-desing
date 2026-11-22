// Envío por partes (fase 5.1): el código real del service worker contra un hub real y un
// plugin de Figma simulado. Un render grande llega entero, con progreso; uno pequeño, de una pieza.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CHUNK_SIZE_CHARS, CHUNK_THRESHOLD_BYTES } from '../../packages/contracts/src/index';

const require = createRequire(import.meta.url);
const { startHub, connectClient, sleep } = require('../helpers/hub.cjs');
const { loadHubSender } = require('../helpers/code-loaders.cjs');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-chunks-'));
let hub: any;
let plugin: any;
const sender = loadHubSender();

const frame = (extra: Record<string, unknown> = {}) => ({
  id: 'raiz',
  name: 'Landing',
  type: 'FRAME',
  layout: { mode: 'NONE', width: 1440, height: 900 },
  styles: { fills: [] },
  children: [],
  ...extra,
});

beforeAll(async () => {
  hub = await startHub({ home });
  const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
  plugin = await connectClient(hub.url, 'null');
  plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code });
  await plugin.waitFor((m: any) => m.type === 'AUTH_OK');
});
afterAll(async () => {
  plugin?.close();
  await hub?.stop();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('envío por partes: service worker → hub → plugin', () => {
  it('las constantes del service worker coinciden con contracts', () => {
    expect(sender.CHUNK_THRESHOLD_BYTES).toBe(CHUNK_THRESHOLD_BYTES);
    expect(sender.CHUNK_SIZE_CHARS).toBe(CHUNK_SIZE_CHARS);
  });

  it('un render pequeño viaja de una pieza, sin mensajes de progreso', async () => {
    plugin.msgs.length = 0;
    const sent = await sender.sendToWebSocketHub({ rootNode: frame({ name: 'Chico' }) }, hub.url);
    expect(sent.parts).toBe(1);
    const render = await plugin.waitFor((m: any) => m.type === 'RENDER_NODES' && m.payload.rootNode.name === 'Chico');
    expect(render).toBeTruthy();
    expect(plugin.msgs.some((m: any) => m.type === 'RENDER_PROGRESS')).toBe(false);
  });

  it('un render de varios MB llega entero, con progreso hasta el 100 %', async () => {
    plugin.msgs.length = 0;
    // Imagen de 2,5 MB con emoji en el nombre (un par sustituto puede caer en el borde de una parte)
    const image = 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(230_000);
    const big = frame({
      name: 'Grande 😀'.repeat(50),
      children: [frame({ id: 'img', name: 'Foto', imageData: image })],
    });
    const sent = await sender.sendToWebSocketHub(
      { rootNode: big, board: true, source: { url: 'https://x.test', title: 'X' } },
      hub.url,
    );
    expect(sent.parts).toBeGreaterThan(4);

    const render = await plugin.waitFor((m: any) => m.type === 'RENDER_NODES', 10_000);
    expect(render.payload.rootNode.name).toBe(big.name);
    expect(render.payload.rootNode.children[0].imageData).toBe(image);
    expect(render.payload.board).toBe(true);

    const progress = plugin.msgs.filter((m: any) => m.type === 'RENDER_PROGRESS').map((m: any) => m.payload);
    expect(progress.length).toBe(sent.parts); // una por parte (la última anuncia el 100 %)
    expect(progress.at(-1)).toMatchObject({ received: sent.parts, total: sent.parts });
    expect(progress.map((p: any) => p.received)).toEqual(
      [...progress.map((p: any) => p.received)].sort((a, b) => a - b),
    );
  });

  it('partes que forman un JSON roto o un payload inválido: RENDER_ERROR y nada llega a Figma', async () => {
    const cli = await connectClient(hub.url);
    cli.send({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP' });
    plugin.msgs.length = 0;

    cli.send({ type: 'RENDER_CHUNK', transferId: 'roto', index: 0, total: 2, data: '{"type":"RENDER_NO' });
    cli.send({ type: 'RENDER_CHUNK', transferId: 'roto', index: 1, total: 2, data: 'DES",' });
    const err1 = await cli.waitFor((m: any) => m.type === 'RENDER_ERROR');
    expect(err1.error).toMatch(/corrupto/);

    const bad = JSON.stringify({ type: 'RENDER_NODES', payload: { rootNode: { id: 1 } } });
    cli.send({ type: 'RENDER_CHUNK', transferId: 'malo', index: 0, total: 2, data: bad.slice(0, 20) });
    cli.send({ type: 'RENDER_CHUNK', transferId: 'malo', index: 1, total: 2, data: bad.slice(20) });
    await sleep(300);
    const errors = cli.msgs.filter((m: any) => m.type === 'RENDER_ERROR');
    expect(errors.at(-1).error).toMatch(/Payload inválido/);
    expect(plugin.msgs.some((m: any) => m.type === 'RENDER_NODES')).toBe(false);
    cli.close();
  });
});

describe('el service worker no pierde campos del envío', () => {
  it('responsive (breakpoints y tema) y compare (QA de diseño) llegan al hub', () => {
    const variants = [{ name: 'Mobile', width: 375, rootNode: frame(), dark: frame() }];
    const msg = sender.buildRenderMessage({
      rootNode: frame(),
      responsive: { variants, themeSource: 'media' },
      compare: { targetNodeId: '1:2', width: 320 },
    });
    expect(msg.payload.responsive).toEqual({ variants, themeSource: 'media' });
    expect(msg.payload.compare).toEqual({ targetNodeId: '1:2', width: 320 });
  });
});
