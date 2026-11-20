// Flujo de texto (fase 5.5): texto alrededor de floats y alineación en celdas de tabla
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1000, height: 800 });
let page: any;
const get = async (id: string) => {
  page = page || (await B.page('synthetic/flow.html'));
  return (await extract(page, `document.getElementById('${id}')`)).rootNode;
};
const texts = (root: any) =>
  flatten(root)
    .filter((x: any) => x.node.type === 'TEXT')
    .map((x: any) => x.node);

describe('texto alrededor de un float', () => {
  it('las líneas junto al float empiezan a su derecha; las de debajo, al margen normal', async () => {
    const root = await get('floated');
    const group = flatten(root).find((x: any) => x.node.metadata?.textAroundFloat).node;
    const [beside, below] = group.children;
    expect(beside.layout.x).toBe(130); // 120 px de imagen + 10 de margen
    expect(below.layout.x).toBe(0);
    expect(below.layout.y).toBeGreaterThanOrEqual(70); // por debajo del float
    // No se pierde ni se duplica texto, y la negrita sigue en su sitio
    const all = group.children.map((t: any) => t.textData.characters).join('\n');
    expect(all.replace(/\s+/g, ' ')).toMatch(/^Lorem ipsum dolor sit amet consectetur .* commodo consequat\.$/);
    const bold = beside.textData.segments?.find((s: any) => String(s.fontWeight) === '700');
    expect(beside.textData.characters.slice(bold.start, bold.end)).toBe('consectetur');
  });

  it('un párrafo sin floats sigue siendo un solo texto', async () => {
    const root = await get('plain');
    expect(root.type).toBe('TEXT');
    expect(root.textData.lineCount).toBeGreaterThan(1);
  });
});

describe('celdas de tabla', () => {
  it('vertical-align y text-align se traducen a la alineación del Auto Layout', async () => {
    const cells = flatten(await get('table'))
      .map((x: any) => x.node)
      .filter((n: any) => n.type === 'FRAME' && /^Td/.test(n.name));
    const by = (t: string) => cells.find((c: any) => texts(c)[0].textData.characters === t).layout;
    expect(by('Centrado')).toMatchObject({
      mode: 'VERTICAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'MIN',
    });
    expect(by('Abajo')).toMatchObject({ primaryAxisAlignItems: 'MAX', counterAxisAlignItems: 'MAX' });
    expect(by('Arriba')).toMatchObject({ primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'CENTER' });
  });
});
