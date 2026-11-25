// Escaneo del sitio desde el inspector (content.js): lista de rutas, confirmación, avance y cancelación.
// chrome.runtime se simula: se capturan los mensajes al service worker y se le inyecta el avance.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import type { Page } from 'playwright';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { read } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });

/** figma: lo que responde el service worker a QUERY_FIGMA_ROUTES (rutas relativas a la página) */
async function openAt(path: string, figma?: { inFigma?: string[]; reason?: string }): Promise<Page> {
  const page = await B.page(path);
  await page.evaluate(figma => {
    const w = window as any;
    w.__figmaRoutes = figma
      ? figma.inFigma
        ? { routes: figma.inFigma.map(r => ({ url: new URL(r, location.href).href, path: r })) }
        : { routes: null, reason: figma.reason }
      : null;
    w.__toWorker = [];
    w.__listeners = [];
    w.chrome = {
      runtime: {
        id: 'extension-de-prueba',
        lastError: null,
        onMessage: {
          addListener: (f: any) => w.__listeners.push(f),
          removeListener: (f: any) => (w.__listeners = w.__listeners.filter((x: any) => x !== f)),
        },
        sendMessage(m: any, cb: any) {
          w.__toWorker.push(m);
          if (!cb) return;
          if (m.type === 'SCAN_START') cb({ success: true, scanId: 'scan_t', total: m.routes.length });
          else if (m.type === 'QUERY_FIGMA_ROUTES' && w.__figmaRoutes) cb({ success: true, ...w.__figmaRoutes });
          else cb({ success: true, status: { hubRunning: true, figmaConnected: true, figmaCount: 1 } });
        },
      },
    };
    // El service worker avisa el avance a la pestaña
    w.__progress = (m: any) => w.__listeners.forEach((f: any) => f({ type: 'SCAN_PROGRESS', scanId: 'scan_t', ...m }));
  }, figma);
  await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/extractor.js'));
  await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/content.js'));
  return page;
}

const shadowText = (page: Page) => page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.textContent);
const dialogOpen = (page: Page) =>
  page.waitForFunction(() => (window as any).__codeToFigmaInstance.shadow.querySelector('.scan-dialog'));

