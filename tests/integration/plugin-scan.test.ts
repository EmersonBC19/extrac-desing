// Escaneo del sitio en Figma (simulador): mapa del sitio en fila y tablero con todas las rutas
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadPlugin } = require('../helpers/figma-mock.cjs');

const quiet = { ...console, log() {}, warn() {}, error() {} };
const text = (characters: string, size = 16) => ({
  type: 'TEXT',
  name: 'Texto',
  layout: { width: 'HUG', height: 'HUG', x: 20, y: 12 },
  styles: { fills: [{ r: 0.1, g: 0.1, b: 0.1, a: 1 }] },
  textData: { characters, fontSize: size, fontFamily: 'Inter', fontWeight: 400 },
});
// Botón que se repite en todas las páginas: el tablero lo detecta como componente entre rutas
const button = (label: string, x: number) => ({
  type: 'FRAME',
  name: 'Button / Primary',
  layout: { mode: 'HORIZONTAL', x, y: 200, width: 160, height: 44, measuredWidth: 160, measuredHeight: 44 },
  styles: { fills: [{ r: 0.15, g: 0.39, b: 0.92, a: 1 }], cornerRadius: 8 },
  children: [text(label)],
});
const pageTree = (title: string, w = 1280, h = 900) => ({
  id: 'body_' + title,
  type: 'FRAME',
  name: 'Body',
  layout: { mode: 'NONE', width: w, height: h, measuredWidth: w, measuredHeight: h },
  styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
  children: [text(title, 32), button('Empezar', 20), button('Contacto', 200)],
});

async function scanInto(figma: any, scanId: string, pages: [string, string][]) {
  for (const [i, [path, title]] of pages.entries()) {
    await figma.ui.onmessage({
      type: 'RENDER_NODES',
      payload: { rootNode: pageTree(title), scan: { id: scanId, index: i, total: pages.length, path, label: title } },
    });
  }
}
const sections = (figma: any) => figma.currentPage.children.filter((n: any) => n.type === 'SECTION');

describe('escaneo del sitio en Figma', () => {
  const PAGES: [string, string][] = [
    ['/inicio', 'Inicio'],
    ['/precios', 'Precios'],
    ['/equipo', 'Equipo'],
  ];

  it('cada página llega al mapa en fila, con su ruta como título, sin ítems sueltos del receptor', async () => {
    const figma = loadPlugin({}, quiet);
    await scanInto(figma, 's1', PAGES);
    const frames = figma.currentPage.children.filter((n: any) => n.type === 'FRAME');
    expect(frames).toHaveLength(3);
    // en fila: cada una a la derecha de la anterior, misma altura
    expect(frames[1].x).toBeGreaterThan(frames[0].x + frames[0].width);
    expect(frames[2].x).toBeGreaterThan(frames[1].x + frames[1].width);
    expect(new Set(frames.map((f: any) => f.y)).size).toBe(1);
    const titles = figma.currentPage.children.filter((n: any) => n.type === 'TEXT').map((t: any) => t.characters);
    expect(titles).toEqual(['1 · /inicio — Inicio', '2 · /precios — Precios', '3 · /equipo — Equipo']);
    const ok = figma.logs.filter((m: any) => m.type === 'RENDER_SUCCESS');
    expect(ok).toHaveLength(3);
    expect(ok.every((m: any) => m.scan && m.scan.id === 's1')).toBe(true);
  });

  it('al terminar: tablero con todas las rutas (una sección por ruta, componentes entre páginas) y sin la vista previa', async () => {
    const figma = loadPlugin({}, quiet);
    await scanInto(figma, 's2', PAGES);
    await figma.ui.onmessage({
      type: 'SCAN_FINISH',
      scanId: 's2',
      board: true,
      source: { url: 'https://www.ejemplo.com/inicio' },
    });
    expect(figma.logs.filter((m: any) => m.type === 'RENDER_ERROR')).toEqual([]);
    // solo quedan las Sections del tablero: la vista previa (frames y títulos sueltos) se retiró
    expect(figma.currentPage.children.every((n: any) => n.type === 'SECTION')).toBe(true);
    const sub = sections(figma).find((s: any) => s.name === '02 · Secciones');
    const routeSections = sub.children.filter((c: any) => c.type !== 'TEXT');
    expect(routeSections).toHaveLength(3);
    const comps = sections(figma).find((s: any) => s.name === '03 · Componentes');
    expect(comps).toBeTruthy(); // el botón se repite en las 3 páginas
    const final = figma.logs.filter((m: any) => m.type === 'RENDER_SUCCESS').at(-1);
    expect(final.scan).toBeUndefined();
    expect(final.nodeIds.length).toBeGreaterThanOrEqual(3);
  });

  it('con el tablero desactivado: queda el mapa y un solo resultado con todas sus capas', async () => {
    const figma = loadPlugin({}, quiet);
    await scanInto(figma, 's3', PAGES);
    await figma.ui.onmessage({
      type: 'SCAN_FINISH',
      scanId: 's3',
      board: false,
      source: { url: 'https://ejemplo.com/' },
    });
    expect(sections(figma)).toHaveLength(0);
    const final = figma.logs.filter((m: any) => m.type === 'RENDER_SUCCESS').at(-1);
    expect(final.name).toBe('Mapa del sitio · ejemplo.com (3 páginas)');
    expect(final.nodeIds).toHaveLength(6); // 3 frames + 3 títulos
  });

  it('el fin del escaneo espera a la última página aunque lleguen casi juntos', async () => {
    const figma = loadPlugin({}, quiet);
    // sin await entre mensajes: como cuando la UI los entrega seguidos
    const sends = PAGES.map(([path, title], i) =>
      figma.ui.onmessage({
        type: 'RENDER_NODES',
        payload: { rootNode: pageTree(title), scan: { id: 's4', index: i, total: 3, path, label: title } },
      }),
    );
    sends.push(
      figma.ui.onmessage({ type: 'SCAN_FINISH', scanId: 's4', board: true, source: { url: 'https://x.test/' } }),
    );
    await Promise.all(sends);
    const sub = sections(figma).find((s: any) => s.name === '02 · Secciones');
    expect(sub.children.filter((c: any) => c.type !== 'TEXT')).toHaveLength(3);
  });
});
