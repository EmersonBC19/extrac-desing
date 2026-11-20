import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract } = require('../helpers/extension-sim.cjs');
const { auditLayout } = require('../helpers/layout-audit.cjs');

const B = useBrowser({ width: 1440, height: 900 });
const byId = (id: string) => `document.getElementById('${id}')`;

describe('fidelidad de layout: Figma coloca cada hijo donde lo pinta el navegador', () => {
  // [archivo, ¿tiene Auto Layout medible?] — index/text usan posiciones exactas a propósito
  // (márgenes por defecto de <p>, elementos absolutos): ahí basta con que nada quede mal ubicado
  it.each([
    ['synthetic/layout.html', true],
    ['synthetic/hero.html', true],
    ['synthetic/index.html', false],
    ['synthetic/text.html', false],
  ])('%s: 0 hijos mal ubicados', async (file, hasAutoLayout) => {
    const page = await B.page(file);
    const { rootNode } = await extract(page, byId('root'), { normalize: false });
    const audit = auditLayout(rootNode);
    if (hasAutoLayout) expect(audit.children).toBeGreaterThan(0);
    expect(audit.examples).toEqual([]);
    expect(audit.misplaced).toBe(0);
  });
});

describe('casos concretos (synthetic/layout.html)', () => {
  it('margen superior fuera del padding → padding real', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('margin'), { normalize: false });
    expect(rootNode.layout.mode).toBe('VERTICAL');
    expect(rootNode.layout.padding.top).toBe(12);
  });

  it('icono centrado con grid + place-items → CENTER', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('icon'), { normalize: false });
    expect(rootNode.layout.counterAxisAlignItems).toBe('CENTER');
  });

  it('fila con gap 10 → Auto Layout horizontal con itemSpacing 10', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('row'), { normalize: false });
    expect(rootNode.layout).toMatchObject({ mode: 'HORIZONTAL', itemSpacing: 10 });
  });

  it('separaciones irregulares → posiciones exactas', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('irregular'), { normalize: false });
    expect(rootNode.layout.mode).toBe('NONE');
  });

  it('column-reverse → orden visual (el último del DOM queda primero)', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('reverse'), { normalize: false });
    expect(rootNode.layout.mode).toBe('VERTICAL');
    expect(rootNode.children[0].layout.y).toBeLessThan(rootNode.children[1].layout.y);
  });

  it('cuadrícula uniforme con wrap → WRAP con separación entre filas', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('wrap'), { normalize: false });
    expect(rootNode.layout).toMatchObject({
      mode: 'HORIZONTAL',
      layoutWrap: 'WRAP',
      itemSpacing: 10,
      counterAxisSpacing: 10,
    });
  });

  it('space-between se conserva', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('between'), { normalize: false });
    expect(rootNode.layout.primaryAxisAlignItems).toBe('SPACE_BETWEEN');
  });

  it('párrafo con max-width centrado no se estira a todo el ancho', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('narrow'), { normalize: false });
    const p = rootNode.children.find((c: any) => c.type === 'TEXT' && /párrafo/.test(c.textData.characters));
    expect(p.layout.width).not.toBe('FILL');
    expect(p.layout.measuredWidth).toBeLessThanOrEqual(400);
  });

  it('::before absoluto con inset -6px → posición -6,-6', async () => {
    const page = await B.page('synthetic/layout.html');
    const { rootNode } = await extract(page, byId('pseudo'), { normalize: false });
    const before = rootNode.children.find((c: any) => /Before/.test(c.name));
    expect(before.layout).toMatchObject({ x: -6, y: -6, width: 312, height: 162, positioning: 'ABSOLUTE' });
  });
});
