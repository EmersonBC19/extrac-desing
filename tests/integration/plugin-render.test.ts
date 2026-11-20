// Plugin de Figma (dist/code.js) ejecutado en el simulador de la API de Figma, con
// extracciones reales de las páginas fixture.
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract } = require('../helpers/extension-sim.cjs');
const { runPlugin, loadPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1440, height: 900 });
let landing: any; // extracción de synthetic/index.html
let hero: any; // extracción de synthetic/hero.html

beforeAll(async () => {
  const page = await B.page('synthetic/index.html');
  landing = (await extract(page, "document.getElementById('root')")).rootNode;
  await page.goto(page.url().replace('index.html', 'hero.html'));
  hero = (await extract(page, "document.getElementById('root')")).rootNode;
});

const clone = (x: any) => JSON.parse(JSON.stringify(x));
const errorsOf = (figma: any) => figma.logs.filter((m: any) => m.type === 'RENDER_ERROR' || m.level === 'error');
const sectionsOf = (figma: any) => figma.currentPage.children.filter((n: any) => n.type === 'SECTION');
const countIn = (n: any, pred: (x: any) => boolean) => {
  let c = 0;
  (function w(x) {
    for (const ch of x.children || []) {
      if (pred(ch)) c++;
      w(ch);
    }
  })(n);
  return c;
};

describe('render normal', () => {
  it('tokens CSS (:root) → Variables "Tokens CSS"; reenviar actualiza sin duplicar', async () => {
    const figma = loadPlugin({}, { ...console, log() {}, warn() {} });
    const send = (brand: any) =>
      figma.ui.onmessage({
        type: 'RENDER_NODES',
        payload: {
          rootNode: clone(hero),
          tokens: { colors: { '--brand': brand, '--fondo.claro': { r: 1, g: 1, b: 1, a: 1 } } },
        },
      });
    await send({ r: 1, g: 0, b: 0, a: 1 });
    await send({ r: 0, g: 0, b: 1, a: 1 });
    expect(figma.variables.collections.map((c: any) => c.name)).toEqual(['Tokens CSS']);
    const vars = figma.variables.all;
    expect(vars.map((v: any) => v.name).sort()).toEqual(['brand', 'fondo,claro']);
    expect(vars.find((v: any) => v.name === 'brand')._values.m1).toMatchObject({ r: 0, b: 1 });
    expect(figma.styles.paint).toHaveLength(0);
  });

  it('dibuja la extracción sin errores', async () => {
    const figma = await runPlugin({ rootNode: clone(landing) });
    expect(errorsOf(figma)).toEqual([]);
    const ok = figma.logs.find((m: any) => m.type === 'RENDER_SUCCESS');
    expect(ok).toBeTruthy();
    // Tiempos medidos por etapa (fase 5.1), coherentes con el total
    expect(ok.timings).toMatchObject({
      fontsMs: expect.any(Number),
      buildMs: expect.any(Number),
      placeMs: expect.any(Number),
    });
    expect(ok.timings.totalMs).toBeGreaterThanOrEqual(ok.timings.buildMs);
    expect(ok.durationMs).toBe(ok.timings.totalMs);
    expect(figma.currentPage.children).toHaveLength(1);
    expect(
      countIn(figma.currentPage, (n: any) => (n.fills || []).some((f: any) => f.type === 'IMAGE')),
    ).toBeGreaterThanOrEqual(10);
  });

  it('rechaza payloads inválidos antes de tocar el lienzo (p. ej. "Pegar JSON")', async () => {
    const figma = await runPlugin({
      rootNode: {
        type: 'FRAME',
        layout: {},
        children: [{ type: 'SVG', svgContent: '<svg><script>x</script></svg>', layout: {} }],
      },
    });
    const err = figma.logs.find((m: any) => m.type === 'RENDER_ERROR');
    expect(err?.error).toMatch(/Payload inválido/);
    expect(figma.currentPage.children).toHaveLength(0);
  });
});

