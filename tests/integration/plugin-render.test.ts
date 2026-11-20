// Plugin de Figma (dist/code.js) ejecutado en el simulador de la API de Figma, con
// extracciones reales de las páginas fixture.
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1440, height: 900 });
let landing: any;   // extracción de synthetic/index.html
let hero: any;      // extracción de synthetic/hero.html

beforeAll(async () => {
  const page = await B.page('synthetic/index.html');
  landing = (await extract(page, "document.getElementById('root')")).rootNode;
  await page.goto(page.url().replace('index.html', 'hero.html'));
  hero = (await extract(page, "document.getElementById('root')")).rootNode;
});

const clone = (x: any) => JSON.parse(JSON.stringify(x));
const errorsOf = (figma: any) => figma.logs.filter((m: any) => m.type === 'RENDER_ERROR' || m.level === 'error');
const sectionsOf = (figma: any) => figma.currentPage.children.filter((n: any) => n.type === 'SECTION');
const countIn = (n: any, pred: (x: any) => boolean) => { let c = 0; (function w(x) { for (const ch of x.children || []) { if (pred(ch)) c++; w(ch); } })(n); return c; };

describe('render normal', () => {
  it('dibuja la extracción sin errores', async () => {
    const figma = await runPlugin({ rootNode: clone(landing) });
    expect(errorsOf(figma)).toEqual([]);
    expect(figma.logs.some((m: any) => m.type === 'RENDER_SUCCESS')).toBe(true);
    expect(figma.currentPage.children).toHaveLength(1);
    expect(countIn(figma.currentPage, (n: any) => (n.fills || []).some((f: any) => f.type === 'IMAGE'))).toBeGreaterThanOrEqual(10);
  });

  it('rechaza payloads inválidos antes de tocar el lienzo (p. ej. "Pegar JSON")', async () => {
    const figma = await runPlugin({ rootNode: { type: 'FRAME', layout: {}, children: [{ type: 'SVG', svgContent: '<svg><script>x</script></svg>', layout: {} }] } });
    const err = figma.logs.find((m: any) => m.type === 'RENDER_ERROR');
    expect(err?.error).toMatch(/Payload inválido/);
    expect(figma.currentPage.children).toHaveLength(0);
  });
});

describe('tablero design system', () => {
  it('cuatro Sections en horizontal: Página completa → Secciones → Componentes → Estilos', async () => {
    const figma = await runPlugin({ rootNode: clone(landing), board: true, source: { url: 'http://localhost/landing' } });
    expect(errorsOf(figma)).toEqual([]);
    const secs = sectionsOf(figma).sort((a: any, b: any) => a.x - b.x).map((s: any) => s.name);
    expect(secs[0]).toBe('01 · Página completa');
    expect(secs[1]).toBe('02 · Secciones');
    expect(secs.at(-1)).toBe('04 · Estilos');
    expect(figma.styles.text.length).toBeGreaterThan(0);
    expect(figma.styles.paint.length).toBeGreaterThan(0);
  });

  it('se coloca a la derecha de lo que ya hay en la página (sin crear páginas)', async () => {
    const figma = await runPlugin({ rootNode: clone(landing), board: true, source: { url: 'http://localhost/' } },
      { preNodes: [{ name: 'Previo', x: 0, y: 0, w: 2000, h: 900 }] });
    expect(figma.root.children).toHaveLength(1);
    const minX = Math.min(...sectionsOf(figma).map((s: any) => s.x));
    expect(minX).toBeGreaterThanOrEqual(2000);
  });

  it('multi-selección: cada componente elegido es su propia sub-vista', async () => {
    const a = clone(hero); const b = clone(landing);
    a.layout = { ...a.layout, x: 0, y: 0, positioning: 'ABSOLUTE' };
    b.layout = { ...b.layout, x: 0, y: a.layout.measuredHeight, positioning: 'ABSOLUTE' };
    const bundle = { id: 'multi_selection_bundle_1', type: 'FRAME', name: 'Multi-selection (2 componentes)',
      layout: { mode: 'NONE', width: 1440, height: 3000, measuredWidth: 1440, measuredHeight: 3000, padding: { top: 0, right: 0, bottom: 0, left: 0 }, itemSpacing: 0 },
      styles: { fills: [] }, children: [a, b] };
    const figma = await runPlugin({ rootNode: bundle, board: true });
    const sub = sectionsOf(figma).find((s: any) => s.name === '02 · Secciones');
    expect(sub.children.filter((c: any) => c.type !== 'TEXT')).toHaveLength(2);
  });

  it('bloques repetidos → componente maestro + instancias con su propio texto', async () => {
    const text = (characters: string) => ({ type: 'TEXT', name: 'Label', layout: { width: 'HUG', height: 'HUG', x: 21, y: 11 }, styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] }, textData: { characters, fontSize: 17, fontFamily: 'Inter', fontWeight: 400 } });
    const button = (label: string, x: number) => ({ type: 'FRAME', name: `Link / ${label}`,
      layout: { mode: 'HORIZONTAL', x, y: 0, width: 171, height: 44, measuredWidth: 171, measuredHeight: 44, padding: { top: 11, right: 21, bottom: 11, left: 21 }, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' },
      styles: { fills: [{ r: 0, g: 0.44, b: 0.89, a: 1 }], cornerRadius: 22 }, children: [text(label)] });
    const root = { type: 'FRAME', name: 'Botones', layout: { mode: 'NONE', width: 1200, height: 400, measuredWidth: 1200, measuredHeight: 400 }, styles: { fills: [] },
      children: [button('Más información', 0), button('Comprar', 200), button('Ver ahora', 400)] };
    const figma = await runPlugin({ rootNode: root, board: true });
    expect(errorsOf(figma)).toEqual([]);
    const comps = sectionsOf(figma).find((s: any) => s.name === '03 · Componentes');
    expect(comps.children.filter((c: any) => c.type === 'COMPONENT')).toHaveLength(1);
    const full = sectionsOf(figma).find((s: any) => s.name === '01 · Página completa');
    const instances: any[] = [];
    (function w(x: any) { for (const ch of x.children || []) { if (ch.type === 'INSTANCE') instances.push(ch); w(ch); } })(full);
    expect(instances).toHaveLength(3);
    const labels = instances.map(i => i.findAll((n: any) => n.type === 'TEXT')[0].characters);
    expect(labels).toEqual(['Más información', 'Comprar', 'Ver ahora']);
  });

  it('si el tablero falla, limpia lo creado y dibuja en modo normal', async () => {
    const figma = await runPlugin({ rootNode: clone(hero), board: true }, { failSection: true });
    expect(figma.logs.some((m: any) => m.level === 'error' && /No se pudo organizar como tablero/.test(m.message))).toBe(true);
    expect(figma.logs.some((m: any) => m.type === 'RENDER_SUCCESS')).toBe(true);
    expect(sectionsOf(figma)).toHaveLength(0);
    expect(figma.currentPage.children).toHaveLength(1);
  });
});
