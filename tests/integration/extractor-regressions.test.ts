// Regresiones de la ronda de cambios hecha con Gemini (2026-11-20/21): cada caso reproduce algo que
// salía mal en Figma real. Extracción real en Chromium con el extractor de la extensión.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });
let page: any;
const get = async (id: string) => {
  page = page || (await B.page('synthetic/regressions.html'));
  return (await extract(page, `document.getElementById('${id}')`)).rootNode;
};
const names = (root: any) => flatten(root).map((x: any) => x.node.name);
const texts = (root: any) =>
  flatten(root)
    .map((x: any) => x.node.textData?.characters)
    .filter(Boolean)
    .join(' ');
const gradients = (n: any) => (n.styles?.fills || []).filter((f: any) => f.type && f.type.startsWith('GRADIENT'));

describe('patrones de fondo', () => {
  it('una cuadrícula real (trazos de 1 px, tesela en px) → mosaico, sin los degradados estirados', async () => {
    const n = await get('grid');
    expect(n.imageData).toMatch(/^data:image\/png/);
    expect(n.styles.imageScaleMode).toBe('TILE');
    expect(gradients(n)).toHaveLength(0);
  });

  it('cuadrícula + viñeta radial en el mismo fondo → mosaico de la cuadrícula y la viñeta como degradado', async () => {
    const n = await get('gridvignette');
    expect(n.imageData).toMatch(/^data:image\/png/);
    expect(n.styles.imageScaleMode).toBe('TILE');
    expect(gradients(n).map((g: any) => g.type)).toEqual(['GRADIENT_RADIAL']);
  });

  it('cuadrícula con repeating-linear-gradient → mosaico', async () => {
    const n = await get('gridrepeat');
    expect(n.imageData).toMatch(/^data:image\/png/);
    expect(gradients(n)).toHaveLength(0);
  });

  it('cuadrícula en un pseudo-elemento con viñeta → "Grid / Before" con mosaico', async () => {
    const grid = flatten(await get('gridpseudo')).find((x: any) => x.node.name === 'Grid / Before')?.node;
    expect(grid).toBeDefined();
    expect(grid.imageData).toMatch(/^data:image\/png/);
    expect(gradients(grid).map((g: any) => g.type)).toEqual(['GRADIENT_RADIAL']);
  });

  it('un degradado animado (90deg, 200% 100%) y un brillo radial (100% 100%) siguen siendo degradados', async () => {
    for (const id of ['shimmer', 'glow']) {
      const n = await get(id);
      expect(n.imageData, id).toBeUndefined();
      expect(gradients(n).length, id).toBeGreaterThan(0);
    }
  });
});

describe('pseudo-elementos', () => {
  it('transparente o de alto 0 → no se crea ningún frame (antes entraban en el Auto Layout)', async () => {
    expect(names(await get('ghost')).some((s: string) => /Before/.test(s))).toBe(false);
    expect(names(await get('zero')).some((s: string) => /Before/.test(s))).toBe(false);
  });

  it('con fondo y tamaño → decorador', async () => {
    const deco = flatten(await get('deco')).find((x: any) => x.node.name === 'Decorator / After');
    expect(deco).toBeDefined();
    expect(deco.node.layout).toMatchObject({ width: 50, height: 4 });
  });

  it('absoluto con anfitrión estático: se posiciona contra el ancestro posicionado', async () => {
    const after = flatten(await get('pp')).find((x: any) => /After/.test(x.node.name));
    expect(after).toBeDefined();
    // #ppwrap (relative, padding 20) contiene a #pp: el pseudo está 20 px arriba-izquierda de su anfitrión
    expect(after.node.layout).toMatchObject({ x: -20, y: -20 });
  });
});

describe('texto', () => {
  it('capitalize con tildes y apóstrofos', async () => {
    const t = flatten(await get('cap')).find((x: any) => x.node.textData)?.node.textData.characters;
    expect(t).toBe("Acción Don't Último");
  });
});

