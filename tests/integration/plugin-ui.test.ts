// UI del plugin (ui.html) en Chromium: ajustes guardados en el sandbox y su efecto en los renders.
// El sandbox (code.ts) se simula capturando los postMessage hacia "parent".
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

const require = createRequire(import.meta.url);
const { ROOT } = require('../helpers/extension-sim.cjs');

let browser: Browser;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-ui2-'));
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** fakeHub: un socket "abierto" que guarda lo que la UI envía al hub en window.__wsSent */
async function openUi(saved: Record<string, unknown>, fakeHub = false): Promise<Page> {
  // Sin hub: un puerto cerrado (la UI reintenta en segundo plano, no afecta)
  const html = fs
    .readFileSync(path.join(ROOT, 'packages/figma-plugin/src/ui.html'), 'utf8')
    .replace("'ws://localhost:8080'", "'ws://127.0.0.1:9'");
  const file = path.join(tmp, `ui-${Date.now()}.html`);
  fs.writeFileSync(file, html);
  const page = await browser.newPage();
  if (fakeHub) {
    await page.addInitScript(() => {
      const w = window as any;
      w.__wsSent = [];
      w.WebSocket = class {
        static CONNECTING = 0;
        static OPEN = 1;
        readyState = 1;
        onopen: any = null;
        constructor() {
          setTimeout(() => this.onopen && this.onopen());
        }
        send(d: string) {
          w.__wsSent.push(JSON.parse(d));
        }
        close() {}
      };
    });
  }
  await page.addInitScript((saved: any) => {
    (window as any).__toSandbox = [];
    const orig = window.postMessage.bind(window);
    (window as any).postMessage = (data: any, origin: any) => {
      const m = data && data.pluginMessage;
      if (!m) return orig(data, origin);
      (window as any).__toSandbox.push(m);
      // Sandbox simulado: devuelve los ajustes guardados
      if (m.type === 'GET_SETTINGS')
        setTimeout(() =>
          window.dispatchEvent(
            new MessageEvent('message', { data: { pluginMessage: { type: 'SETTINGS', settings: saved } } }),
          ),
        );
    };
  }, saved);
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(200);
  return page;
}

const sentRender = (page: Page) =>
  page
    .waitForFunction(() => (window as any).__toSandbox.find((m: any) => m.type === 'RENDER_NODES'))
    .then(h => h.jsonValue());

const hubRender = (page: Page, payload: any) =>
  page.evaluate(p => (window as any).handleWebSocketMessage({ type: 'RENDER_NODES', payload: p }), payload);

const ROOT_NODE = {
  id: 'r',
  name: 'Raíz',
  type: 'FRAME',
  layout: { mode: 'NONE', width: 10, height: 10 },
  styles: { fills: [] },
};

