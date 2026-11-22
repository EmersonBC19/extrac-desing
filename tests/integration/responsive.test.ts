// Breakpoints y claro/oscuro (Función A): el bloque a varios anchos y en los dos temas, capturado con
// la página de render real de la extensión (render-frame.html servida por http), y su llegada a Figma
// como set de variantes Breakpoint=… con Variables de modos Light/Dark.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as path from 'path';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { captureVariants, flatten } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');
const { startStaticServer } = require('../helpers/static-server.cjs');

const B = useBrowser({ width: 1440, height: 900 });
let ext: { url: string; close: () => Promise<void> };
let frameUrl = '';

beforeAll(async () => {
  ext = await startStaticServer(path.resolve(__dirname, '../../packages/browser-extension'));
  frameUrl = `${ext.url}/render-frame.html`;
});
afterAll(async () => {
  await ext?.close();
});

const rgb = (f: any) => (f ? [f.r, f.g, f.b].map((x: number) => Math.round(x * 255)) : null);
const solid = (n: any) => (n.styles?.fills || []).find((f: any) => !f.type || f.type === 'SOLID');

async function capture(id: string, opts: any) {
  const page = await B.page('synthetic/responsive.html');
  const res = await captureVariants(page, `document.getElementById('${id}')`, { frameUrl, ...opts });
  const htmlClass = await page.evaluate(() => document.documentElement.getAttribute('class'));
  await page.context().close();
  return { res, htmlClass };
}

describe('captura a varios anchos (render-frame.html)', () => {
  let res: any;
  beforeAll(async () => {
    ({ res } = await capture('pricing', { breakpoints: true, themes: true }));
  });

  it('Mobile 375, Tablet 768 y Desktop (el de escritorio, de la página en vivo)', () => {
    expect(res.variants.map((v: any) => [v.name, v.width])).toEqual([
      ['Mobile', 375],
      ['Tablet', 768],
      ['Desktop', 1440],
    ]);
  });

  it('los @media del sitio se aplican en cada ancho', () => {
    const [mobile, tablet, desktop] = res.variants.map((v: any) => v.rootNode);
    expect(mobile.layout.mode).toBe('VERTICAL'); // flex-direction: column a ≤ 600 px
    expect(desktop.layout.mode).toBe('HORIZONTAL');
    expect(tablet.children.length).toBe(2); // .plan.extra oculto en tablet
    expect(desktop.children.length).toBe(3);
    expect(mobile.layout.measuredWidth ?? mobile.layout.width).toBeLessThanOrEqual(375);
  });

  it('tema oscuro por prefers-color-scheme: mismo bloque con los colores oscuros en cada ancho', () => {
    expect(res.themeSource).toBe('media');
    for (const v of res.variants) {
      expect(v.dark, v.name).toBeDefined();
      expect(rgb(solid(v.rootNode)), v.name).toEqual([255, 255, 255]);
      expect(rgb(solid(v.dark)), v.name).toEqual([13, 17, 23]);
      // misma estructura: Figma empareja nodo a nodo
      expect(v.dark.children.length).toBe(v.rootNode.children.length);
    }
  });
});

describe('tema por clase del sitio (html.dark)', () => {
  it('se activa, se captura y la página queda como estaba', async () => {
    const { res, htmlClass } = await capture('themed', { breakpoints: false, themes: true });
    expect(res.themeSource).toBe('class');
    expect(res.variants).toHaveLength(1);
    const [v] = res.variants;
    expect(rgb(solid(v.rootNode))).toEqual([250, 250, 250]);
    // Con transición de 0.4 s en la página: el color oscuro es el final, no uno a medio camino
    expect(rgb(solid(v.dark))).toEqual([17, 17, 17]);
    expect(htmlClass).toBeNull();
  });

  it('un bloque que no cambia con el tema: aviso y sin variante oscura', async () => {
    const { res } = await capture('plain', { breakpoints: false, themes: true });
    expect(res.variants[0].dark).toBeUndefined();
    expect(res.warnings.join(' ')).toMatch(/no cambia de colores/);
  });
});

