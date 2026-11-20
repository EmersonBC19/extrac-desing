// Grids 2D (fase 5.6): Auto Layout con wrap cuando las filas son regulares
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1200, height: 900 });
let page: any;
const get = async (id: string) => {
  page = page || (await B.page('synthetic/grid.html'));
  return (await extract(page, `document.getElementById('${id}')`)).rootNode;
};

describe('grids 2D', () => {
  it('tarjetas en filas regulares → Auto Layout horizontal con wrap, gaps y tamaños medidos', async () => {
    const g = await get('cards');
    expect(g.layout).toMatchObject({ mode: 'HORIZONTAL', layoutWrap: 'WRAP', itemSpacing: 24, counterAxisSpacing: 16 });
    expect(g.children).toHaveLength(6);
    expect(g.children.every((c: any) => c.layout.width === 200)).toBe(true);
    // El ancho disponible deja exactamente 3 columnas: la 4.ª tarjeta salta de fila igual que en la web
    const inner = g.layout.measuredWidth - g.layout.padding.left - g.layout.padding.right;
    expect(inner).toBe(3 * 200 + 2 * 24);
  });

  it('columnas de distinto ancho (2fr 1fr) también', async () => {
    const g = await get('fr');
    expect(g.layout).toMatchObject({ mode: 'HORIZONTAL', layoutWrap: 'WRAP' });
    expect(g.children[0].layout.width).toBe(400);
    expect(g.children[1].layout.width).toBe(200);
  });

  it('con áreas o celdas que ocupan varias filas: posiciones exactas (NONE)', async () => {
    expect((await get('areas')).layout.mode).toBe('NONE');
    expect((await get('span')).layout.mode).toBe('NONE');
  });

  it('en Figma el frame queda con wrap y espaciado entre filas', async () => {
    const figma = await runPlugin({ rootNode: await get('cards') });
    const f = figma.currentPage.children[0];
    expect(f.layoutMode).toBe('HORIZONTAL');
    expect(f.layoutWrap).toBe('WRAP');
    expect(f.counterAxisSpacing).toBe(16);
  });
});
