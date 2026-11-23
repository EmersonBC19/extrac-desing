// Textos con degradado (background-clip: text), neón (text-shadow) y contorno (-webkit-text-stroke).
// Antes el degradado quedaba como una caja de color DETRÁS del texto y las letras transparentes.
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1440, height: 900 });
let page: any;
beforeAll(async () => {
  page = await B.page('synthetic/text-color.html');
});
const get = async (id: string) => (await extract(page, `document.getElementById('${id}')`)).rootNode;
const texts = (root: any) =>
  flatten(root)
    .filter((x: any) => x.node.type === 'TEXT')
    .map((x: any) => x.node);
const frames = (root: any) =>
  flatten(root)
    .filter((x: any) => x.node.type !== 'TEXT')
    .map((x: any) => x.node);
const hasGradient = (fills: any[] = []) => fills.some(f => f && String(f.type || '').startsWith('GRADIENT'));

describe('textos con degradado, neón y contorno', () => {
  it('background-clip: text → el degradado va en las letras, sin caja de color detrás', async () => {
    for (const id of ['grad', 'fill']) {
      const root = await get(id);
      const [t] = texts(root);
      expect(t, id).toBeTruthy();
      expect(hasGradient(t.styles.fills), id).toBe(true);
      expect(
        t.styles.fills.every((f: any) => f.type || f.a > 0.5),
        id,
      ).toBe(true);
      for (const f of frames(root)) expect(hasGradient(f.styles?.fills), `${id}: caja con degradado`).toBe(false);
    }
  });

  it('una palabra con degradado dentro de un título o párrafo: un solo texto, el tramo con su color medio', async () => {
    for (const id of ['mixed', 'wrap']) {
      // Un solo texto: partirlo en piezas sueltas desarma las líneas (y se pisan con lo de abajo)
      const ts = texts(await get(id));
      expect(ts, id).toHaveLength(1);
      const t = ts[0];
      const seg = (t.textData.segments || []).find((s: any) =>
        /palabra/.test(t.textData.characters.slice(s.start, s.end)),
      );
      expect(seg?.color, id).toBeTruthy();
      expect(seg.color.a).toBe(1);
      // entre #ff00cc y #3333ff: rojo y azul presentes
      expect(seg.color.r).toBeGreaterThan(0.4);
      expect(seg.color.b).toBeGreaterThan(0.5);
    }
  });

  it('texto dentro de un contenedor con degradado recortado: las letras lo heredan', async () => {
    const root = await get('nested');
    const ts = texts(root);
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      const visible =
        hasGradient(t.styles.fills) || (t.textData.segments || []).every((s: any) => !s.color || s.color.a > 0.5);
      expect(visible).toBe(true);
    }
    for (const f of frames(root)) expect(hasGradient(f.styles?.fills)).toBe(false);
  });

  it('caja con borde y degradado en el texto: el borde se queda, el degradado pasa a las letras', async () => {
    const root = await get('pill');
    expect(hasGradient(root.styles.fills)).toBe(false);
    expect(root.styles.strokes?.length).toBeGreaterThan(0);
    expect(hasGradient(texts(root)[0].styles.fills)).toBe(true);
  });

  it('neón: el resplandor viaja como sombras del texto; contorno: trazo en las letras', async () => {
    const [neon] = texts(await get('neon'));
    expect(neon.styles.textShadow).toHaveLength(2);
    expect(neon.styles.textShadow[0].radius).toBe(8);
    const [outline] = texts(await get('outline'));
    expect(outline.styles.textStroke).toMatchObject({ width: 2 });
    expect(outline.styles.textStroke.color.r).toBeCloseTo(1, 2);
  });

  it('en Figma: degradado como relleno del texto y contorno como trazo', async () => {
    const grad = await runPlugin({ rootNode: await get('grad') });
    const gt = grad.currentPage.findAll((n: any) => n.type === 'TEXT')[0];
    expect(gt.fills[0].type).toBe('GRADIENT_LINEAR');
    const outline = await runPlugin({ rootNode: await get('outline') });
    const ot = outline.currentPage.findAll((n: any) => n.type === 'TEXT')[0];
    expect(ot.strokes[0]).toMatchObject({ type: 'SOLID' });
    expect(ot.strokeWeight).toBe(2);
  });
});
