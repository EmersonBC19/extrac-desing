/**
 * Rutas del escaneo del sitio que ya están en este archivo de Figma. Cada página escaneada lleva
 * una marca invisible (pluginData) con su URL: la del mapa del sitio y, con tablero, la sección de
 * esa ruta en 02 (y su copia en 01 si no se pudo convertir en instancia). La extensión pregunta
 * antes de escanear y propone solo las que faltan.
 *
 * Lo que cuenta es el lienzo: si el usuario borra una página, su marca se va con ella y la ruta
 * vuelve a salir como pendiente. No hay una lista aparte que se pueda desincronizar.
 */
import type { FigmaRoute } from '@code-to-figma/contracts';

export const ROUTE_KEY = 'c2f-route';

/** url, path, label y at (cuándo se dibujó, ms), más el escaneo que la trajo */
export type RouteMark = FigmaRoute & { scanId?: string };

/** La URL sin #fragmento: así la compara también la extensión */
export function routeKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch (_e) {
    return '';
  }
}

/** Pone la marca en la capa recién creada (los datos del nodo la traen en `__route`) */
export function markRoute(node: SceneNode, mark: unknown): void {
  if (!mark || typeof (node as any).setPluginData !== 'function') return;
  try {
    node.setPluginData(ROUTE_KEY, JSON.stringify(mark));
  } catch (_e) {}
}

function readMark(node: BaseNode): RouteMark | null {
  try {
    const raw = node.getPluginData(ROUTE_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return m && typeof m.url === 'string' && typeof m.path === 'string' ? m : null;
  } catch (_e) {
    return null;
  }
}

function markedIn(page: PageNode): BaseNode[] {
  const p: any = page;
  if (typeof p.findAllWithCriteria === 'function') {
    try {
      return p.findAllWithCriteria({ pluginData: { keys: [ROUTE_KEY] } });
    } catch (_e) {}
  }
  return p.findAll((n: BaseNode) => !!readMark(n));
}

/**
 * Las rutas de `origin` que hay en el archivo (todas sus páginas), una por URL: la más reciente.
 * Con documentAccess dynamic-page hay que cargar las páginas antes de recorrerlas.
 */
export async function routesInFile(origin: string): Promise<RouteMark[]> {
  if (typeof (figma as any).loadAllPagesAsync === 'function') await (figma as any).loadAllPagesAsync();
  const byUrl = new Map<string, RouteMark>();
  for (const page of figma.root.children) {
    for (const node of markedIn(page)) {
      const m = readMark(node);
      if (!m) continue;
      const key = routeKey(m.url);
      let o = '';
      try {
        o = new URL(key).origin;
      } catch (_e) {}
      if (!key || o !== origin) continue;
      const prev = byUrl.get(key);
      if (!prev || (m.at || 0) > (prev.at || 0)) byUrl.set(key, { ...m, url: key });
    }
  }
  return [...byUrl.values()];
}
