// Orquestador del escaneo del sitio (service worker) con un `chrome` falso: validación de rutas,
// ventana de escaneo, envío por página, fin del escaneo, cancelación y errores.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadSiteScanner } = require('../helpers/code-loaders.cjs');
const { createSiteScanner, SCAN_LIMIT } = loadSiteScanner();

const ORIGIN = 'https://app.ejemplo.com';
const ORIGIN_TAB = { id: 1, windowId: 99, url: `${ORIGIN}/inicio`, title: 'Inicio' };

type PageSpec = { redirect?: string; fail?: boolean; slow?: number };

function setup(pages: Record<string, PageSpec> = {}, opts: { permission?: boolean } = {}) {
  const updated = new Set<any>();
  const removed = new Set<any>();
  const tabs = new Map<number, any>();
  const visited: string[] = [];
  const progress: any[] = [];
  const renders: any[] = [];
  const hubMessages: any[] = [];
  const windows = { created: 0, removed: [] as number[] };
  let asked = 0;
  let nextId = 100;
  const api = {
    windows: {
      get: async () => ({ width: 1280, height: 800 }),
      create: async ({ url }: any) => {
        windows.created++;
        const tab = { id: nextId++, url };
        tabs.set(tab.id, tab);
        return { id: nextId++, tabs: [tab] };
      },
      remove: async (id: number) => {
        windows.removed.push(id);
        for (const l of removed) l(id);
      },
      onRemoved: { addListener: (f: any) => removed.add(f) },
    },
    tabs: {
      onUpdated: { addListener: (f: any) => updated.add(f), removeListener: (f: any) => updated.delete(f) },
      update: async (tabId: number, { url }: any) => {
        visited.push(url);
        const tab = tabs.get(tabId);
        tab.url = pages[url]?.redirect || url;
        setTimeout(() => [...updated].forEach(l => l(tabId, { status: 'complete' }, tab)), pages[url]?.slow || 2);
      },
      get: async (id: number) => tabs.get(id),
      sendMessage: async (_tabId: number, m: any) => {
        progress.push(m);
      },
    },
    scripting: {
      executeScript: async ({ target, files }: any) => {
        if (files) return [];
        const url = tabs.get(target.tabId).url;
        if (pages[url]?.fail) throw new Error('la página falló');
        return [
          {
            result: {
              url,
              title: 'Título ' + new URL(url).pathname,
              rootNode: { id: url, type: 'FRAME', name: 'Body', layout: {}, styles: { fills: [] }, children: [] },
              tokens: {},
            },
          },
        ];
      },
    },
    action: { setBadgeText: async () => {} },
  };
  const scanner = createSiteScanner({
    chrome: api,
    sendRender: async (data: any) => {
      renders.push(data);
    },
    sendHubMessage: async (m: any) => {
      hubMessages.push(m);
    },
    hasPermission: async () => opts.permission !== false,
    askPermission: () => {
      asked++;
    },
    sleep: async () => {},
  });
  const finished = async () => {
    for (let i = 0; i < 200; i++) {
      const last = progress[progress.length - 1];
      if (last && ['done', 'cancelled', 'failed'].includes(last.status)) return last;
      await new Promise(r => setTimeout(r, 5));
    }
    throw new Error('el escaneo no terminó');
  };
  return { scanner, api, visited, progress, renders, hubMessages, windows, finished, asked: () => asked };
}

const route = (path: string) => ({ url: ORIGIN + path, path, label: '' });

describe('escaneo del sitio: validación', () => {
  it('descarta otros sitios, enlaces peligrosos y repetidos, y limita a 15', () => {
    const { scanner } = setup();
    const many = Array.from({ length: 30 }, (_, i) => route(`/p${i}`));
    const valid = scanner.validateRoutes(
      [
        route('/precios'),
        { url: 'https://otro.com/x', path: '/x' },
        route('/logout'),
        route('/pedidos/3/cancelar'),
        route('/precios'),
        { url: 'javascript:alert(1)', path: 'x' },
        ...many,
      ],
      ORIGIN_TAB.url,
    );
    expect(SCAN_LIMIT).toBe(15);
    expect(valid).toHaveLength(15);
    expect(valid[0].path).toBe('/precios');
    expect(valid.some((r: any) => /logout|cancelar|otro\.com/.test(r.url))).toBe(false);
  });

  it('sin permiso para el sitio: abre la página de permisos y no empieza', async () => {
    const t = setup({}, { permission: false });
    await expect(t.scanner.start([route('/a')], ORIGIN_TAB)).rejects.toThrow(/permiso/);
    expect(t.asked()).toBe(1);
    expect(t.windows.created).toBe(0);
  });
});

