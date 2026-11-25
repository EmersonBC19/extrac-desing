// Escaneo del sitio en Figma (simulador): mapa del sitio en fila y tablero con todas las rutas
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { validateRenderPayload } from '../../packages/contracts/src/schemas';
import { HUB_PROTOCOL } from '../../packages/contracts/src/index';

const require = createRequire(import.meta.url);
const { loadPlugin } = require('../helpers/figma-mock.cjs');
const { startHub, connectClient } = require('../helpers/hub.cjs');

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

// Como llega desde la extensión de ahora: la URL pedida y si al final habrá tablero (lo pone la UI)
async function scanFrom(figma: any, scanId: string, pages: [string, string][], board: boolean, pageOf = pageTree) {
  for (const [i, [path, title]] of pages.entries()) {
    await figma.ui.onmessage({
      type: 'RENDER_NODES',
      payload: {
        rootNode: pageOf(title),
        source: { url: 'https://ejemplo.com' + path + '?final=1' },
        scan: {
          id: scanId,
          index: i,
          total: pages.length,
          path,
          label: title,
          url: 'https://ejemplo.com' + path + '#top',
          board,
        },
      },
    });
  }
}
async function routesOf(figma: any, origin: string) {
  const id = 'q' + Math.random().toString(36).slice(2, 8);
  await figma.ui.onmessage({ type: 'GET_ROUTES', requestId: id, origin });
  const info = figma.logs.find((m: any) => m.type === 'ROUTES_INFO' && m.requestId === id);
  return info.routes.map((r: any) => r.path).sort();
}
const named = (figma: any, name: string) => figma.currentPage.findAll((n: any) => n.name === name);
const finish = (figma: any, scanId: string, board: boolean) =>
  figma.ui.onmessage({ type: 'SCAN_FINISH', scanId, board, source: { url: 'https://ejemplo.com/' } });

describe('escaneo del sitio: menos trabajo para Figma', () => {
  const PAGES: [string, string][] = [
    ['/inicio', 'Inicio'],
    ['/precios', 'Precios'],
    ['/equipo', 'Equipo'],
  ];

  it('con tablero: cada página llega como marcador y se dibuja una sola vez, en el tablero', async () => {
    const figma = loadPlugin({}, quiet);
    const base = figma.byId.size; // la página del archivo
    await scanFrom(figma, 'b1', PAGES, true);
    const createdWhileScanning = figma.byId.size - base;
    // Durante el escaneo: un marco del tamaño de la página con su aviso, nada de la página dibujado
    const frames = figma.currentPage.children.filter((n: any) => n.type === 'FRAME');
    expect(frames.map((f: any) => [f.width, f.height])).toEqual([
      [1280, 900],
      [1280, 900],
      [1280, 900],
    ]);
    expect(frames.every((f: any) => f.children.length === 1 && f.children[0].type === 'TEXT')).toBe(true);
    expect(named(figma, 'Button / Primary')).toHaveLength(0);
    const titles = figma.currentPage.children.filter((n: any) => n.type === 'TEXT').map((t: any) => t.characters);
    expect(titles).toEqual(['1 · /inicio — Inicio', '2 · /precios — Precios', '3 · /equipo — Equipo']);
    expect(figma.logs.filter((m: any) => m.type === 'RENDER_SUCCESS' && m.scan)).toHaveLength(3);

    // "Tablero: nunca" a mitad del escaneo no deja los marcadores como resultado: manda la 1.ª página
    await finish(figma, 'b1', false);
    expect(figma.logs.filter((m: any) => m.type === 'RENDER_ERROR')).toEqual([]);
    expect(figma.currentPage.children.every((n: any) => n.type === 'SECTION')).toBe(true);
    const sub = sections(figma).find((s: any) => s.name === '02 · Secciones');
    expect(sub.children.filter((c: any) => c.type !== 'TEXT')).toHaveLength(3);
    expect(sections(figma).find((s: any) => s.name === '03 · Componentes')).toBeTruthy();

    // Como antes (cada página dibujada en el mapa y otra vez en el tablero): el escaneo ya creaba las
    // páginas enteras; ahora, 3 capas por página (marco, aviso y título) sea cual sea su tamaño
    const before = loadPlugin({}, quiet);
    await scanInto(before, 'b0', PAGES);
    expect(createdWhileScanning).toBe(3 * PAGES.length);
    expect(before.byId.size).toBeGreaterThan(3 * PAGES.length * 2);
    await finish(before, 'b0', true);
    expect(figma.byId.size).toBeLessThan(before.byId.size);
  });

  it('cada página lleva la marca de su ruta: el plugin dice cuáles de un sitio ya están en el archivo', async () => {
    // Sin tablero: las páginas del mapa
    const map = loadPlugin({}, quiet);
    await scanFrom(map, 'm1', PAGES, false);
    await finish(map, 'm1', false);
    expect(await routesOf(map, 'https://ejemplo.com')).toEqual(['/equipo', '/inicio', '/precios']);
    expect(await routesOf(map, 'https://otro.com')).toEqual([]);
    const info = map.logs.find((m: any) => m.type === 'ROUTES_INFO');
    // la URL que se pidió, sin #fragmento (no la final de una redirección)
    expect(info.routes.map((r: any) => r.url)).toContain('https://ejemplo.com/inicio');
    // Lo que cuenta es el lienzo: borrar una página del mapa la vuelve pendiente
    map.currentPage.children.find((n: any) => n.type === 'FRAME' && n.name === 'Body').remove();
    expect(await routesOf(map, 'https://ejemplo.com')).toHaveLength(2);

    // Con tablero: las secciones de cada ruta (los marcadores no cuentan y se retiran)
    const board = loadPlugin({}, quiet);
    await scanFrom(board, 'b2', PAGES.slice(0, 2), true);
    expect(await routesOf(board, 'https://ejemplo.com')).toEqual([]); // aún no dibujadas
    await finish(board, 'b2', true);
    expect(await routesOf(board, 'https://ejemplo.com')).toEqual(['/inicio', '/precios']);
  });

  it('si el tablero no se puede armar, el mapa se dibuja en lugar de los marcadores', async () => {
    // Una página en el límite de profundidad: sola es válida; dentro del tablero (un nivel más), no
    const chain = (depth: number) => {
      let node: any = text('fondo');
      for (let i = 0; i < depth; i++)
        node = { type: 'FRAME', name: 'Capa', layout: { mode: 'NONE', width: 1280, height: 900 }, children: [node] };
      return {
        ...node,
        name: 'Body',
        layout: { mode: 'NONE', width: 1280, height: 900, measuredWidth: 1280, measuredHeight: 900 },
      };
    };
    let depth = 300;
    while (validateRenderPayload({ rootNode: chain(depth + 1) }).ok) depth++;
    expect(validateRenderPayload({ rootNode: chain(depth) }).ok).toBe(true);
    expect(validateRenderPayload({ rootNode: { type: 'FRAME', name: 'x', children: [chain(depth)] } }).ok).toBe(false);

    const figma = loadPlugin({}, quiet);
    await scanFrom(figma, 'f1', PAGES.slice(0, 2), true, () => chain(depth));
    await finish(figma, 'f1', true);
    expect(
      figma.logs.some((m: any) => /No se pudo armar el tablero del sitio.*Se dibuja el mapa/.test(m.message || '')),
    ).toBe(true);
    expect(sections(figma)).toHaveLength(0);
    const frames = figma.currentPage.children.filter((n: any) => n.type === 'FRAME');
    expect(frames).toHaveLength(2);
    // la página dibujada entera, con el nombre de su ruta
    expect(frames.map((f: any) => f.name)).toEqual(['/inicio — Inicio', '/precios — Precios']);
    expect(frames.every((f: any) => f.children[0].name === 'Capa')).toBe(true);
    expect(frames[1].x).toBeGreaterThan(frames[0].x + frames[0].width);
    const final = figma.logs.filter((m: any) => m.type === 'RENDER_SUCCESS').at(-1);
    expect(final.name).toBe('Mapa del sitio · ejemplo.com (2 páginas)');
    expect(final.nodeIds).toHaveLength(4); // 2 páginas + 2 títulos
    expect(await routesOf(figma, 'https://ejemplo.com')).toEqual(['/inicio', '/precios']);
  });
});

