// Catálogo de mensajes (contracts/messages.ts) ↔ manejadores reales: cada mensaje que un componente
// puede recibir tiene quien lo atienda, y los nombres de la red coinciden en ambos extremos.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HUB_PROTOCOL, HubInboundSchema, MESSAGE_CATALOG, messageTypesOf } from '../../packages/contracts/src/index';

const require = createRequire(import.meta.url);
const { loadPlugin } = require('../helpers/figma-mock.cjs');
const { startHub, connectClient } = require('../helpers/hub.cjs');
const { read } = require('../helpers/code-loaders.cjs');

/** Claves de un objeto literal `const NOMBRE = { CLAVE(...) / CLAVE: ... }` en código fuente */
function handlerKeys(src: string, tableName: string): string[] {
  const start = src.indexOf(`const ${tableName} = {`);
  if (start < 0) throw new Error(`no se encontró ${tableName}`);
  const body = src.slice(
    start,
    src.indexOf('\n    };', start) >= 0 ? src.indexOf('\n    };', start) : src.indexOf('\n};', start),
  );
  return [...body.matchAll(/^\s{2,6}([A-Z][A-Z0-9_]+)\s*(?:\(|:)/gm)].map(m => m[1]);
}

describe('versión del protocolo', () => {
  it('la UI del plugin y el service worker anuncian la misma versión que el contrato', () => {
    for (const file of ['packages/figma-plugin/src/ui.html', 'packages/browser-extension/background.js']) {
      const m = read(file).match(/const HUB_PROTOCOL = (\d+);/);
      expect(m && Number(m[1]), file).toBe(HUB_PROTOCOL);
    }
    // Cada registro del plugin la envía
    const ui = read('packages/figma-plugin/src/ui.html');
    expect(ui.match(/clientType: 'FIGMA_PLUGIN',\s+protocol: HUB_PROTOCOL,/g)).toHaveLength(
      ui.match(/clientType: 'FIGMA_PLUGIN'/g)!.length,
    );
  });
});

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
      const samples: Record<string, object> = {
        RENDER_NODES: { payload: {} },
        RENDER_CHUNK: { transferId: 't', index: 0, total: 1, data: '{}' },
        SCAN_FINISH: { scanId: 's', count: 1 },
        CLIENT_LOG: { source: 'plugin', level: 'warn', message: 'aviso' },
        GET_FIGMA_ROUTES: { origin: 'https://ejemplo.com' },
      };
      const extra = samples[type] || {};
      expect(HubInboundSchema.safeParse({ type, ...extra }).success, type).toBe(true);
    }
    expect(HubInboundSchema.safeParse({ type: 'RENDER_COMPLETED' }).success).toBe(false);
  });

  it('UI del plugin: atiende todo mensaje que le manda el hub', () => {
    const keys = handlerKeys(read('packages/figma-plugin/src/ui.html'), 'HUB_HANDLERS');
    // Lo que sale del propio plugin (FIGMA_SELECTION: plugin → hub → extensión) no necesita manejador
    const fromHub = messageTypesOf('hub', /hub →|→ hub → plugin/).filter(
      t => !/^plugin →/.test((MESSAGE_CATALOG as any)[t].route),
    );
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
    // Lo que el service worker RECIBE (SCAN_PROGRESS va al revés: del service worker al inspector)
    expect(keys.sort()).toEqual(messageTypesOf('extension', /→ service worker/).sort());
  });

  it('inspector: atiende lo que le envía el service worker (avance del escaneo)', () => {
    const src = read('packages/browser-extension/content.js');
    for (const type of messageTypesOf('extension', /^service worker →/)) expect(src, type).toContain(`'${type}'`);
  });

  it('escaneo: la lista de enlaces peligrosos es la misma en el service worker y en el extractor', () => {
    const pick = (src: string, name: string) => src.slice(src.indexOf(name)).split(/\r?\n/)[1].trim();
    const bg = pick(read('packages/browser-extension/background.js'), 'const SCAN_DANGEROUS =');
    const ex = pick(read('packages/core-extractor/src/browser/site-routes.ts'), 'const DANGEROUS =');
    expect(bg.replace(/;$/, '')).toBe(ex.replace(/;$/, ''));
  });

  it('sandbox del plugin: atiende todo mensaje de la UI y avisa los desconocidos', async () => {
    const warnings: string[] = [];
    const quiet = { ...console, log() {}, warn: (...a: unknown[]) => warnings.push(a.join(' ')), error() {} };
    const figma = loadPlugin({}, quiet);
    const sample: Record<string, object> = {
      DELETE_NODE: { nodeId: 'x' },
      DELETE_MULTIPLE_NODES: { nodeIds: [] },
      CONVERT_TO_COMPONENT: { nodeId: 'x' },
      FOCUS_NODE: { nodeId: 'x' },
      SET_PAIRING_CODE: { code: 'ABC123' },
      SET_SETTINGS: { settings: { placement: 'BELOW', fontMap: { Circular: 'Inter' } } },
      RENDER_NODES: { payload: null },
    };
    const types = [...messageTypesOf('plugin', /^UI → sandbox/), 'RENDER_NODES'];
    for (const type of types) await figma.ui.onmessage({ type, ...(sample[type] || {}) });
    expect(warnings.filter(w => /desconocido/.test(w))).toEqual([]);

    // el código guardado se puede leer de vuelta
    await figma.ui.onmessage({ type: 'GET_PAIRING_CODE' });
    expect(figma.logs).toContainEqual({ type: 'PAIRING_CODE', code: 'ABC123' });
    // los ajustes se guardan en clientStorage y vuelven igual
    await figma.ui.onmessage({ type: 'GET_SETTINGS' });
    expect(figma.logs).toContainEqual({
      type: 'SETTINGS',
      settings: { placement: 'BELOW', fontMap: { Circular: 'Inter' } },
    });
    await figma.ui.onmessage({ type: 'RESIZE_UI', width: 304, height: 54 });
    expect((figma.ui as any).size).toEqual({ width: 304, height: 54 });
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

  it('QA-11: un plugin que se conecta (o reabre) después de un render NO lo vuelve a recibir', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-msg2-'));
    const hub = await startHub({ home });
    try {
      const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
      const pair = async () => {
        const p = await connectClient(hub.url, 'null');
        p.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code });
        await p.waitFor((m: any) => m.type === 'AUTH_OK');
        return p;
      };
      const first = await pair();
      const ext = await connectClient(hub.url);
      ext.send({ type: 'RENDER_NODES', payload: { rootNode: { id: 'r', type: 'FRAME', name: 'Hero', children: [] } } });
      await first.waitFor((m: any) => m.type === 'RENDER_NODES');
      first.close(); // se cierra el plugin…
      const reopened = await pair(); // …y se vuelve a abrir
      await new Promise(r => setTimeout(r, 400));
      expect(reopened.msgs.some((m: any) => m.type === 'RENDER_NODES')).toBe(false);
      reopened.close();
      ext.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('CLIENT_LOG: los avisos del plugin y la extensión quedan en ~/.code-to-figma/hub.log', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-log-'));
    // Fuera de las pruebas (sin VITEST) el hub escribe siempre su log en la carpeta del usuario
    const hub = await startHub({ home, env: { VITEST: '' } });
    try {
      const ext = await connectClient(hub.url);
      ext.send({
        type: 'CLIENT_LOG',
        source: 'extension',
        level: 'error',
        message: 'Escaneo: falló la página 2',
        context: 'sitio: https://x.test',
      });
      ext.send({ type: 'CLIENT_LOG', source: 'plugin', level: 'warn', message: 'Fuente sustituida' });
      const file = path.join(home, '.code-to-figma', 'hub.log');
      let text = '';
      for (let i = 0; i < 40 && !/Fuente sustituida/.test(text); i++) {
        await new Promise(r => setTimeout(r, 100));
        text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      }
      expect(text).toMatch(/\[extension\] Escaneo: falló la página 2/);
      expect(text).toMatch(/sitio: https:\/\/x\.test/);
      expect(text).toMatch(/\[plugin\] Fuente sustituida/);
      ext.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('SCAN_FINISH de la extensión llega a los plugins conectados', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-scan-'));
    const hub = await startHub({ home });
    try {
      const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
      const plugin = await connectClient(hub.url, 'null');
      plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code });
      await plugin.waitFor((m: any) => m.type === 'AUTH_OK');
      const ext = await connectClient(hub.url);
      ext.send({ type: 'SCAN_FINISH', scanId: 'scan_1', count: 3, source: { url: 'https://x.test/' } });
      const got = await plugin.waitFor((m: any) => m.type === 'SCAN_FINISH');
      expect(got).toMatchObject({ scanId: 'scan_1', count: 3, source: { url: 'https://x.test/' } });
      plugin.close();
      ext.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
