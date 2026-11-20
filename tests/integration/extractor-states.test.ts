// Estados de interacción emulados desde las hojas de estilo (fase 6.1)
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { injectExtension, flatten } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1000, height: 700 });
const hex = (c: any) =>
  '#' +
  [c.r, c.g, c.b]
    .map((v: number) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

async function open() {
  const page = await B.page('synthetic/states.html');
  await injectExtension(page);
  return page;
}
const extractState = (page: any, id: string, state = 'hover') =>
  page.evaluate(({ id, state }: any) => (window as any).__codeToFigmaExtractState(document.getElementById(id), state), {
    id,
    state,
  });
const textColor = (root: any, characters: string) =>
  hex(flatten(root).find((x: any) => x.node.textData?.characters === characters).node.styles.fills[0]);

describe('estados emulados', () => {
  it('hover propio: otro fondo; la página queda intacta y la extracción normal no cambia', async () => {
    const page = await open();
    const normal = await page.evaluate(async () =>
      (window as any).__codeToFigmaExtract(document.getElementById('btn')),
    );
    const hover = await extractState(page, 'btn');
    expect(hex(normal.rootNode.styles.fills[0])).toBe('#2563eb');
    expect(hex(hover.rootNode.styles.fills[0])).toBe('#1e40af'); // sin esperar la transición de 0,3 s
    const after = await page.evaluate(() => ({
      attrs: document.querySelectorAll('[data-ctf-state]').length,
      sheets: document.adoptedStyleSheets.length,
      bg: getComputedStyle(document.getElementById('btn')!).backgroundColor,
    }));
    expect(after).toEqual({ attrs: 0, sheets: 0, bg: 'rgb(37, 99, 235)' });
  });

  it('hover de la tarjeta cambia el título, pero no activa el hover del enlace interno', async () => {
    const page = await open();
    const hover = await extractState(page, 'card');
    expect(textColor(hover.rootNode, 'Título')).toBe('#dc2626');
    expect(textColor(hover.rootNode, 'Ver más')).toBe('#2563eb');
  });

  it('sin reglas que lo cambien → null; las reglas de @media que no aplican se ignoran', async () => {
    const page = await open();
    expect(await extractState(page, 'plain')).toBeNull();
    const hover = await extractState(page, 'btn');
    expect(hex(hover.rootNode.styles.fills[0])).not.toBe('#000000');
  });
});

describe('en Figma: State=Default / State=Hover', () => {
  it('un set de variantes con ambos estados', async () => {
    const page = await open();
    const [normal, hover] = await page.evaluate(async () => {
      const el = document.getElementById('btn');
      return [
        (await (window as any).__codeToFigmaExtract(el)).rootNode,
        (await (window as any).__codeToFigmaExtractState(el, 'hover')).rootNode,
      ];
    });
    const figma = await runPlugin({ rootNode: normal, states: [{ name: 'Hover', rootNode: hover }] });
    const set = figma.currentPage.children.find((n: any) => n.type === 'COMPONENT_SET');
    expect(set).toBeTruthy();
    expect(set.children.map((c: any) => c.name)).toEqual(['State=Default', 'State=Hover']);
    expect(figma.logs.some((m: any) => m.type === 'RENDER_SUCCESS')).toBe(true);
  });
});
