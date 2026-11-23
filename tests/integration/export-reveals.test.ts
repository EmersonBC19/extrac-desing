// Animaciones de entrada al hacer scroll en la exportación HTML: el inspector las deja visibles para
// medir, pero el bloque exportado vuelve a su estado oculto y script.js las anima al entrar en la
// vista. Se exporta con el inspector real (content.js) y el resultado se abre en otra página.
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import type { Page } from 'playwright';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { read } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });

/** Exporta #block con el botón del inspector (sin el diálogo de formato) */
async function exportFromInspector() {
  const page = await B.page('synthetic/reveals.html');
  await page.evaluate(() => {
    (window as any).chrome = {
      runtime: {
        id: 'extension-de-prueba',
        lastError: null,
        onMessage: { addListener() {}, removeListener() {} },
        sendMessage(_m: any, cb: any) {
          if (cb) cb({ success: true, status: { hubRunning: true, figmaConnected: true, figmaCount: 1 } });
        },
      },
    };
  });
  await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/extractor.js'));
  await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/content.js'));
  const out = await page.evaluate(async () => {
    const inst = (window as any).__codeToFigmaInstance;
    let res: any = null;
    inst.askExportFormat = async (r: any) => ((res = r), null);
    inst.selectedElements = [document.getElementById('block')];
    await inst.exportHtml();
    const js = document.getElementById('js-card')!;
    return {
      res,
      // el original queda como estaba (sin los !important del inspector)
      jsInline: js.getAttribute('style'),
      overrides: inst.revealOverrides.length,
    };
  });
  await page.context().close();
  return out;
}

async function open(html: string, reducedMotion: 'reduce' | 'no-preference' = 'no-preference'): Promise<Page> {
  const page = await B.page();
  await page.emulateMedia({ reducedMotion });
  await page.setContent(html, { waitUntil: 'load' });
  return page;
}

const opacity = (page: Page, sel: string) =>
  page.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s)!).opacity), sel);
const scrollTo = (page: Page, sel: string) =>
  page.evaluate(s => document.querySelector(s)!.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);

describe('exportar HTML con animaciones de entrada al hacer scroll', () => {
  let out: any;
  beforeAll(async () => {
    out = await exportFromInspector();
  });

  it('marca los reveals por clase y por estilos; el resto queda igual', () => {
    const { res } = out;
    expect(res.stats.reveals).toBe(3);
    expect(res.js).toMatch(/IntersectionObserver/);
    const html: string = res.singleFile;
    // AOS: sin la clase "ya apareció"; script.js la devuelve al entrar en la vista
    expect(html).toMatch(/id="aos-2"[^>]*data-ctf-reveal="class"|data-ctf-reveal="class"[^>]*id="aos-2"/);
    expect(html).toMatch(/data-ctf-reveal-class="aos-animate"/);
    expect(html).not.toMatch(/aos-animate"[^>]*id="aos-2"/);
    // JavaScript: estado oculto y visible en el CSS, sin los estilos en línea forzados
    expect(res.css).toMatch(
      /\[data-ctf-reveal="r\d+"\] \{ opacity: 0 !important; transform: matrix\(1, 0, 0, 1, 0, 30\)/,
    );
    expect(res.css).toMatch(/\.ctf-in \{ opacity: 1 !important/);
    expect(res.css).toMatch(/opacity 0\.5s ease-out/); // su transición original
    expect(res.css).toMatch(/prefers-reduced-motion: reduce/);
    expect(html).not.toMatch(/id="plain"[^>]*data-ctf-reveal/);
  });

  it('el original vuelve a su estado tras exportar', () => {
    expect(out.overrides).toBe(0);
    expect(out.jsInline || '').not.toMatch(/important/);
  });

  it('al abrirlo, lo que está fuera de la vista espera oculto y aparece al llegar', async () => {
    const page = await open(out.res.singleFile);
    await page.waitForFunction(() => document.getElementById('aos-1')!.classList.contains('aos-animate'));
    expect(await opacity(page, '#aos-2')).toBe(0);
    expect(await opacity(page, '#js-card')).toBe(0);
    expect(await opacity(page, '#plain')).toBe(1);

    await scrollTo(page, '#aos-2');
    await page.waitForFunction(() => parseFloat(getComputedStyle(document.getElementById('aos-2')!).opacity) === 1);
    await scrollTo(page, '#js-card');
    await page.waitForFunction(() => document.getElementById('js-card')!.classList.contains('ctf-in'));
    // a mitad de la transición todavía no es 1: se anima
    const mid = await opacity(page, '#js-card');
    expect(mid).toBeLessThan(1);
    await page.waitForFunction(() => parseFloat(getComputedStyle(document.getElementById('js-card')!).opacity) === 1);
    await page.context().close();
  });

  it('con movimiento reducido todo se ve desde el inicio, sin animar', async () => {
    const page = await open(out.res.singleFile, 'reduce');
    await page.waitForFunction(() => document.getElementById('js-card')!.classList.contains('ctf-in'));
    expect(await opacity(page, '#aos-2')).toBe(1);
    expect(await opacity(page, '#js-card')).toBe(1);
    await page.context().close();
  });
});
