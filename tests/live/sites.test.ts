// Pruebas contra sitios reales. NO corren en el CI (los sitios cambian sin aviso y requieren red):
//   npm run test:live
// Sirven para validar el extractor con páginas de verdad antes de publicar cambios grandes.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';
import { validateRenderPayload } from '../../packages/contracts/src/schemas';

const require = createRequire(import.meta.url);
const { extract, flatten, imageDimensions } = require('../helpers/extension-sim.cjs');
const { auditLayout } = require('../helpers/layout-audit.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

const B = useBrowser({ width: 1440, height: 900 });

async function open(url: string) {
  const page = await B.page();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => page.waitForTimeout(3000));
  return page;
}

describe.each([
  ['https://www.apple.com/co/', "document.querySelector('main')"],
  ['https://github.com/', "document.querySelector('main') || document.body"],
  ['https://stripe.com/', "document.querySelector('main') || document.body"],
  ['https://vercel.com/', "document.querySelector('main') || document.body"],
  ['https://tailwindcss.com/', "document.querySelector('main') || document.body"],
  ['https://www.notion.com/', "document.querySelector('main') || document.body"],
])('%s', (url, selector) => {
  it('layout: 0 hijos mal ubicados y payload válido', async () => {
    const page = await open(url);
    const { rootNode, tokens } = await extract(page, selector, { normalize: false });
    const audit = auditLayout(rootNode);
    expect(audit.examples).toEqual([]);
    expect(audit.misplaced).toBe(0);
    const v = validateRenderPayload({ rootNode, tokens, board: true, source: { url } });
    expect(v.ok ? 'ok' : v.error).toBe('ok');
    await page.close();
  });
});

describe('casos concretos de las sesiones de trabajo', () => {
  it('Apple: galería de Apple TV con las 9 imágenes y tile del iPad mini con el hero ≤ 4096 px', async () => {
    const page = await open('https://www.apple.com/co/');
    const gallery = await extract(page, "document.querySelector('.section-endless-entertainment-gallery')");
    expect((await imageDimensions(page, gallery.rootNode)).length).toBe(9);
    const tile = await extract(
      page,
      "[...document.querySelectorAll('.tile-wrapper')].find(t => /mano llena/i.test(t.textContent))",
    );
    const dims = await imageDimensions(page, tile.rootNode);
    expect(dims.length).toBeGreaterThanOrEqual(2);
    expect(dims.every((d: any) => d.ok && Math.max(d.w, d.h) <= 4096)).toBe(true);
    await page.close();
  });

  it('Wikipedia: artículo grande válido según el esquema', async () => {
    const page = await open('https://es.wikipedia.org/wiki/Colombia');
    const { rootNode } = await extract(page, "document.querySelector('#content')", { normalize: false });
    const v = validateRenderPayload({ rootNode });
    expect(v.ok ? v.nodeCount : v.error).toBeGreaterThan(1000);
    await page.close();
  });

  it('indudesk.online: body completo como tablero, con sus secciones separadas', async () => {
    const page = await open('https://indudesk.online/');
    const { rootNode, tokens } = await extract(page, 'document.body', { prescroll: true });
    const figma = await runPlugin({ rootNode, tokens, board: true, source: { url: 'https://indudesk.online/' } });
    expect(figma.logs.filter((m: any) => m.type === 'RENDER_ERROR' || m.level === 'error')).toEqual([]);
    const sub = figma.currentPage.children.find((n: any) => n.name === '02 · Secciones');
    const titles = sub.children.filter((c: any) => c.type === 'TEXT').map((t: any) => t.characters);
    expect(titles.length).toBeGreaterThanOrEqual(8);
    expect(titles[0]).toMatch(/Header/);
    expect(flatten(rootNode).length).toBeGreaterThan(100);
    await page.close();
  });
});
