// Orden de capas de CSS (QA-8): z-index negativo debajo, positivo encima; el flujo no se toca
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });
const nameHas = (n: any, s: string) => n.name.includes(s) || JSON.stringify(n).includes(`"characters":"${s}"`);

describe('orden de capas', () => {
  it('fondo con z-index -1 al final del DOM → primera capa (debajo); z-index 5 → última (encima)', async () => {
    const page = await B.page('synthetic/layers.html');
    const { rootNode } = await extract(page, "document.getElementById('page')");
    const kids = rootNode.children;
    const fills = (n: any) => JSON.stringify(n.styles.fills);
    expect(fills(kids[0])).toContain('0.058'); // #0f172a, el fondo
    expect(nameHas(kids.at(-1), 'Nuevo')).toBe(true); // el aviso
  });

  it('decoración con z-index -1 al final del DOM queda debajo de los bloques', async () => {
    const page = await B.page('synthetic/layers.html');
    const { rootNode } = await extract(page, "document.getElementById('stack')");
    const kids = rootNode.children;
    expect(kids).toHaveLength(3);
    expect(nameHas(kids[1], 'Uno')).toBe(true);
    expect(nameHas(kids[2], 'Dos')).toBe(true);
    expect(nameHas(kids[0], 'Uno') || nameHas(kids[0], 'Dos')).toBe(false); // la decoración, abajo
  });
});
