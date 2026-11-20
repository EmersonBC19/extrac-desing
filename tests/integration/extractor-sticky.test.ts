// Sticky (fase 5.7): posición natural si lo pega el scroll de la página; tal cual si lo pega un contenedor
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1000, height: 700 });
/** El frame que contiene el texto (o el propio texto si es una hoja sin fondo) */
const boxOf = (root: any, text: string) => {
  const hit = flatten(root).find((x: any) => x.node.textData?.characters === text);
  return hit.node.layout.y === 0 && hit.parent && hit.parent !== root ? hit.parent : hit.node;
};

describe('elementos sticky', () => {
  it('pegado por el scroll de la página: va en su posición natural y el DOM queda intacto', async () => {
    const page = await B.page('synthetic/sticky.html');
    const { rootNode } = await extract(page, "document.getElementById('wrap')");
    const nav = boxOf(rootNode, 'Menú');
    expect(nav.layout.y).toBe(50); // natural: debajo de la intro, no a 100 px donde lo pega `top`
    const after = await page.evaluate(() => {
      const n = document.getElementById('nav')!;
      return { inline: n.style.position, computed: getComputedStyle(n).position };
    });
    expect(after).toEqual({ inline: 'sticky', computed: 'sticky' });
  });

  it('pegado por el scroll de un contenedor: se conserva donde se ve', async () => {
    const page = await B.page('synthetic/sticky.html');
    await page.evaluate(() => (document.getElementById('box')!.scrollTop = 300));
    const { rootNode } = await extract(page, "document.getElementById('box')");
    const node = flatten(rootNode).find((x: any) => x.node.layout?.height === 30)!.node;
    expect(node.layout.y).toBe(0); // pegado arriba del contenedor, como en pantalla
  });
});
