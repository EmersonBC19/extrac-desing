// Efectos CSS (fase 5.4): extracción real en Chromium + dibujo en el Figma simulado
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';
import { apply, invert } from '../../packages/figma-plugin/src/gradient-geometry';

const require = createRequire(import.meta.url);
const { extract, flatten } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1440, height: 900 });
const byId = (id: string) => `document.getElementById('${id}')`;
let page: any;
const get = async (id: string) => {
  page = page || (await B.page('synthetic/effects.html'));
  return (await extract(page, byId(id))).rootNode;
};

describe('degradados: parámetros CSS completos', () => {
  it('lineal hacia abajo (CSS por defecto) y hacia una esquina', async () => {
    const lin = (await get('lin')).styles.fills.find((f: any) => f.type === 'GRADIENT_LINEAR');
    expect(lin).toMatchObject({ angle: 180 });
    expect(lin.stops).toHaveLength(2);
    const corner = (await get('corner')).styles.fills.find((f: any) => f.type === 'GRADIENT_LINEAR');
    expect(corner.toCorner.split(' ').sort()).toEqual(['right', 'top']); // Chrome: "right top"
  });

  it('radial con forma, posición y paradas en px; "circle" no se confunde con un color', async () => {
    const rad = (await get('rad')).styles.fills.find((f: any) => f.type === 'GRADIENT_RADIAL');
    expect(rad).toMatchObject({ shape: 'circle', at: { x: { v: 25, u: '%' }, y: { v: 75, u: '%' } } });
    expect(rad.stops.map((s: any) => s.px)).toEqual([0, 40]);
    const kw = (await get('radkw')).styles.fills.find((f: any) => f.type === 'GRADIENT_RADIAL');
    expect(kw.shape).toBe('circle');
    expect(kw.stops).toHaveLength(2);
  });

  it('cónico → angular, y con varias capas se toma la de arriba', async () => {
    const con = (await get('con')).styles.fills.find((f: any) => f.type === 'GRADIENT_ANGULAR');
    expect(con.from).toBe(90);
    expect(con.stops[1].position).toBeCloseTo(0.5, 5);
    const layers = (await get('layers')).styles.fills.filter((f: any) => f.type);
    expect(layers[0].type).toBe('GRADIENT_LINEAR');
  });
});

describe('efectos con equivalente en Figma', () => {
  it('mix-blend-mode, filter (blur, drop-shadow, opacity) y text-shadow', async () => {
    expect((await get('blend')).styles.blendMode).toBe('MULTIPLY');
    const fx = (await get('fx')).styles;
    expect(fx.layerBlur).toBe(4);
    expect(fx.dropShadows[0]).toMatchObject({ offset: { x: 2, y: 4 }, radius: 6 });
    expect(fx.opacity).toBeCloseTo(0.5, 3);
    const t = flatten(await get('tshadow')).find((x: any) => x.node.styles?.textShadow);
    expect(t.node.styles.textShadow[0]).toMatchObject({ offset: { x: 1, y: 2 }, radius: 3 });
  });
});

describe('efectos sin equivalente: se rasterizan con una captura', () => {
  it('rotación, filtro de color y clip-path → imagen sin hijos; traslación y escala no', async () => {
    for (const [id, reason] of [
      ['rot', /rotación/],
      ['gray', /grayscale/],
      ['clip', /clip-path/],
    ] as const) {
      const n = await get(id);
      expect(n.imageData, id).toMatch(/^data:image\//);
      expect(n.children, id).toEqual([]);
      expect(n.metadata.rasterized, id).toMatch(reason);
    }
    const moved = await get('move');
    expect(moved.imageData).toBeUndefined();
    expect(flatten(moved).some((x: any) => x.node.textData?.characters === 'Movido')).toBe(true);
  });

  it('un elemento enorme no se rasteriza (se perdería la edición); queda anotado', async () => {
    const huge = await get('huge');
    expect(huge.imageData).toBeUndefined();
    expect(huge.metadata.cssEffect).toMatch(/rotación/);
  });
});

describe('en Figma', () => {
  it('degradado vertical: de arriba a abajo en todo el alto del nodo', async () => {
    const figma = await runPlugin({ rootNode: await get('lin') });
    const frame = figma.currentPage.children[0];
    const paint = frame.fills.find((p: any) => p.type === 'GRADIENT_LINEAR');
    const M = invert(paint.gradientTransform);
    const [sx, sy] = apply(M, [0, 0.5]);
    const [ex, ey] = apply(M, [1, 0.5]);
    expect([sx, sy].map(v => Math.round(v * 100) / 100 + 0)).toEqual([0.5, 0]);
    expect([ex, ey].map(v => Math.round(v * 100) / 100 + 0)).toEqual([0.5, 1]);
  });

  it('efectos y modo de fusión aplicados al frame y al texto', async () => {
    const fx = (await runPlugin({ rootNode: await get('fx') })).currentPage.children[0];
    expect(fx.effects.map((e: any) => e.type).sort()).toEqual(['DROP_SHADOW', 'LAYER_BLUR']);
    expect(fx.opacity).toBeCloseTo(0.5, 3);
    const blend = (await runPlugin({ rootNode: await get('blend') })).currentPage.children[0];
    expect(blend.blendMode).toBe('MULTIPLY');
    const figma = await runPlugin({ rootNode: await get('tshadow') });
    const texts: any[] = [];
    (function w(n: any) {
      if (n.type === 'TEXT') texts.push(n);
      (n.children || []).forEach(w);
    })(figma.currentPage);
    expect(texts[0].effects[0]).toMatchObject({ type: 'DROP_SHADOW', offset: { x: 1, y: 2 } });
  });
});