describe('escaneo del sitio: recorrido', () => {
  it('una ventana, cada ruta en orden al hub con su lugar en el mapa, y el fin del escaneo', async () => {
    const t = setup();
    const res = await t.scanner.start([route('/inicio'), route('/precios'), route('/equipo')], ORIGIN_TAB);
    expect(res.total).toBe(3);
    const end = await t.finished();
    expect(end).toMatchObject({ status: 'done', sent: 3, total: 3 });
    expect(t.windows.created).toBe(1);
    expect(t.windows.removed).toHaveLength(1); // la ventana de escaneo se cierra al terminar
    expect(t.visited).toEqual([`${ORIGIN}/inicio`, `${ORIGIN}/precios`, `${ORIGIN}/equipo`]);
    expect(t.renders.map(r => r.scan)).toEqual([
      expect.objectContaining({ index: 0, total: 3, path: '/inicio' }),
      expect.objectContaining({ index: 1, total: 3, path: '/precios' }),
      expect.objectContaining({ index: 2, total: 3, path: '/equipo' }),
    ]);
    expect(new Set(t.renders.map(r => r.scan.id)).size).toBe(1);
    expect(t.hubMessages).toEqual([
      { type: 'SCAN_FINISH', scanId: res.scanId, count: 3, source: { url: ORIGIN_TAB.url, title: 'Inicio' } },
    ]);
    expect(t.scanner.isActive()).toBe(false);
  });

  it('una redirección fuera del sitio (o a una ruta peligrosa) se salta; un error no detiene el resto', async () => {
    const t = setup({
      [`${ORIGIN}/privado`]: { redirect: 'https://login.otro.com/sso' },
      [`${ORIGIN}/raro`]: { redirect: `${ORIGIN}/logout` },
      [`${ORIGIN}/roto`]: { fail: true },
    });
    await t.scanner.start([route('/privado'), route('/raro'), route('/roto'), route('/ok')], ORIGIN_TAB);
    const end = await t.finished();
    expect(end).toMatchObject({ status: 'done', sent: 1 });
    expect(t.progress.filter(p => p.status === 'skip').map(p => p.path)).toEqual(['/privado', '/raro']);
    expect(t.progress.filter(p => p.status === 'error').map(p => p.path)).toEqual(['/roto']);
    expect(t.renders.map(r => r.scan.path)).toEqual(['/ok']);
  });

  it('cancelar a mitad: se detiene, cierra la ventana y arma el tablero con lo que llegó', async () => {
    const t = setup({ [`${ORIGIN}/b`]: { slow: 40 } });
    const res = await t.scanner.start([route('/a'), route('/b'), route('/c')], ORIGIN_TAB);
    // cancelar mientras carga /b
    for (let i = 0; i < 100 && !t.visited.includes(`${ORIGIN}/b`); i++) await new Promise(r => setTimeout(r, 2));
    t.scanner.cancel();
    const end = await t.finished();
    expect(end).toMatchObject({ status: 'cancelled', sent: 1 });
    expect(t.visited).not.toContain(`${ORIGIN}/c`);
    expect(t.windows.removed).toHaveLength(1);
    expect(t.hubMessages).toEqual([expect.objectContaining({ type: 'SCAN_FINISH', scanId: res.scanId, count: 1 })]);
  });

  it('cerrar la ventana de escaneo a mano también cancela; y no se pueden lanzar dos a la vez', async () => {
    const t = setup({ [`${ORIGIN}/b`]: { slow: 40 } });
    await t.scanner.start([route('/a'), route('/b'), route('/c')], ORIGIN_TAB);
    await expect(t.scanner.start([route('/a')], ORIGIN_TAB)).rejects.toThrow(/en curso/);
    for (let i = 0; i < 100 && !t.visited.includes(`${ORIGIN}/b`); i++) await new Promise(r => setTimeout(r, 2));
    const winId = (await t.api.windows.create({ url: 'about:blank' })).id; // otra ventana: no afecta
    await t.api.windows.remove(winId);
    // la ventana del escaneo es la primera creada: la "cierra" el usuario
    const scanWin = 101;
    await t.api.windows.remove(scanWin);
    const end = await t.finished();
    expect(end.status).toBe('cancelled');
  });
});
