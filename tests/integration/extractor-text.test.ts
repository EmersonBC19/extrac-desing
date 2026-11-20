import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import type { Page } from 'playwright';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });

/** Líneas que pinta el navegador para el texto de un elemento (tops distintos de sus rectángulos) */
async function browserLines(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)!;
    const r = document.createRange();
    r.selectNodeContents(el);
    const tops: number[] = [];
    for (const rect of Array.from(r.getClientRects())) {
      if (rect.width < 1) continue;
      const mid = rect.top + rect.height / 2;
      if (!tops.some(t => Math.abs(t - mid) < 8)) tops.push(mid);
    }
    return tops.length;
  }, selector);
}

const textOf = (root: any) => flatten(root).map((x: any) => x.node).filter((n: any) => n.type === 'TEXT');

describe('texto (synthetic/text.html)', () => {
  it('párrafo con <sup><a>1</a></sup>: un solo texto, superíndice Unicode y los mismos saltos de línea que el navegador', async () => {
    const page = await B.page('synthetic/text.html');
    const { rootNode } = await extract(page, "document.getElementById('inline')");
    expect(rootNode.type).toBe('TEXT'); // antes: TEXT + frame suelto con el "1"
    const td = rootNode.textData;
    expect(td.characters.endsWith('wearable.¹')).toBe(true);
    expect(td.noWrap).toBe(true);
    const lines = await browserLines(page, '#inline');
    expect(lines).toBeGreaterThan(1);
    expect(td.lineCount).toBe(lines);
    expect(td.characters.split('\n')).toHaveLength(lines);
    expect(td.segments.some((s: any) => s.baseline === 'SUPER')).toBe(true);
  });

  it('superíndice por font-feature-settings "numr" (sin <sup>)', async () => {
    const page = await B.page('synthetic/text.html');
    const { rootNode } = await extract(page, "document.getElementById('numr')");
    expect(rootNode.textData.characters.endsWith('²')).toBe(true);
  });

  it('enlace y negrita como tramos de estilo del mismo texto', async () => {
    const page = await B.page('synthetic/text.html');
    const { rootNode } = await extract(page, "document.getElementById('rich')");
    expect(rootNode.type).toBe('TEXT');
    const segs = rootNode.textData.segments;
    const chars = rootNode.textData.characters;
    const link = segs.find((s: any) => chars.slice(s.start, s.end) === 'un enlace azul');
    expect(link).toBeTruthy();
    expect(link.underline).toBe(true);
    expect(link.color.b).toBeCloseTo(0.8, 1);
    expect(segs.some((s: any) => chars.slice(s.start, s.end) === 'negrita' && Number(s.fontWeight) >= 600)).toBe(true);
  });

  it('line-clamp: solo las líneas visibles, con puntos suspensivos', async () => {
    const page = await B.page('synthetic/text.html');
    const { rootNode } = await extract(page, "document.getElementById('clamp')");
    expect(rootNode.textData.lineCount).toBe(2);
    expect(rootNode.textData.characters.endsWith('…')).toBe(true);
  });

  it('texto solo para lectores de pantalla (sr-only) no se exporta', async () => {
    const page = await B.page('synthetic/text.html');
    const { rootNode } = await extract(page, "document.getElementById('sronly')");
    const all = textOf(rootNode).map((t: any) => t.textData.characters).join(' ');
    expect(all).not.toMatch(/lectores/);
    expect(all.replace(/\s+/g, ' ')).toMatch(/iPad\s*mini/);
  });

  it('text-transform, <br> y etiqueta de botón de una línea', async () => {
    const page = await B.page('synthetic/text.html');
    expect((await extract(page, "document.getElementById('upper')")).rootNode.textData.characters).toBe('SOFTWARE PARA INGENIERÍA APLICADA');
    expect((await extract(page, "document.getElementById('br')")).rootNode.textData.characters).toBe('Primera línea\nSegunda línea');
    const btn = (await extract(page, "document.getElementById('button')")).rootNode;
    const label = textOf(btn)[0];
    expect(label.textData.characters).toBe('Más información');
    expect(label.textData.lineCount).toBe(1);
    expect(label.textData.noWrap).toBe(true);
  });
});
