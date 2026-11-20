// Flujo de vinculación del plugin (ui.html) contra un hub real. ui.html se carga como file://,
// así el navegador envía Origin: null igual que el iframe de Figma. code.ts se simula
// (GET/SET_PAIRING_CODE sobre un almacenamiento en memoria).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

const require = createRequire(import.meta.url);
const { startHub, connectClient, sleep } = require('../helpers/hub.cjs');
const { ROOT } = require('../helpers/extension-sim.cjs');

let browser: Browser;
let hub: any;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-ui-'));

beforeAll(async () => {
  browser = await chromium.launch();
  hub = await startHub();
});
afterAll(async () => {
  await browser?.close();
  await hub?.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function openPlugin(port: number, store: { code?: string }): Promise<Page> {
  const html = fs
    .readFileSync(path.join(ROOT, 'packages/figma-plugin/src/ui.html'), 'utf8')
    .replace("'ws://localhost:8080'", `'ws://localhost:${port}'`);
  const file = path.join(tmp, `ui-${port}-${Date.now()}.html`);
  fs.writeFileSync(file, html);
  const page = await browser.newPage();
  await page.exposeFunction('__store', (op: string, v: string) => {
    if (op === 'set') store.code = v;
    return store.code || '';
  });
  await page.addInitScript(() => {
    (window as any).__sent = [];
    const orig = window.postMessage.bind(window);
    (window as any).postMessage = (data: any, origin: any) => {
      const m = data && data.pluginMessage;
      if (!m) return orig(data, origin);
      if (m.type === 'GET_PAIRING_CODE')
        (window as any)
          .__store('get')
          .then((code: string) =>
            window.dispatchEvent(
              new MessageEvent('message', { data: { pluginMessage: { type: 'PAIRING_CODE', code } } }),
            ),
          );
      else if (m.type === 'SET_PAIRING_CODE') (window as any).__store('set', m.code);
      else (window as any).__sent.push(m.type);
    };
  });
  await page.goto(pathToFileURL(file).href);
  return page;
}

const bannerVisible = (page: Page) =>
  page.evaluate(() => document.getElementById('pairingBanner')!.classList.contains('visible'));

async function figmaConnected(port: number): Promise<boolean> {
  const c = await connectClient(`ws://127.0.0.1:${port}`, undefined);
  c.send({ type: 'GET_STATUS' });
  const r = await c.waitFor((m: any) => m.type === 'STATUS_RESPONSE');
  c.close();
  return !!r?.payload.figmaConnected;
}

describe('vinculación del plugin con el hub', () => {
  const store: { code?: string } = {};

  it('primera vez: pide el código, no recibe renders y no reintenta en bucle', async () => {
    const page = await openPlugin(hub.port, store);
    await sleep(1500);
    expect(await bannerVisible(page)).toBe(true);
    expect(await figmaConnected(hub.port)).toBe(false);
    await sleep(10_500); // el hub cierra por tiempo de vinculación (4401)
    expect(hub.output()).not.toMatch(/Código de vinculación incorrecto/); // sin intentos fallidos automáticos
    expect(await bannerVisible(page)).toBe(true);

    // código incorrecto → error visible
    await page.fill('#pairingInput', 'ABCD-EFGH');
    await page.click('.pairing-row button');
    await sleep(1200);
    expect(await page.textContent('#pairingError')).toMatch(/incorrecto/i);

    // código correcto (en minúsculas y sin guion) → vinculado
    await page.fill('#pairingInput', hub.code.toLowerCase().replace('-', ''));
    await page.click('.pairing-row button');
    await sleep(1500);
    expect(await bannerVisible(page)).toBe(false);
    expect(store.code).toBe(hub.code);
    expect(await figmaConnected(hub.port)).toBe(true);

    // un render del hub llega a Figma
    const cli = await connectClient(hub.url, undefined);
    cli.send({
      type: 'RENDER_NODES',
      payload: { rootNode: { id: 'r', type: 'FRAME', name: 'DesdeElHub', layout: {}, children: [] } },
    });
    await sleep(800);
    cli.close();
    expect(await page.evaluate(() => (window as any).__sent)).toContain('RENDER_NODES');
    await page.close();
  });

  it('reapertura con el código guardado: conecta sin pedirlo', async () => {
    const page = await openPlugin(hub.port, store);
    await sleep(1800);
    expect(await bannerVisible(page)).toBe(false);
    expect(await figmaConnected(hub.port)).toBe(true);
    await page.close();
  });

  it('compatibilidad: con un hub anterior a la vinculación conecta sin pedir código', async () => {
    const old = await startHub({ gitRef: 'aa0edfe~1' }); // versión del hub previa a la fase 1 (sin vinculación)
    try {
      expect(old.code).toBeNull();
      const page = await openPlugin(old.port, {});
      await sleep(1800);
      expect(await bannerVisible(page)).toBe(false);
      expect(await figmaConnected(old.port)).toBe(true);
      await page.close();
    } finally {
      await old.stop();
    }
  });
});
