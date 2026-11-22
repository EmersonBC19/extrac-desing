// Exportar un bloque como HTML + CSS + JS (botón "Exportar HTML" de la extensión). Se exporta en
// Chromium con el código real y el resultado se abre en otra página, sin la original: tiene que verse
// y comportarse igual.
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { exportHtml } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });

/** Añade una hoja de OTRO origen (127.0.0.1 en vez de localhost): cssRules no se puede leer */
async function addRemoteSheet(page: any) {
  await page.evaluate(async () => {
    const u = new URL('export-remote.css', location.href);
    u.hostname = '127.0.0.1';
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = u.href;
    const done = new Promise(r => (l.onload = r));
    document.head.appendChild(l);
    await done;
  });
}

async function exported(opts: any = {}) {
  const page = await B.page('synthetic/export.html');
  await addRemoteSheet(page);
  const original = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const card = r('#card');
    return {
      card: { w: card.width, h: card.height },
      price: { x: r('.price').left - card.left, y: r('.price').top - card.top },
    };
  });
  const res = await exportHtml(page, `document.getElementById('card')`, opts);
  await page.context().close();
  return { res, original };
}

/** Abre el HTML exportado en una página nueva (sin la original) */
async function open(html: string, width = 1440) {
  const page = await B.page();
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(html, { waitUntil: 'load' });
  return page;
}

const style = (page: any, sel: string, prop: string, pseudo: string | null = null) =>
  page.evaluate(
    ([s, p, ps]: [string, string, string | null]) =>
      getComputedStyle(document.querySelector(s)!, ps).getPropertyValue(p),
    [sel, prop, pseudo],
  );

