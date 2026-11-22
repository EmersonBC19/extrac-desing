// Visor 3D con tarjetas alrededor (caso real: "Conoce la placa" de una guía de ESP32, donde en Figma
// faltaban las 6 tarjetas y los marcadores numerados). Tres patrones que la extensión perdía:
//  1. tarjetas con z-index dentro de un envoltorio en flujo, sobre un canvas absoluto (orden de capas)
//  2. marcadores colgados de anclas de 0×0 (se descartaban como "sr-only")
//  3. reveal on scroll que se apaga al salir de la vista (al extraer arriba, estaban transparentes)
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten, read } = require('../helpers/extension-sim.cjs');
const { runPlugin } = require('../helpers/figma-mock.cjs');

/** Caja absoluta (en la página) de un nodo del Figma simulado */
const absBox = (n: any) => {
  let x = 0,
    y = 0;
  for (let p = n; p && p.type !== 'PAGE'; p = p.parent) {
    x += p.x || 0;
    y += p.y || 0;
  }
  return { x, y, w: n.width, h: n.height };
};
const isAncestorOf = (a: any, n: any) => {
  for (let p = n.parent; p; p = p.parent) if (p === a) return true;
  return false;
};
const inside = (a: any, b: any) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;
const overlaps = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const B = useBrowser({ width: 1200, height: 700 });
const texts = (root: any) =>
  flatten(root)
    .map((x: any) => x.node.textData?.characters)
    .filter(Boolean)
    .join(' | ');
const containsText = (n: any, t: string) => texts(n).includes(t);