describe('ajustes del plugin', () => {
  it('"Tablero: nunca" manda sobre lo que propone la extensión; las equivalencias de fuentes viajan', async () => {
    const page = await openUi({ boardMode: 'NEVER', fontMap: { Circular: 'Inter' } });
    expect(await page.evaluate(() => (document.querySelector('input[name="optBoard"]:checked') as any).value)).toBe(
      'NEVER',
    );
    expect(await page.evaluate(() => (document.getElementById('txtFontMap') as any).value)).toBe('Circular = Inter');
    await hubRender(page, { rootNode: ROOT_NODE, board: true });
    const m: any = await sentRender(page);
    expect(m.payload.board).toBe(false);
    expect(m.payload.fontMap).toEqual({ Circular: 'Inter' });
    await page.close();
  });

  it('"Tablero: siempre" lo activa aunque la extensión no lo pida', async () => {
    const page = await openUi({ boardMode: 'ALWAYS' });
    await hubRender(page, { rootNode: ROOT_NODE, board: false });
    expect(((await sentRender(page)) as any).payload.board).toBe(true);
    await page.close();
  });

  it('automático: respeta lo que propone la extensión', async () => {
    const page = await openUi({});
    await hubRender(page, { rootNode: ROOT_NODE, board: true });
    expect(((await sentRender(page)) as any).payload.board).toBe(true);
    await page.close();
  });

  it('cambiar una opción la guarda en el sandbox (SET_SETTINGS)', async () => {
    const page = await openUi({});
    await page.evaluate(() => {
      const r = document.querySelector('input[name="optBoard"][value="ALWAYS"]') as HTMLInputElement;
      r.checked = true;
      r.dispatchEvent(new Event('change'));
    });
    const set = await page.evaluate(() =>
      (window as any).__toSandbox.filter((m: any) => m.type === 'SET_SETTINGS').at(-1),
    );
    expect(set.settings).toMatchObject({ boardMode: 'ALWAYS' });
    await page.close();
  });

  it('el progreso de un envío por partes avanza en un solo renglón del registro', async () => {
    const page = await openUi({});
    const lines = () => page.evaluate(() => document.querySelectorAll('.log-line').length);
    const before = await lines();
    for (const received of [1, 2, 3]) {
      await page.evaluate(
        r =>
          (window as any).handleWebSocketMessage({
            type: 'RENDER_PROGRESS',
            payload: { transferId: 't1', received: r, total: 3, bytes: r * 524288 },
          }),
        received,
      );
    }
    expect((await lines()) - before).toBe(1);
    const text = await page.evaluate(() => [...document.querySelectorAll('.log-line')].at(-1)!.textContent);
    expect(text).toMatch(/recibido: 1\.5 MB en 3 partes/);
    await page.close();
  });

  it('QA-12: el historial llega del sandbox; borrar un tablero manda todas sus capas', async () => {
    const page = await openUi({});
    await page.evaluate(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            pluginMessage: {
              type: 'HISTORY',
              items: [
                {
                  id: '1:2',
                  name: 'Landing',
                  nodeIds: ['1:1', '1:2', '1:3', '1:4'],
                  timestamp: '2026-11-20T10:00:00Z',
                },
              ],
            },
          },
        }),
      ),
    );
    expect(await page.evaluate(() => document.getElementById('badgeReceiverCount')!.textContent)).toBe('1');
    await page.evaluate(() => (window as any).deleteInboxItem('1:2'));
    const del = await page.evaluate(() =>
      (window as any).__toSandbox.filter((m: any) => m.type === 'DELETE_MULTIPLE_NODES').at(-1),
    );
    expect(del.nodeIds).toEqual(['1:1', '1:2', '1:3', '1:4']);
    const saved = await page.evaluate(() =>
      (window as any).__toSandbox.filter((m: any) => m.type === 'SET_HISTORY').at(-1),
    );
    expect(saved.items).toEqual([]);
    await page.close();
  });

  it('escaneo: la consulta de rutas del hub va al sandbox y su respuesta vuelve al hub', async () => {
    const page = await openUi({}, true);
    // la UI se conecta al hub poco después de abrir (se registra al conectar)
    await page.waitForFunction(() => (window as any).__wsSent.length > 0);
    await page.evaluate(() =>
      (window as any).handleWebSocketMessage({
        type: 'GET_FIGMA_ROUTES',
        requestId: 'r7',
        origin: 'https://ejemplo.com',
      }),
    );
    const ask = await page.evaluate(() => (window as any).__toSandbox.find((m: any) => m.type === 'GET_ROUTES'));
    expect(ask).toEqual({ type: 'GET_ROUTES', requestId: 'r7', origin: 'https://ejemplo.com' });
    const routes = [{ url: 'https://ejemplo.com/precios', path: '/precios' }];
    await page.evaluate(
      r =>
        window.dispatchEvent(
          new MessageEvent('message', { data: { pluginMessage: { type: 'ROUTES_INFO', requestId: 'r7', routes: r } } }),
        ),
      routes,
    );
    const sent = await page.evaluate(() => (window as any).__wsSent.filter((m: any) => m.type === 'FIGMA_ROUTES'));
    expect(sent).toEqual([{ type: 'FIGMA_ROUTES', requestId: 'r7', routes }]);
    await page.close();
  });

  it('escaneo: el fin va al sandbox después de la última página y respeta "Tablero: nunca"', async () => {
    for (const [saved, board] of [
      [{}, true],
      [{ boardMode: 'NEVER' }, false],
    ] as const) {
      const page = await openUi(saved);
      // La página trae una imagen que hay que normalizar (asíncrono): el fin llega justo después
      const img =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      await page.evaluate(
        ({ root, img }) => {
          const w = window as any;
          w.handleWebSocketMessage({
            type: 'RENDER_NODES',
            payload: {
              rootNode: { ...root, imageData: img },
              board: true,
              scan: { id: 's9', index: 0, total: 1, path: '/a' },
            },
          });
          w.handleWebSocketMessage({ type: 'SCAN_FINISH', scanId: 's9', count: 1 });
        },
        { root: ROOT_NODE, img },
      );
      await page.waitForFunction(() => (window as any).__toSandbox.some((m: any) => m.type === 'SCAN_FINISH'));
      const seq = await page.evaluate(() =>
        (window as any).__toSandbox.filter((m: any) => m.type === 'RENDER_NODES' || m.type === 'SCAN_FINISH'),
      );
      expect(seq.map((m: any) => m.type)).toEqual(['RENDER_NODES', 'SCAN_FINISH']);
      expect(seq[0].payload.board).toBe(false); // una página del escaneo nunca arma tablero sola
      // pero sabe si habrá tablero al final: entonces el sandbox la guarda como marcador, sin dibujarla
      expect(seq[0].payload.scan).toMatchObject({ id: 's9', board });
      expect(seq[1]).toMatchObject({ scanId: 's9', board });
      await page.close();
    }
  });
});