describe('escanear el sitio desde el inspector', () => {
  it('tecla S: lista de rutas con las excluidas a la vista; confirmar envía solo las elegidas', async () => {
    const page = await openAt('synthetic/scan/index.html');
    await page.keyboard.press('s');
    await dialogOpen(page);
    const info = await page.evaluate(() => {
      const sh = (window as any).__codeToFigmaInstance.shadow;
      return {
        paths: [...sh.querySelectorAll('.scan-route .scan-path')].map((e: any) => e.textContent),
        excluded: sh.querySelector('.scan-excluded summary')?.textContent,
        button: sh.querySelector('#__scan_go').textContent,
      };
    });
    expect(info.paths.length).toBe(4); // inicio, precios, lento y blog (agrupado)
    expect(info.excluded).toMatch(/1 enlaces excluidos/);
    expect(info.button).toBe('Escanear 4 páginas');
    // desmarcar una y confirmar
    await page.evaluate(() => {
      const sh = (window as any).__codeToFigmaInstance.shadow;
      const box = sh.querySelectorAll('.scan-route input')[1];
      box.checked = false;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      sh.querySelector('#__scan_go').click();
    });
    const start = await page.waitForFunction(() =>
      (window as any).__toWorker.find((m: any) => m.type === 'SCAN_START'),
    );
    const msg: any = await start.jsonValue();
    expect(msg.routes).toHaveLength(3);
    expect(msg.routes.some((r: any) => /precios/.test(r.path))).toBe(false);
    expect(msg.routes.every((r: any) => !/logout/.test(r.url))).toBe(true);
  });

  it('el avance se ve en un panel; al terminar, un resumen; cancelar avisa al service worker', async () => {
    const page = await openAt('synthetic/scan/index.html');
    await page.keyboard.press('s');
    await dialogOpen(page);
    await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('#__scan_go').click());
    await page.waitForFunction(() => (window as any).__codeToFigmaInstance.scanPanel);
    await page.evaluate(() => (window as any).__progress({ status: 'page', index: 1, total: 4, path: '/precios' }));
    expect(await shadowText(page)).toMatch(/Escaneando 2 de 4 · \/precios/);
    await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('#__scan_cancel').click());
    const cancel = await page.evaluate(() => (window as any).__toWorker.some((m: any) => m.type === 'SCAN_CANCEL'));
    expect(cancel).toBe(true);
    await page.evaluate(() => (window as any).__progress({ status: 'error', index: 2, total: 4, path: '/lento' }));
    await page.evaluate(() => (window as any).__progress({ status: 'cancelled', sent: 2, total: 4 }));
    const text = await shadowText(page);
    expect(text).toMatch(/Escaneo cancelado/);
    expect(text).toMatch(/2 de 4 páginas enviadas a Figma \(1 con error\)/);
    expect(await page.evaluate(() => (window as any).__codeToFigmaInstance.scanPanel)).toBeNull();
  });

  it('todas las rutas marcadas al abrir; filtro, "Ninguna" y "Todas" sobre las visibles', async () => {
    const page = await openAt('synthetic/scan/index.html');
    await page.keyboard.press('s');
    await dialogOpen(page);
    const state = () =>
      page.evaluate(() => {
        const sh = (window as any).__codeToFigmaInstance.shadow;
        return {
          checked: [...sh.querySelectorAll('.scan-route input')].filter((b: any) => b.checked).length,
          disabled: [...sh.querySelectorAll('.scan-route input')].some((b: any) => b.disabled),
          count: sh.querySelector('#__scan_count').textContent,
        };
      });
    expect(await state()).toMatchObject({ checked: 4, disabled: false });
    expect((await state()).count).toMatch(/4 de 4 páginas · unos 1 min/);
    await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('[data-pick="none"]').click());
    expect((await state()).checked).toBe(0);
    // Filtrar por "blog" y marcar solo esas
    await page.evaluate(() => {
      const f = (window as any).__codeToFigmaInstance.shadow.querySelector('#__scan_filter');
      f.value = 'blog';
      f.dispatchEvent(new Event('input', { bubbles: true }));
      (window as any).__codeToFigmaInstance.shadow.querySelector('[data-pick="all"]').click();
    });
    expect((await state()).checked).toBe(1);
    await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('#__scan_go').click());
    const start = await page.waitForFunction(() =>
      (window as any).__toWorker.find((m: any) => m.type === 'SCAN_START'),
    );
    const msg: any = await start.jsonValue();
    expect(msg.routes).toHaveLength(1);
    expect(msg.routes[0].path).toMatch(/blog/);
  });

  it('las rutas que ya están en Figma salen desmarcadas: se escanea solo lo que falta', async () => {
    // el #fragmento no cuenta: la marca del plugin guarda la URL sin él
    const page = await openAt('synthetic/scan/index.html', { inFigma: ['precios.html#planes', 'lento.html'] });
    await page.keyboard.press('s');
    await dialogOpen(page);
    const state = () =>
      page.evaluate(() => {
        const sh = (window as any).__codeToFigmaInstance.shadow;
        const rows = [...sh.querySelectorAll('.scan-route')] as any[];
        return {
          done: rows.filter(r => r.querySelector('.scan-done')).map(r => r.querySelector('.scan-path').textContent),
          checked: rows
            .filter(r => r.querySelector('input').checked)
            .map(r => r.querySelector('.scan-path').textContent),
          note: sh.querySelector('#__scan_note')?.textContent || '',
          button: sh.querySelector('#__scan_go').textContent,
        };
      });
    const s0 = await state();
    expect(s0.done).toHaveLength(2);
    expect(s0.done.every((p: string) => /precios|lento/.test(p))).toBe(true);
    expect(s0.checked).toHaveLength(2);
    expect(s0.checked.some((p: string) => /precios|lento/.test(p))).toBe(false);
    expect(s0.note).toMatch(/2 ya están en este archivo de Figma y salen desmarcadas/);
    expect(s0.button).toBe('Escanear 2 páginas');
    // "Todas" las vuelve a incluir; "Las que faltan" deja solo las nuevas
    await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('[data-pick="all"]').click());
    expect((await state()).checked).toHaveLength(4);
    await page.evaluate(() =>
      (window as any).__codeToFigmaInstance.shadow.querySelector('[data-pick="missing"]').click(),
    );
    expect((await state()).checked).toEqual(s0.checked);
    await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('#__scan_go').click());
    const start = await page.waitForFunction(() =>
      (window as any).__toWorker.find((m: any) => m.type === 'SCAN_START'),
    );
    const msg: any = await start.jsonValue();
    expect(msg.routes).toHaveLength(2);
    expect(msg.routes.some((r: any) => /precios|lento/.test(r.path))).toBe(false);
  });

  it('si no se puede saber qué hay en Figma, se dice y se proponen todas', async () => {
    const page = await openAt('synthetic/scan/index.html', { reason: 'el plugin de Figma no está abierto' });
    await page.keyboard.press('s');
    await dialogOpen(page);
    const info = await page.evaluate(() => {
      const sh = (window as any).__codeToFigmaInstance.shadow;
      return {
        checked: [...sh.querySelectorAll('.scan-route input')].filter((b: any) => b.checked).length,
        note: sh.querySelector('#__scan_note')?.textContent || '',
        missingButton: !!sh.querySelector('[data-pick="missing"]'),
      };
    });
    expect(info.checked).toBe(4);
    expect(info.note).toMatch(/No se pudo saber qué páginas ya están en Figma \(el plugin de Figma no está abierto\)/);
    expect(info.missingButton).toBe(false);
  });

  it('cancelar la lista no envía nada', async () => {
    const page = await openAt('synthetic/scan/index.html');
    await page.keyboard.press('s');
    await dialogOpen(page);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).__toWorker.some((m: any) => m.type === 'SCAN_START'))).toBe(false);
  });
});