describe('en Figma: Breakpoint=… y Variables Light/Dark', () => {
  let figma: any;
  let res: any;
  beforeAll(async () => {
    ({ res } = await capture('pricing', { breakpoints: true, themes: true }));
    const desktop = res.variants[res.variants.length - 1];
    figma = await runPlugin({ rootNode: desktop.rootNode, responsive: { variants: res.variants } });
  });

  const set = () => figma.currentPage.children.find((n: any) => n.type === 'COMPONENT_SET');

  it('set de variantes con una por ancho', () => {
    expect(figma.logs.filter((m: any) => m.type === 'RENDER_ERROR')).toEqual([]);
    expect(set().children.map((c: any) => c.name)).toEqual([
      'Breakpoint=Mobile',
      'Breakpoint=Tablet',
      'Breakpoint=Desktop',
    ]);
  });

  it('colección con modos Light y Dark y los colores que cambian enlazados a sus Variables', () => {
    const col = figma.variables.collections.find((c: any) => /^Tema/.test(c.name));
    expect(col).toBeDefined();
    expect(col.modes.map((m: any) => m.name)).toEqual(['Light', 'Dark']);
    const vars = figma.variables.all.filter((v: any) => v.collection === col);
    expect(vars.length).toBeGreaterThan(0);
    const [light, dark] = col.modes.map((m: any) => m.modeId);
    // El fondo blanco del bloque → variable con valor oscuro en Dark
    const bg = vars.find((v: any) => {
      const l = v._values[light];
      const d = v._values[dark];
      return l && d && Math.round(l.r * 255) === 255 && Math.round(d.r * 255) === 13;
    });
    expect(bg).toBeDefined();
    // Cada variante tiene su raíz enlazada a esa variable
    for (const comp of set().children) {
      expect(comp.fills[0].boundVariables?.color?.id, comp.name).toBe(bg.id);
    }
    // Y los textos que cambian de color también
    const texts = flatten(set())
      .filter((x: any) => x.node.type === 'TEXT')
      .map((x: any) => x.node);
    expect(texts.some((t: any) => t.fills?.[0]?.boundVariables?.color)).toBe(true);
  });

  it('una vista en modo Dark al lado del set', () => {
    const preview = figma.currentPage.children.find((n: any) => /Dark/.test(n.name) && n !== set());
    expect(preview).toBeDefined();
    const col = figma.variables.collections.find((c: any) => /^Tema/.test(c.name));
    expect(preview.explicitVariableModes?.[col.id]).toBe(col.modes[1].modeId);
  });
});

describe('plan de Figma con un solo modo por colección', () => {
  it('el set llega igual, con aviso, y sin vista Dark', async () => {
    const { res } = await capture('pricing', { breakpoints: true, themes: true });
    const desktop = res.variants[res.variants.length - 1];
    const figma = await runPlugin(
      { rootNode: desktop.rootNode, responsive: { variants: res.variants } },
      { maxModes: 1 },
    );
    expect(figma.logs.filter((m: any) => m.type === 'RENDER_ERROR')).toEqual([]);
    const set = figma.currentPage.children.find((n: any) => n.type === 'COMPONENT_SET');
    expect(set.children).toHaveLength(3);
    expect(figma.logs.some((m: any) => m.level === 'warn' && /varios modos/.test(m.message))).toBe(true);
    expect(figma.currentPage.children.some((n: any) => /· Dark$/.test(n.name))).toBe(false);
  });

  it('el hub y el plugin rechazan una variante con un árbol inválido', async () => {
    const figma = await runPlugin({
      rootNode: { id: 'a', name: 'A', type: 'FRAME', layout: {}, styles: {} },
      responsive: { variants: [{ name: 'Mobile', width: 375, rootNode: { id: 'b', type: 'NOPE' } }] },
    });
    const err = figma.logs.find((m: any) => m.type === 'RENDER_ERROR');
    expect(err?.error || err?.message).toMatch(/responsive\.variants\[0\]/);
  });
});
