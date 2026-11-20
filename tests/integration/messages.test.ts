// Catálogo de mensajes (contracts/messages.ts) ↔ manejadores reales: cada mensaje que un componente
// puede recibir tiene quien lo atienda, y los nombres de la red coinciden en ambos extremos.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HubInboundSchema, MESSAGE_CATALOG, messageTypesOf } from '../../packages/contracts/src/index';

const require = createRequire(import.meta.url);
const { loadPlugin } = require('../helpers/figma-mock.cjs');
const { startHub, connectClient } = require('../helpers/hub.cjs');
const { read } = require('../helpers/code-loaders.cjs');

/** Claves de un objeto literal `const NOMBRE = { CLAVE(...) / CLAVE: ... }` en código fuente */
function handlerKeys(src: string, tableName: string): string[] {
  const start = src.indexOf(`const ${tableName} = {`);
  if (start < 0) throw new Error(`no se encontró ${tableName}`);
  const body = src.slice(start, src.indexOf('\n    };', start) >= 0 ? src.indexOf('\n    };', start) : src.indexOf('\n};', start));
  return [...body.matchAll(/^\s{2,6}([A-Z][A-Z0-9_]+)\s*(?:\(|:)/gm)].map(m => m[1]);
}

describe('catálogo de mensajes', () => {
  it('todo mensaje del catálogo tiene canal, tipo CQRS y ruta', () => {
    for (const [type, info] of Object.entries(MESSAGE_CATALOG)) {
      expect(['hub', 'plugin', 'extension'], type).toContain(info.channel);
      expect(['command', 'query', 'event'], type).toContain(info.kind);
      expect(info.route, type).toMatch(/→/);
    }
  });

  it('hub: acepta (esquema) todo mensaje que un cliente le envía', () => {
    const inbound = messageTypesOf('hub', /→ hub/);
    expect(inbound.length).toBeGreaterThan(5);
    for (const type of inbound) {
      const extra = type === 'RENDER_NODES' ? { payload: {} } : {};
      expect(HubInboundSchema.safeParse({ type, ...extra }).success, type).toBe(true);
    }
    expect(HubInboundSchema.safeParse({ type: 'RENDER_COMPLETED' }).success).toBe(false);
  });

  it('UI del plugin: atiende todo mensaje que le manda el hub', () => {
    const keys = handlerKeys(read('packages/figma-plugin/src/ui.html'), 'HUB_HANDLERS');
    const fromHub = messageTypesOf('hub', /hub →|→ hub → plugin/);
    for (const type of fromHub) expect(keys, type).toContain(type);
  });

  it('UI del plugin: atiende todo mensaje del sandbox', () => {
    const keys = handlerKeys(read('packages/figma-plugin/src/ui.html'), 'SANDBOX_HANDLERS');
    for (const type of messageTypesOf('plugin', /^sandbox → UI/)) expect(keys, type).toContain(type);
    for (const type of ['RENDER_SUCCESS', 'RENDER_ERROR']) expect(keys, type).toContain(type);
  });

  it('service worker: atiende todo mensaje del content script', () => {
    const src = read('packages/browser-extension/background.js');
    const start = src.indexOf('const MESSAGE_HANDLERS = {');
    const body = src.slice(start, src.indexOf('\n};', start));
    const keys = [...body.matchAll(/^\s{2}([A-Z][A-Z0-9_]+)\s*:/gm)].map(m => m[1]);
    expect(keys.sort()).toEqual(messageTypesOf('extension').sort());
  });

  it('sandbox del plugin: atiende todo mensaje de la UI y avisa los desconocidos', async () => {
    const warnings: string[] = [];
    const quiet = { ...console, log() {}, warn: (...a: unknown[]) => warnings.push(a.join(' ')), error() {} };
    const figma = loadPlugin({}, quiet);
    const sample: Record<string, object> = {
      DELETE_NODE: { nodeId: 'x' }, DELETE_MULTIPLE_NODES: { nodeIds: [] }, CONVERT_TO_COMPONENT: { nodeId: 'x' },
      FOCUS_NODE: { nodeId: 'x' }, SET_PAIRING_CODE: { code: 'ABC123' }, RENDER_NODES: { payload: null },
    };
    const types = [...messageTypesOf('plugin', /^UI → sandbox/), 'RENDER_NODES'];
    for (const type of types) await figma.ui.onmessage({ type, ...(sample[type] || {}) });
    expect(warnings.filter(w => /desconocido/.test(w))).toEqual([]);

    // el código guardado se puede leer de vuelta
    await figma.ui.onmessage({ type: 'GET_PAIRING_CODE' });
    expect(figma.logs).toContainEqual({ type: 'PAIRING_CODE', code: 'ABC123' });
    // un payload vacío responde RENDER_ERROR, no revienta
    expect(figma.logs.some((m: any) => m.type === 'RENDER_ERROR')).toBe(true);

    await figma.ui.onmessage({ type: 'NO_EXISTE' });
    expect(warnings.some(w => /desconocido/.test(w) && /NO_EXISTE/.test(w))).toBe(true);
  });
});

describe('resultado del render: plugin → hub → CLI/MCP', () => {
  it('RENDER_SUCCESS y RENDER_ERROR del plugin llegan al cliente que pidió el render', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-msg-'));
    const hub = await startHub({ home });
    try {
      const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
      const plugin = await connectClient(hub.url, 'null');
      plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code });
      await plugin.waitFor((m: any) => m.type === 'AUTH_OK');

      const cli = await connectClient(hub.url);
      cli.send({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP' });

      plugin.send({ type: 'RENDER_SUCCESS', nodeId: '1:2', name: 'Hero', durationMs: 42 });
      const ok = await cli.waitFor((m: any) => m.type === 'RENDER_SUCCESS');
      expect(ok).toMatchObject({ nodeId: '1:2', name: 'Hero', durationMs: 42 });

      plugin.send({ type: 'RENDER_ERROR', error: 'fuente no disponible' });
      const err = await cli.waitFor((m: any) => m.type === 'RENDER_ERROR');
      expect(err.error).toBe('fuente no disponible');

      plugin.close();
      cli.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