describe('SVG', () => {
  it('fill-opacity sin opacity adicional (antes la transparencia se aplicaba dos veces)', async () => {
    const svg = (await get('svgop')).svgContent as string;
    expect(svg).toMatch(/fill-opacity="0\.5"/);
    expect(svg).not.toMatch(/\sopacity="/);
  });

  it('icono de contorno: el negro por defecto no se rellena', async () => {
    const svg = (await get('outline')).svgContent as string;
    expect(svg).toMatch(/<path[^>]*fill="none"/);
    expect(svg).toMatch(/<path[^>]*stroke="#/);
  });

  it('líneas de circuito: el SVG lleva su tamaño real aunque tenga stroke-width (antes salía a escala del viewBox)', async () => {
    const root = ((await get('circuit')).svgContent as string).match(/^<svg[^>]*>/)![0];
    expect(root).toMatch(/\swidth="600"/);
    expect(root).toMatch(/\sheight="200"/);
    expect(root).toMatch(/viewBox="0 0 300 100"/);
  });

  it('SVG estirado con preserveAspectRatio="none": la escala se hornea (Figma no la reproduce)', async () => {
    const svg = (await get('circuit2')).svgContent as string;
    expect(svg).toMatch(/viewBox="0 0 600 100"/);
    expect(svg).toMatch(/matrix\(2 0 0 1 0 0\)/);
    expect(svg).not.toMatch(/preserveAspectRatio/);
  });

  it('<use> de un sprite: se inlinea con el viewBox del symbol y currentColor resuelto', async () => {
    const svg = (await get('useicon')).svgContent as string;
    expect(svg).not.toMatch(/<use/);
    expect(svg).toMatch(/viewBox="0 0 10 10"/);
    expect(svg).not.toMatch(/currentColor/i);
    expect(svg).toMatch(/rgb\(0, 128, 0\)/);
  });
});

describe('bordes', () => {
  it('borde izquierdo distinto del resto → acento, y el marco no repite ese lado', async () => {
    const s = (await get('accent')).styles;
    expect(s.accentBorder).toMatchObject({ side: 'LEFT', width: 4 });
    expect(s.borderSides).toMatchObject({ top: 1, right: 1, bottom: 1, left: 0 });
  });

  it('borde izquierdo único → lados individuales, sin acento (antes salía dos veces)', async () => {
    const s = (await get('single')).styles;
    expect(s.accentBorder).toBeUndefined();
    expect(s.borderSides).toMatchObject({ left: 3, top: 0 });
  });

  it('borde discontinuo en los cuatro lados → sin acento', async () => {
    const s = (await get('dashedall')).styles;
    expect(s.accentBorder).toBeUndefined();
    expect(s.strokes[0].style).toBe('DASHED');
  });
});

describe('párrafos con enlaces (notas al pie de apple.com)', () => {
  const textNodes = (root: any) =>
    flatten(root)
      .filter((x: any) => x.node.type === 'TEXT')
      .map((x: any) => x.node);

  it('cada nota con padding es UN solo texto con el enlace como tramo (antes: piezas que se montaban)', async () => {
    const ul = await get('footnotes');
    for (const li of ul.children) {
      const t = textNodes(li);
      expect(t, li.name).toHaveLength(1);
      const td = t[0].textData;
      const link = (td.segments || []).find((s: any) => td.characters.slice(s.start, s.end) === 'términos');
      expect(link?.underline, 'enlace subrayado').toBe(true);
    }
    // Los espacios del código fuente se colapsan: los precios quedan en su línea
    // (los saltos de línea son los medidos en el navegador; el espacio duro puede salir como espacio normal)
    const NBSP = String.fromCharCode(160);
    const first = textNodes(ul.children[0])[0].textData.characters.split(NBSP).join(' ');
    expect(first.replace(/\s+/g, ' ')).toContain('$45.900 o $62.900 o $86.900');
    expect(first).not.toMatch(/\t|\n +| {2}/); // sin tabulaciones, sangrías ni espacios dobles
  });

  it('"Busca un distribuidor cerca de ti." (enlace + texto con padding) es un solo texto', async () => {
    const t = textNodes(await get('shopline'));
    expect(t.map((n: any) => n.textData.characters)).toEqual(['Busca un distribuidor cerca de ti.']);
  });

  it('un texto suelto junto a un bloque colapsa los saltos y tabulaciones del código fuente', async () => {
    const t = textNodes(await get('mixedws')).map((n: any) => n.textData.characters);
    expect(t).toContain('Precio: $45.900 o $62.900');
  });
});

describe('textos de una línea', () => {
  it('un texto suelto junto a un elemento lleva la marca de una sola línea (Figma no lo parte)', async () => {
    const all = flatten(await get('chiptext')).filter((x: any) => x.node.type === 'TEXT');
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const x of all) expect(x.node.textData.noWrap, x.node.textData.characters).toBe(true);
  });
});

describe('ancho de badges y botones', () => {
  it('un número en círculo de 20 px conserva su ancho (antes HUG: una barrita de 7 px sin número)', async () => {
    const box = await get('badges');
    const byText = (t: string) => flatten(box).find((x: any) => x.node.type !== 'TEXT' && texts(x.node) === t)?.node;
    expect(byText('1')?.layout.width).toBe(20);
    expect(byText('Nuevo')?.layout.width).toBe('HUG'); // se ajusta al texto en la web
    expect(byText('Ir')?.layout.width).toBe(200); // ancho fijo
  });
});

describe('nombres de capa', () => {
  it('CSS Modules de Vite y clases de alcance no acaban en el nombre ("Head Pgjsj 6")', async () => {
    expect((await get('cssmod')).name).toBe('Head');
    expect((await get('scoped')).name).toBe('Lab-row');
  });
});

describe('layout', () => {
  it('un video dentro de un hijo no quita el Auto Layout al contenedor', async () => {
    expect((await get('vidwrap')).layout.mode).toBe('VERTICAL');
  });

  it('contenedor de alto 0 → abarca a sus hijos (no el alto del padre) y sin su fondo invisible', async () => {
    const tall = await get('tall');
    const collapsed = flatten(tall).find((x: any) => x.depth === 1)?.node;
    expect(collapsed).toBeDefined();
    expect(collapsed.layout.height).toBe(80);
    expect(collapsed.styles.fills).toEqual([]);
  });
});