describe('tablero design system', () => {
  it('cuatro Sections en horizontal: Página completa → Secciones → Componentes → Estilos', async () => {
    const figma = await runPlugin({
      rootNode: clone(landing),
      board: true,
      source: { url: 'http://localhost/landing' },
    });
    expect(errorsOf(figma)).toEqual([]);
    const secs = sectionsOf(figma)
      .sort((a: any, b: any) => a.x - b.x)
      .map((s: any) => s.name);
    expect(secs[0]).toBe('01 · Página completa');
    expect(secs[1]).toBe('02 · Secciones');
    expect(secs.at(-1)).toBe('04 · Estilos');
    expect(figma.styles.text.length).toBeGreaterThan(0);
    // Colores como Variables de Figma (fase 6.2), no como estilos de color
    expect(figma.variables.all.filter((v: any) => v.resolvedType === 'COLOR').length).toBeGreaterThan(0);
    expect(figma.styles.paint.length).toBe(0);
  });

  it('Variables: colores, espaciados y radios vinculados a las capas', async () => {
    const figma = await runPlugin({
      rootNode: clone(landing),
      board: true,
      source: { url: 'https://www.ejemplo.com/' },
    });
    expect(errorsOf(figma)).toEqual([]);
    const [collection] = figma.variables.collections;
    expect(collection.name).toBe('ejemplo.com');
    // El contenido vive en los maestros (secciones de 02 y componentes de 03); 01 usa instancias.
    // Toda capa con un único relleno sólido (fuera de instancias y de las muestras de 04) queda vinculada.
    const inInstance = (n: any) => {
      for (let p = n.parent; p; p = p.parent) if (p.type === 'INSTANCE') return true;
      return false;
    };
    const all = sectionsOf(figma)
      .filter((s: any) => s.name !== '04 · Estilos')
      .flatMap((s: any) => s.findAll(() => true))
      // fuera: instancias (heredan) y las etiquetas del propio tablero (textos sueltos en la Section)
      .filter(
        (n: any) => !inInstance(n) && n.type !== 'INSTANCE' && !(n.type === 'TEXT' && n.parent?.type === 'SECTION'),
      );
    const eligible = all.filter(
      (n: any) =>
        Array.isArray(n.fills) && n.fills.length === 1 && n.fills[0].type === 'SOLID' && n.fills[0].visible !== false,
    );
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.filter((n: any) => !n.fills[0].boundVariables?.color).map((n: any) => n.name)).toEqual([]);
  });

  it('Variables numéricas: espaciados y radios repetidos, vinculados a las capas', async () => {
    const text = (characters: string) => ({
      type: 'TEXT',
      name: 'Label',
      layout: { width: 'HUG', height: 'HUG' },
      styles: { fills: [{ r: 0, g: 0, b: 0, a: 1 }] },
      textData: { characters, fontSize: 16, fontFamily: 'Inter', fontWeight: 400 },
    });
    const card = (title: string, x: number, color: any) => ({
      type: 'FRAME',
      name: 'Card ' + title,
      layout: {
        mode: 'VERTICAL',
        x,
        y: 0,
        width: 300,
        height: 120,
        measuredWidth: 300,
        measuredHeight: 120,
        itemSpacing: 8,
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
      styles: { fills: [color], cornerRadius: 12 },
      children: [text(title), text('detalle ' + title)],
    });
    const root = {
      type: 'FRAME',
      name: 'Cards',
      layout: { mode: 'NONE', width: 700, height: 200, measuredWidth: 700, measuredHeight: 200 },
      styles: { fills: [] },
      children: [card('Uno', 0, { r: 1, g: 1, b: 1, a: 1 }), card('Dos', 320, { r: 0.9, g: 0.9, b: 1, a: 1 })],
    };
    const figma = await runPlugin({ rootNode: root, board: true });
    expect(errorsOf(figma)).toEqual([]);
    const names = figma.variables.all.filter((v: any) => v.resolvedType === 'FLOAT').map((v: any) => v.name);
    expect(names).toEqual(expect.arrayContaining(['Espaciado/8', 'Espaciado/16', 'Radio/12']));
    const nodes = sectionsOf(figma).flatMap((s: any) => s.findAll(() => true));
    const bound = nodes.filter((n: any) => n.boundVariables?.paddingLeft && n.boundVariables?.topLeftRadius);
    expect(bound.length).toBeGreaterThanOrEqual(2);
  });

  it('sin API de Variables (archivo o plan que no las tiene) → estilos de color como antes', async () => {
    const figma = await runPlugin({ rootNode: clone(landing), board: true }, { noVariables: true });
    expect(errorsOf(figma)).toEqual([]);
    expect(figma.styles.paint.length).toBeGreaterThan(0);
  });

  it('se coloca a la derecha de lo que ya hay en la página (sin crear páginas)', async () => {
    const figma = await runPlugin(
      { rootNode: clone(landing), board: true, source: { url: 'http://localhost/' } },
      { preNodes: [{ name: 'Previo', x: 0, y: 0, w: 2000, h: 900 }] },
    );
    expect(figma.root.children).toHaveLength(1);
    const minX = Math.min(...sectionsOf(figma).map((s: any) => s.x));
    expect(minX).toBeGreaterThanOrEqual(2000);
  });

  it('multi-selección: cada componente elegido es su propia sub-vista', async () => {
    const a = clone(hero);
    const b = clone(landing);
    a.layout = { ...a.layout, x: 0, y: 0, positioning: 'ABSOLUTE' };
    b.layout = { ...b.layout, x: 0, y: a.layout.measuredHeight, positioning: 'ABSOLUTE' };
    const bundle = {
      id: 'multi_selection_bundle_1',
      type: 'FRAME',
      name: 'Multi-selection (2 componentes)',
      layout: {
        mode: 'NONE',
        width: 1440,
        height: 3000,
        measuredWidth: 1440,
        measuredHeight: 3000,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
      },
      styles: { fills: [] },
      children: [a, b],
    };
    const figma = await runPlugin({ rootNode: bundle, board: true });
    const sub = sectionsOf(figma).find((s: any) => s.name === '02 · Secciones');
    expect(sub.children.filter((c: any) => c.type !== 'TEXT')).toHaveLength(2);
  });

  it('bloques repetidos → componente maestro + instancias con su propio texto', async () => {
    const text = (characters: string) => ({
      type: 'TEXT',
      name: 'Label',
      layout: { width: 'HUG', height: 'HUG', x: 21, y: 11 },
      styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
      textData: { characters, fontSize: 17, fontFamily: 'Inter', fontWeight: 400 },
    });
    const button = (label: string, x: number) => ({
      type: 'FRAME',
      name: `Link / ${label}`,
      layout: {
        mode: 'HORIZONTAL',
        x,
        y: 0,
        width: 171,
        height: 44,
        measuredWidth: 171,
        measuredHeight: 44,
        padding: { top: 11, right: 21, bottom: 11, left: 21 },
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
      },
      styles: { fills: [{ r: 0, g: 0.44, b: 0.89, a: 1 }], cornerRadius: 22 },
      children: [text(label)],
    });
    const root = {
      type: 'FRAME',
      name: 'Botones',
      layout: { mode: 'NONE', width: 1200, height: 400, measuredWidth: 1200, measuredHeight: 400 },
      styles: { fills: [] },
      children: [button('Más información', 0), button('Comprar', 200), button('Ver ahora', 400)],
    };
    const figma = await runPlugin({ rootNode: root, board: true });
    expect(errorsOf(figma)).toEqual([]);
    const comps = sectionsOf(figma).find((s: any) => s.name === '03 · Componentes');
    expect(comps.children.filter((c: any) => c.type === 'COMPONENT')).toHaveLength(1);
    const full = sectionsOf(figma).find((s: any) => s.name === '01 · Página completa');
    const instances: any[] = [];
    (function w(x: any) {
      for (const ch of x.children || []) {
        if (ch.type === 'INSTANCE') instances.push(ch);
        w(ch);
      }
    })(full);
    expect(instances).toHaveLength(3);
    const labels = instances.map(i => i.findAll((n: any) => n.type === 'TEXT')[0].characters);
    expect(labels).toEqual(['Más información', 'Comprar', 'Ver ahora']);
  });

  it('el mismo componente en dos tamaños → un set de variantes Size=L/S con sus instancias', async () => {
    const text = (characters: string) => ({
      type: 'TEXT',
      name: 'Label',
      layout: { width: 'HUG', height: 'HUG', x: 21, y: 11 },
      styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
      textData: { characters, fontSize: 17, fontFamily: 'Inter', fontWeight: 400 },
    });
    const tile = (label: string, x: number, w: number, h: number) => ({
      type: 'FRAME',
      name: 'Tile Ctas',
      layout: { mode: 'HORIZONTAL', x, y: 0, width: w, height: h, measuredWidth: w, measuredHeight: h },
      styles: { fills: [{ r: 0.1, g: 0.1, b: 0.1, a: 1 }], cornerRadius: 12 },
      children: [text(label)],
    });
    const root = {
      type: 'FRAME',
      name: 'Tiles',
      layout: { mode: 'NONE', width: 1400, height: 600, measuredWidth: 1400, measuredHeight: 600 },
      styles: { fills: [] },
      children: [tile('A', 0, 400, 300), tile('B', 420, 400, 300), tile('C', 0, 200, 150), tile('D', 220, 200, 150)],
    };
    const figma = await runPlugin({ rootNode: root, board: true });
    expect(errorsOf(figma)).toEqual([]);
    const comps = sectionsOf(figma).find((s: any) => s.name === '03 · Componentes');
    const sets = comps.children.filter((c: any) => c.type === 'COMPONENT_SET');
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('Tile Ctas');
    // QA-9: sin etiquetas propias encima (Figma ya muestra el nombre); los usos van en la descripción
    expect(comps.children.filter((c: any) => c.type === 'TEXT')).toEqual([]);
    expect(sets[0].description).toContain('2 variantes (Size) · 4 usos');
    expect(sets[0].children.map((c: any) => c.name).sort()).toEqual(['Size=L', 'Size=S']);
    // Las 4 apariciones de la vista completa son instancias de las variantes
    const full = sectionsOf(figma).find((s: any) => s.name === '01 · Página completa');
    const masters = full.findAll((n: any) => n.type === 'INSTANCE').map((i: any) => i._master.name);
    expect(masters.sort()).toEqual(['Size=L', 'Size=L', 'Size=S', 'Size=S']);
  });

  it('las secciones de 02 son componentes y la vista completa usa sus instancias (se sincronizan)', async () => {
    const figma = await runPlugin({ rootNode: clone(landing), board: true, source: { url: 'http://localhost/' } });
    expect(errorsOf(figma)).toEqual([]);
    const sub = sectionsOf(figma).find((s: any) => s.name === '02 · Secciones');
    const sectionComps = sub.children.filter((c: any) => c.type === 'COMPONENT');
    expect(sectionComps.length).toBeGreaterThan(1);
    expect(sectionComps.every((c: any) => c.name.startsWith('Sección /'))).toBe(true);
    const full = sectionsOf(figma).find((s: any) => s.name === '01 · Página completa');
    const used = new Set(
      full
        .findAll((n: any) => n.type === 'INSTANCE')
        .map((i: any) => i._master)
        .filter((m: any) => sectionComps.includes(m)),
    );
    expect(used.size).toBe(sectionComps.length);
  });

  it('QA-2: una sección sin fondo propio toma el fondo que hereda en la página', async () => {
    const block = (name: string, y: number) => ({
      type: 'FRAME',
      name,
      layout: { mode: 'VERTICAL', x: 0, y, width: 1440, height: 700, measuredWidth: 1440, measuredHeight: 700 },
      styles: { fills: [] },
      children: [
        {
          type: 'TEXT',
          name: 'Título',
          layout: { x: 0, y: 0, width: 'HUG', height: 'HUG' },
          styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
          textData: { characters: 'Preguntas frecuentes ' + name, fontSize: 32, fontFamily: 'Inter', fontWeight: 700 },
        },
      ],
    });
    const root = {
      type: 'FRAME',
      name: 'Body',
      layout: { mode: 'NONE', width: 1440, height: 1400, measuredWidth: 1440, measuredHeight: 1400 },
      styles: { fills: [{ r: 0.05, g: 0.05, b: 0.08, a: 1 }] },
      children: [block('A', 0), block('B', 700)],
    };
    const figma = await runPlugin({ rootNode: root, board: true });
    const sub = sectionsOf(figma).find((s: any) => s.name === '02 · Secciones');
    const comps = sub.children.filter((c: any) => c.type === 'COMPONENT');
    expect(comps).toHaveLength(2);
    for (const c of comps) expect(c.fills[0].color).toMatchObject({ r: 0.05, g: 0.05 });
  });

  it('QA-12: borrar el envío desde el plugin borra el tablero entero y el historial se depura', async () => {
    const figma = loadPlugin({}, { ...console, log() {}, warn() {} });
    await figma.ui.onmessage({ type: 'RENDER_NODES', payload: { rootNode: clone(landing), board: true } });
    const ok = figma.logs.find((m: any) => m.type === 'RENDER_SUCCESS');
    // Todas las Sections del tablero (03 se omite si la página no tiene componentes repetidos)
    expect(ok.nodeIds.length).toBeGreaterThanOrEqual(3);
    expect([...ok.nodeIds].sort()).toEqual(
      sectionsOf(figma)
        .map((x: any) => x.id)
        .sort(),
    );
    // El historial guarda el envío; tras borrarlo, GET_HISTORY ya no lo devuelve
    await figma.ui.onmessage({ type: 'SET_HISTORY', items: [{ id: ok.nodeId, name: ok.name, nodeIds: ok.nodeIds }] });
    await figma.ui.onmessage({ type: 'DELETE_MULTIPLE_NODES', nodeIds: ok.nodeIds });
    expect(sectionsOf(figma)).toHaveLength(0);
    expect(figma.logs.find((m: any) => m.type === 'DELETED')).toMatchObject({ nodeIds: ok.nodeIds, missing: 0 });
    await figma.ui.onmessage({ type: 'GET_HISTORY' });
    expect(figma.logs.filter((m: any) => m.type === 'HISTORY').at(-1).items).toEqual([]);
    // Borrar otra vez: informa que ya no existían, sin errores
    await figma.ui.onmessage({ type: 'DELETE_MULTIPLE_NODES', nodeIds: ok.nodeIds });
    expect(figma.logs.filter((m: any) => m.type === 'DELETED').at(-1)).toMatchObject({
      nodeIds: [],
      missing: ok.nodeIds.length,
    });
  });

  it('QA-12: el historial conserva lo que sigue en el lienzo', async () => {
    const figma = loadPlugin({}, { ...console, log() {}, warn() {} });
    await figma.ui.onmessage({ type: 'RENDER_NODES', payload: { rootNode: clone(hero) } });
    const ok = figma.logs.find((m: any) => m.type === 'RENDER_SUCCESS');
    await figma.ui.onmessage({
      type: 'SET_HISTORY',
      items: [
        { id: ok.nodeId, nodeIds: ok.nodeIds },
        { id: 'n-que-no-existe', nodeIds: ['n-que-no-existe'] },
      ],
    });
    await figma.ui.onmessage({ type: 'GET_HISTORY' });
    expect(
      figma.logs
        .filter((m: any) => m.type === 'HISTORY')
        .at(-1)
        .items.map((i: any) => i.id),
    ).toEqual([ok.nodeId]);
  });

  it('QA-7: si no se puede poner la instancia de una sección, no queda nada suelto en la página', async () => {
    const figma = await runPlugin({ rootNode: clone(landing), board: true }, { failInsertInstance: true });
    expect(figma.currentPage.children.every((c: any) => c.type === 'SECTION')).toBe(true);
    // las secciones siguen como componentes en 02 y la vista completa conserva su contenido
    const sub = sectionsOf(figma).find((x: any) => x.name === '02 · Secciones');
    expect(sub.children.some((c: any) => c.type === 'COMPONENT')).toBe(true);
    const full = sectionsOf(figma).find((x: any) => x.name === '01 · Página completa');
    expect(full.findAll((n: any) => n.type === 'TEXT').length).toBeGreaterThan(0);
    expect(figma.logs.some((m: any) => m.level === 'warn' && /conserva la copia original/.test(m.message))).toBe(true);
  });

  it('QA-8: un overlay de pantalla completa sin contenido no se toma como sección', async () => {
    const block = (name: string, y: number, h: number, withText: boolean) => ({
      type: 'FRAME',
      name,
      layout: { mode: 'VERTICAL', x: 0, y, width: 1920, height: h, measuredWidth: 1920, measuredHeight: h },
      styles: { fills: [{ r: 0.04, g: 0.07, b: 0.13, a: 1 }] },
      children: withText
        ? [
            {
              type: 'TEXT',
              name: 'Título',
              layout: { x: 0, y: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
              textData: { characters: name + ' contenido', fontSize: 32, fontFamily: 'Inter', fontWeight: 700 },
            },
          ]
        : [],
    });
    const root = {
      type: 'FRAME',
      name: 'Body',
      layout: { mode: 'NONE', width: 1920, height: 2000, measuredWidth: 1920, measuredHeight: 2000 },
      styles: { fills: [] },
      children: [
        block('Fondo', 0, 945, false),
        block('Header', 0, 69, true),
        block('Hero', 69, 897, true),
        block('Más', 966, 1034, true),
      ],
    };
    const figma = await runPlugin({ rootNode: root, board: true });
    const sub = sectionsOf(figma).find((x: any) => x.name === '02 · Secciones');
    const names = sub.children.filter((c: any) => c.type !== 'TEXT').map((c: any) => c.name);
    expect(names.some((n: string) => /Fondo/.test(n))).toBe(false);
    expect(names.length).toBe(3);
  });

  it('QA-3/9/10/4: Sections claras, 03 sin etiquetas propias y colores a la derecha de la tipografía', async () => {
    const figma = await runPlugin({ rootNode: clone(landing), board: true, source: { url: 'https://x.test/' } });
    for (const sec of sectionsOf(figma)) expect(sec.fills[0].color.r).toBeGreaterThan(0.9);
    const comps = sectionsOf(figma).find((x: any) => x.name === '03 · Componentes');
    if (comps) {
      expect(comps.children.filter((c: any) => c.type === 'TEXT')).toEqual([]);
      expect(comps.children.every((c: any) => /usos/.test(c.description || ''))).toBe(true);
    }
    const styles = sectionsOf(figma).find((x: any) => x.name === '04 · Estilos');
    const texts = styles.children.filter((c: any) => c.type === 'TEXT');
    const colorsTitle = texts.find((t: any) => /^Colores/.test(t.characters));
    const typography = texts.filter((t: any) => t.x < colorsTitle.x);
    expect(typography.length).toBeGreaterThan(1);
    for (const t of typography) expect(t.x + t.width).toBeLessThan(colorsTitle.x);
  });

  it('si el tablero falla, limpia lo creado y dibuja en modo normal', async () => {
    const figma = await runPlugin({ rootNode: clone(hero), board: true }, { failSection: true });
    expect(
      figma.logs.some((m: any) => m.level === 'error' && /No se pudo organizar como tablero/.test(m.message)),
    ).toBe(true);
    expect(figma.logs.some((m: any) => m.type === 'RENDER_SUCCESS')).toBe(true);
    expect(sectionsOf(figma)).toHaveLength(0);
    expect(figma.currentPage.children).toHaveLength(1);
  });
});

describe('fuentes (fase 5.3)', () => {
  const text = (id: string, fontFamily: string) => ({
    id,
    name: id,
    type: 'TEXT',
    layout: { mode: 'NONE', width: 200, height: 20 },
    styles: { fills: [] },
    textData: { characters: 'Texto ' + id, fontSize: 16, fontFamily, fontWeight: 400 },
  });
  const page = (fontMap?: Record<string, string>) => ({
    rootNode: {
      id: 'raiz',
      name: 'Raíz',
      type: 'FRAME',
      layout: { mode: 'VERTICAL', width: 400, height: 200 },
      styles: { fills: [] },
      children: [
        text('a', '"Circular", Helvetica, sans-serif'),
        text('b', 'Proxima Nova, sans-serif'),
        text('c', 'Inter, sans-serif'),
      ],
    },
    ...(fontMap ? { fontMap } : {}),
  });
  const families = (figma: any) => {
    const out: Record<string, string> = {};
    (function w(n: any) {
      if (n.type === 'TEXT') out[n.name] = n.fontName.family;
      (n.children || []).forEach(w);
    })(figma.currentPage);
    return out;
  };

  it('usa la equivalencia más parecida que esté instalada e informa cada sustitución', async () => {
    const figma = await runPlugin(page(), { families: ['Inter', 'Helvetica Neue', 'Montserrat'] });
    expect(errorsOf(figma)).toEqual([]);
    expect(families(figma)).toEqual({ a: 'Inter', b: 'Montserrat', c: 'Inter' });
    const ok = figma.logs.find((m: any) => m.type === 'RENDER_SUCCESS');
    expect(ok.fontSubstitutions).toEqual(
      expect.arrayContaining([
        { requested: 'Circular', used: 'Inter', texts: 1 },
        { requested: 'Proxima Nova', used: 'Montserrat', texts: 1 },
      ]),
    );
    expect(ok.fontSubstitutions).toHaveLength(2); // Inter → Inter no es sustitución
    const warn = figma.logs.find((m: any) => m.type === 'LOG' && /sustituidas/.test(m.message));
    expect(warn.message).toMatch(/Circular → Inter/);
  });

  it('las equivalencias de los ajustes mandan sobre las de por defecto', async () => {
    const figma = await runPlugin(page({ Circular: 'Helvetica Neue' }), {
      families: ['Inter', 'Helvetica Neue', 'Montserrat'],
    });
    expect(families(figma).a).toBe('Helvetica Neue');
  });

  it('sin sustituciones no hay aviso', async () => {
    const figma = await runPlugin({ rootNode: page().rootNode.children[2] });
    expect(figma.logs.find((m: any) => m.type === 'RENDER_SUCCESS').fontSubstitutions).toBeUndefined();
    expect(figma.logs.some((m: any) => m.type === 'LOG' && /sustituidas/.test(m.message))).toBe(false);
  });
});