describe('visor 3D con tarjetas y marcadores', () => {
  it('las tarjetas (z-index en un envoltorio en flujo) quedan sobre la captura del canvas', async () => {
    const page = await B.page('synthetic/viewer.html');
    await page.evaluate(() => document.getElementById('stage')!.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600); // que el reveal termine
    const stage = (await extract(page, `document.getElementById('stage')`)).rootNode;
    const kids = stage.children as any[];
    const iCards = kids.findIndex(c => containsText(c, 'PUERTOS USB-C'));
    const iCanvas = kids.findIndex(c => c.imageData && !containsText(c, 'PUERTOS USB-C'));
    expect(iCards, 'tarjetas extraídas').toBeGreaterThanOrEqual(0);
    expect(iCanvas, 'canvas extraído').toBeGreaterThanOrEqual(0);
    // En Figma, los primeros hijos quedan debajo: el canvas antes que las tarjetas
    expect(iCanvas).toBeLessThan(iCards);
  });

  it('los marcadores colgados de anclas de 0×0 no se descartan', async () => {
    const page = await B.page('synthetic/viewer.html');
    await page.evaluate(() => document.getElementById('stage')!.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
    const stage = (await extract(page, `document.getElementById('stage')`)).rootNode;
    const pinTexts = flatten(stage)
      .map((x: any) => x.node.textData?.characters)
      .filter((t: any) => t === '1' || t === '4');
    expect(pinTexts.sort()).toEqual(['1', '4']);
  });

  it('contenedor sin caja (display: contents) → sus tarjetas van directas a la rejilla, sin frame de 1 px', async () => {
    // Caso real: en Figma el contenedor de las 6 tarjetas medía ~1 px, estaba fuera de la sección
    // (en la esquina de la ventana) y recortaba a las tarjetas por su overflow
    const page = await B.page('synthetic/viewer.html');
    await page.evaluate(() => document.getElementById('stage2')!.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const stage = (await extract(page, `document.getElementById('stage2')`)).rootNode;
    const tiny = flatten(stage).filter(
      (x: any) =>
        x.depth > 0 &&
        x.node.type !== 'TEXT' &&
        typeof x.node.layout?.width === 'number' &&
        x.node.layout.width <= 1 &&
        x.node.layout.height <= 1,
    );
    expect(tiny.map((x: any) => x.node.name)).toEqual([]);
    const cards = (stage.children as any[]).filter(c => /PUERTOS|BOOT|LED RGB|MÓDULO|ANTENA|TIRAS/.test(texts(c)));
    expect(cards).toHaveLength(6);
    expect(cards.filter(c => c.layout.x < 50)).toHaveLength(3); // columna izquierda
    expect(cards.filter(c => c.layout.x > 500)).toHaveLength(3); // columna derecha
  });

  it('en Figma se ven las 6 tarjetas y la placa del centro no queda tapada', async () => {
    const page = await B.page('synthetic/viewer.html');
    await page.evaluate(() => document.getElementById('stage2')!.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const stage = (await extract(page, `document.getElementById('stage2')`)).rootNode;
    const figma = await runPlugin({ rootNode: stage });
    const all = figma.currentPage.findAll(() => true) as any[];
    // Cada título de tarjeta queda dentro de todos los frames que lo recortan
    for (const title of ['PUERTOS USB-C', 'BOOT Y RST', 'LED RGB', 'MÓDULO ESP32-S3', 'ANTENA DE PCB', 'TIRAS DE PINES']) {
      const t = all.find(n => n.type === 'TEXT' && String(n.characters).includes(title));
      expect(t, title).toBeDefined();
      for (let p = t.parent; p && p.type !== 'PAGE'; p = p.parent) {
        if (p.clipsContent) expect(inside(absBox(t), absBox(p)), `${title} recortado por ${p.name}`).toBe(true);
      }
    }
    // La placa (canvas → imagen) no tiene encima nada opaco que la cubra
    const board = all.find(n => (n.fills || []).some((f: any) => f.type === 'IMAGE'));
    expect(board, 'imagen del canvas').toBeDefined();
    const bb = absBox(board);
    const drawOrder = all; // findAll recorre en orden de dibujo: lo posterior queda encima
    const above = drawOrder.slice(drawOrder.indexOf(board) + 1).filter(n => !isAncestorOf(n, board));
    const covering = above.filter(
      n => n.type !== 'TEXT' && (n.fills || []).some((f: any) => f.visible !== false && (f.opacity ?? 1) > 0.5) && overlaps(absBox(n), bb),
    );
    expect(covering.map(n => n.name)).toEqual([]);
  });

  it('extrayendo la página desde arriba, las tarjetas que se ocultan al salir de la vista llegan visibles', async () => {
    const page = await B.page('synthetic/viewer.html');
    await page.evaluate(() => {
      (window as any).__sent = [];
      (window as any).chrome = {
        runtime: {
          id: 'extension-de-prueba',
          lastError: null,
          sendMessage(m: any, cb: any) {
            if (m.type === 'TRANSMIT_TO_FIGMA') (window as any).__sent.push(m.payload);
            if (cb) cb({ success: true, status: { hubRunning: true, figmaConnected: true, figmaCount: 1 } });
          },
        },
      };
      window.scrollTo(0, 0);
    });
    await page.evaluate((c: string) => (0, eval)(c), read('packages/browser-extension/extractor.js'));
    await page.evaluate((c: string) => (0, eval)(c), read('packages/browser-extension/content.js'));
    // Arriba del todo, las tarjetas están fuera de la vista y transparentes (como en la web real)
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('card1')!).opacity)).toBe('0');
    await page.evaluate(async () => {
      const inst = (window as any).__codeToFigmaInstance;
      inst.selectedElements = [document.body];
      inst.elevateElements(inst.selectedElements);
      await new Promise(r => setTimeout(r, 400));
      await inst.sendToFigma();
    });
    await page.waitForFunction(() => (window as any).__sent.length > 0, null, { timeout: 60000 });
    const payload = await page.evaluate(() => (window as any).__sent[0]);
    const all = texts(payload.rootNode);
    for (const t of ['PUERTOS USB-C', 'MÓDULO ESP32-S3', 'BOOT Y RST']) expect(all, t).toContain(t);
    // Los estilos forzados para extraer se quitan después: la página queda como estaba
    const inline = await page.evaluate(() => document.getElementById('card1')!.getAttribute('style'));
    expect(inline || '').not.toMatch(/opacity/);
  }, 90_000);
});