describe('rutas en Figma: extensión → hub → plugin → extensión', () => {
  it('el hub pasa la consulta al plugin con el sitio y devuelve sus rutas solo a quien preguntó', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-scan-'));
    const hub = await startHub({ home });
    try {
      const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
      const ext = await connectClient(hub.url);
      ext.send({ type: 'REGISTER_CLIENT', clientType: 'BROWSER_EXTENSION' });
      ext.send({ type: 'GET_FIGMA_ROUTES', requestId: 'r0', origin: 'https://ejemplo.com' });
      expect((await ext.waitFor((m: any) => m.type === 'FIGMA_ROUTES' && m.requestId === 'r0')).error).toMatch(
        /no está abierto/,
      );

      // Un plugin de la versión anterior (protocolo 2) no conoce la consulta: se dice en el acto,
      // y lo que ya sabía hacer (la selección del QA) le sigue llegando
      const old = await connectClient(hub.url, 'null');
      old.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code, protocol: 2 });
      await old.waitFor((m: any) => m.type === 'AUTH_OK');
      ext.send({ type: 'GET_FIGMA_ROUTES', requestId: 'r1', origin: 'https://ejemplo.com' });
      expect((await ext.waitFor((m: any) => m.type === 'FIGMA_ROUTES' && m.requestId === 'r1')).error).toMatch(
        /versión anterior/,
      );
      ext.send({ type: 'GET_FIGMA_SELECTION', requestId: 's1' });
      expect((await old.waitFor((m: any) => m.type === 'GET_FIGMA_SELECTION')).requestId).toBe('s1');
      old.close();
      await new Promise(r => setTimeout(r, 200));

      const plugin = await connectClient(hub.url, 'null');
      plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code, protocol: HUB_PROTOCOL });
      await plugin.waitFor((m: any) => m.type === 'AUTH_OK');
      ext.send({ type: 'GET_FIGMA_ROUTES', requestId: 'r2', origin: 'https://ejemplo.com' });
      const ask = await plugin.waitFor((m: any) => m.type === 'GET_FIGMA_ROUTES');
      expect(ask).toMatchObject({ requestId: 'r2', origin: 'https://ejemplo.com' });
      // Ni otro cliente ni otra clase de respuesta cierran la consulta
      ext.send({
        type: 'FIGMA_ROUTES',
        requestId: 'r2',
        routes: [{ url: 'https://ejemplo.com/falso', path: '/falso' }],
      });
      plugin.send({ type: 'FIGMA_SELECTION', requestId: 'r2', selection: null });
      plugin.send({
        type: 'FIGMA_ROUTES',
        requestId: 'r2',
        routes: [{ url: 'https://ejemplo.com/precios', path: '/precios', at: 1 }],
      });
      const got = await ext.waitFor((m: any) => m.type === 'FIGMA_ROUTES' && m.requestId === 'r2');
      expect(got.error).toBeUndefined();
      expect(got.routes).toEqual([{ url: 'https://ejemplo.com/precios', path: '/precios', at: 1 }]);
      plugin.close();
      ext.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
