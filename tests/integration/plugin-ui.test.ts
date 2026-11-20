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

async function openUi(saved: Record<string, unknown>): Promise<Page> {
  // Sin hub: un puerto cerrado (la UI reintenta en segundo plano, no afecta)
  const html = fs
    .readFileSync(path.join(ROOT, 'packages/figma-plugin/src/ui.html'), 'utf8')
    .replace("'ws://localhost:8080'", "'ws://127.0.0.1:9'");
  const file = path.join(tmp, `ui-${Date.now()}.html`);
  fs.writeFileSync(file, html);
  const page = await browser.newPage();
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
});