describe('exportar HTML + CSS + JS', () => {
  let res: any;
  let original: any;
  beforeAll(async () => {
    ({ res, original } = await exported());
  });

  it('solo las reglas que tocan al bloque (no las del resto de la página)', () => {
    expect(res.css).toContain('.theme-dark .card');
    expect(res.css).toContain('.card .price'); // hoja enlazada
    expect(res.css).toContain('letter-spacing: 1px'); // @import dentro de esa hoja
    expect(res.css).not.toContain('.unrelated-widget');
    expect(res.css).not.toContain('.never-used');
    expect(res.stats.rules).toBeLessThan(res.stats.totalRules);
  });

  it('una hoja de otro dominio se descarga y sus reglas viajan como reglas', () => {
    expect(res.css).toContain('.card .remote');
    expect(res.css).not.toContain('.remote-unused');
    expect(res.stats.unreadableSheets).toEqual([]);
  });

  it('@keyframes solo los usados; @media y :hover se conservan', () => {
    expect(res.css).toMatch(/@keyframes pulse/);
    expect(res.css).not.toMatch(/unused-anim/);
    expect(res.css).toMatch(/@media \(max-width: 600px\)/);
    expect(res.css).toMatch(/\.card \.btn:hover/);
  });

  it('sin scripts ni manejadores en línea; URLs absolutas; estado del formulario', () => {
    expect(res.html).not.toMatch(/<script>window\.__inside/);
    expect(res.html).not.toMatch(/onclick/);
    expect(res.html).toMatch(/src="http:\/\/localhost:\d+\/synthetic\/img\/slide1\.png"/);
    expect(res.html).toMatch(/<input[^>]*value="Ana"/);
    expect(res.html).toMatch(/<link rel="stylesheet" href="styles.css">/);
    expect(res.html).toMatch(/<script src="script.js"><\/script>/);
  });

  it('el archivo único se ve igual que en la página: contexto de ancestros, variables, fuentes', async () => {
    const page = await open(res.singleFile);
    expect(await style(page, '#card', 'background-color')).toBe('rgb(20, 30, 40)'); // var del <html>
    expect(await style(page, '#card', 'border-radius')).toBe('12px'); // var de :root
    expect(await style(page, '#card', 'border-top-width')).toBe('1px'); // .layout > main > .card
    expect(await style(page, '#card h2', 'font-size')).toBe('22px');
    expect(await style(page, '#card h2', 'letter-spacing')).toBe('1px');
    expect(await style(page, '#card .price', 'color')).toBe('rgb(0, 128, 0)');
    expect(await style(page, '#card .remote', 'color')).toBe('rgb(200, 0, 100)');
    expect(await style(page, '#card .badge', 'content', '::before')).toBe('"★"');
    expect(await style(page, 'body', 'font-family')).toMatch(/Arial/);
    // El fondo que pintaba <main> (que aquí no tiene caja) sigue detrás del bloque
    expect(await style(page, 'html', 'background-color')).toBe('rgb(230, 230, 250)');
    const geo = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const card = r('#card');
      return {
        card: { w: card.width, h: card.height },
        price: { x: r('.price').left - card.left, y: r('.price').top - card.top },
      };
    });
    expect(geo.card.w).toBeCloseTo(original.card.w, 0);
    expect(geo.card.h).toBeCloseTo(original.card.h, 0);
    expect(geo.price).toEqual(original.price);
    await page.context().close();
  });

  it('atajo con var() sobrescrito en parte: se recupera del texto fuente (Chrome lo serializa vacío)', async () => {
    expect(res.css).toMatch(/\.card \.bordered \{[^}]*solid/);
    expect(res.css).not.toMatch(/\.card \.bordered \{[^}]*border-top-style: ;/);
    const page = await open(res.singleFile);
    expect(await style(page, '#card .bordered', 'border-top-style')).toBe('solid');
    expect(await style(page, '#card .bordered', 'border-top-width')).toBe('2px');
    expect(await style(page, '#card .bordered', 'border-left-width')).toBe('0px');
    expect(await style(page, '#card .bordered', 'border-top-color')).toBe('rgb(0, 200, 0)');
    // También en una hoja de otro dominio (descargada y analizada aparte)
    expect(await style(page, '#card .remote', 'border-bottom-style')).toBe('dashed');
    expect(await style(page, '#card .remote', 'border-bottom-width')).toBe('3px');
    await page.context().close();
  });

  it('verificado en la página: fidelidad geométrica alta y sin ajustes cuando las reglas bastan', () => {
    // Sin ajustes también con transiciones en la página (antes: colores "a medio camino" en el iframe)
    expect(res.stats.verified).toBe(true);
    expect(res.stats.fidelity).toBeGreaterThanOrEqual(95);
    expect(res.stats.patchedElements).toBe(0);
  });

  it('responsive: a 500 px se aplica el @media de la página', async () => {
    const page = await open(res.singleFile, 500);
    expect(await style(page, '#card', 'padding-top')).toBe('4px');
    await page.context().close();
  });

  it('lienzo como imagen y el <symbol> del sprite viaja con el bloque', async () => {
    const page = await open(res.singleFile);
    const info = await page.evaluate(() => ({
      canvasImg: (document.querySelector('#cv') as HTMLImageElement | null)?.getAttribute('src') || '',
      tag: document.querySelector('#cv')?.tagName,
      symbol: !!document.querySelector('symbol#ico'),
    }));
    expect(info.tag).toBe('IMG');
    expect(info.canvasImg).toMatch(/^data:image\/png/);
    expect(info.symbol).toBe(true);
    await page.context().close();
  });

  it('JS: pestañas ARIA y botón aria-expanded funcionan en el archivo exportado', async () => {
    expect(res.stats.widgets).toEqual(expect.arrayContaining(['tabs', 'disclosure']));
    const page = await open(res.singleFile);
    const visible = (s: string) =>
      page.evaluate((x: string) => getComputedStyle(document.querySelector(x)!).display !== 'none', s);
    expect(await visible('#p1')).toBe(true);
    expect(await visible('#p2')).toBe(false);
    await page.click('#t2');
    expect(await visible('#p1')).toBe(false);
    expect(await visible('#p2')).toBe(true);
    expect(await style(page, '#t2', 'font-weight')).toBe('700'); // la clase activa (is-on) se mueve
    expect(await style(page, '#t1', 'font-weight')).toBe('400');
    expect(await style(page, '#p2', 'border-left-width')).toBe('2px');
    expect(await visible('#extra')).toBe(false);
    await page.click('#more');
    expect(await visible('#extra')).toBe(true);
    expect(await page.getAttribute('#more', 'aria-expanded')).toBe('true');
    await page.context().close();
  });

  it('ZIP con index.html, styles.css y script.js', () => {
    const bytes = Uint8Array.from(res.zip as number[]);
    const text = new TextDecoder().decode(bytes);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    for (const name of ['index.html', 'styles.css', 'script.js']) expect(text).toContain(name);
    // Registro final del zip: 3 entradas
    const end = bytes.length - 22;
    expect(new DataView(bytes.buffer).getUint32(end, true)).toBe(0x06054b50);
    expect(new DataView(bytes.buffer).getUint16(end + 10, true)).toBe(3);
  });
});

describe('hoja ilegible (otro dominio, sin poder descargarla)', () => {
  it('sus estilos llegan como ajustes medidos y el resultado se ve igual', async () => {
    const { res } = await exported({ noFetch: true });
    expect(res.stats.unreadableSheets.length).toBe(1);
    expect(res.css).not.toContain('.card .remote');
    expect(res.stats.patchedElements).toBeGreaterThan(0);
    const page = await open(res.singleFile);
    expect(await style(page, '#card .remote', 'color')).toBe('rgb(200, 0, 100)');
    expect(await style(page, '#card .remote', 'text-decoration-line')).toBe('underline');
    await page.context().close();
  });
});
