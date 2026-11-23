/**
 * Escaneo del sitio en Figma: cada página llega por separado y se dibuja en el MAPA DEL SITIO
 * (en fila, en la página actual, con su ruta como título). Al terminar el escaneo se arma el tablero
 * con todas las rutas juntas: componentes repetidos entre páginas, una sección por ruta y estilos
 * del sitio. El 01 del tablero ES el mapa completo, así que la vista previa se retira al terminar.
 */
import type { Logger, PluginSandboxMessage } from '@code-to-figma/contracts';
import { renderNodesCommand } from './render-command';

type Post = (m: PluginSandboxMessage) => void;

interface ScanPage {
  index: number;
  path: string;
  label: string;
  rootNode: any;
}

interface ScanState {
  originX: number;
  y: number;
  nextX: number;
  /** Capas del mapa de vista previa (frames y títulos) */
  nodeIds: string[];
  pages: ScanPage[];
  tokens: any;
}

const GAP = 240;
const TITLE_SPACE = 80; // el título va 65 px encima del frame (render-command)
const scans = new Map<string, ScanState>();

function startState(): ScanState {
  const others = figma.currentPage.children;
  const originX = others.length ? Math.round(Math.max(...others.map(c => c.x + c.width)) + 400) : 0;
  const y = (others.length ? Math.round(Math.min(...others.map(c => c.y))) : 0) + TITLE_SPACE;
  return { originX, y, nextX: originX, nodeIds: [], pages: [], tokens: null };
}

const widthOf = (n: any) =>
  typeof n?.layout?.measuredWidth === 'number'
    ? n.layout.measuredWidth
    : typeof n?.layout?.width === 'number'
      ? n.layout.width
      : 1440;
const heightOf = (n: any) =>
  typeof n?.layout?.measuredHeight === 'number'
    ? n.layout.measuredHeight
    : typeof n?.layout?.height === 'number'
      ? n.layout.height
      : 900;

/** Una página del escaneo → un frame del mapa, a la derecha de la anterior */
export async function renderScanPage(payload: any, post: Post, log: Logger): Promise<void> {
  const scan = payload.scan;
  const state = scans.get(scan.id) || startState();
  scans.set(scan.id, state);
  // Copia de los datos ANTES de dibujar (el render los modifica): el tablero final los necesita
  state.pages.push({
    index: scan.index,
    path: scan.path,
    label: scan.label || '',
    rootNode: JSON.parse(JSON.stringify(payload.rootNode)),
  });
  if (payload.tokens) state.tokens = payload.tokens;

  const title = `${scan.index + 1} · ${scan.path}` + (scan.label ? ` — ${scan.label}` : '');
  const pagePayload = {
    ...payload,
    board: false,
    createAsComponent: false,
    targetCanvasPosition: { x: state.nextX, y: state.y },
    sectionTitle: title.slice(0, 300),
  };
  // El resultado del render dice el ancho real y sus capas: se usa para colocar la siguiente
  const wrapped: Post = m => {
    if (m.type === 'RENDER_SUCCESS') {
      const ids = Array.isArray((m as any).nodeIds) ? ((m as any).nodeIds as string[]) : [m.nodeId];
      state.nodeIds.push(...ids);
      const w = Number((m as any).width) || widthOf(payload.rootNode);
      state.nextX += Math.round(w) + GAP;
      post({ ...m, scan: { id: scan.id, index: scan.index, total: scan.total, path: scan.path } } as any);
      return;
    }
    post(m);
  };
  await renderNodesCommand(pagePayload, wrapped, log);
}

/**
 * Fin del escaneo: con tablero, todas las rutas juntas (un solo árbol con las páginas en fila) y
 * se retira la vista previa; sin tablero, el mapa queda como resultado (un ítem del receptor).
 */
export async function finishScan(
  msg: { scanId: string; board: boolean; source?: { url?: string; title?: string } },
  post: Post,
  log: Logger,
): Promise<void> {
  const state = scans.get(msg.scanId);
  scans.delete(msg.scanId);
  if (!state || !state.pages.length) {
    post({ type: 'LOG', level: 'warn', message: 'El escaneo terminó sin páginas recibidas.' });
    return;
  }
  let host = 'Sitio';
  try {
    host = new URL(msg.source?.url || '').hostname.replace(/^www\./, '') || host;
  } catch (_e) {}
  const pages = [...state.pages].sort((a, b) => a.index - b.index);

  if (!msg.board) {
    post({
      type: 'RENDER_SUCCESS',
      nodeId: state.nodeIds[0],
      nodeIds: state.nodeIds,
      name: `Mapa del sitio · ${host} (${pages.length} páginas)`,
      nodeType: 'SCAN_MAP',
      nodeCount: pages.length,
    } as any);
    post({ type: 'LOG', level: 'success', message: `Mapa del sitio listo: ${pages.length} páginas de ${host}.` });
    return;
  }

  // Todas las rutas en un solo árbol, en fila (el tablero las trata como una multi-selección:
  // cada ruta es su propia sección en 02 y los componentes se detectan entre todas las páginas)
  let x = 0;
  let maxH = 0;
  const children = pages.map(p => {
    const node = p.rootNode;
    node.name = `${p.path}` + (p.label ? ` — ${p.label}` : '');
    node.layout = { ...node.layout, positioning: 'ABSOLUTE', x, y: 0 };
    x += widthOf(node) + GAP;
    maxH = Math.max(maxH, heightOf(node));
    return node;
  });
  const width = Math.max(1, x - GAP);
  const bundle = {
    id: `multi_selection_bundle_scan_${msg.scanId}`,
    name: `Sitio · ${host}`,
    type: 'FRAME',
    layout: {
      mode: 'NONE',
      width,
      height: maxH,
      measuredWidth: width,
      measuredHeight: maxH,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      itemSpacing: 0,
    },
    styles: { fills: [] },
    children,
  };
  post({ type: 'LOG', level: 'info', message: `Armando el tablero del sitio con ${pages.length} páginas…` });
  try {
    await renderNodesCommand(
      { rootNode: bundle, tokens: state.tokens || undefined, board: true, source: msg.source },
      post,
      log,
    );
  } catch (err: any) {
    log.error('No se pudo armar el tablero del sitio', { error: String(err?.message || err) });
    post({
      type: 'LOG',
      level: 'error',
      message: `No se pudo armar el tablero del sitio (${err?.message || err}). El mapa del sitio queda como resultado.`,
    });
    return;
  }
  // El 01 del tablero ya es el mapa completo: la vista previa sobra
  for (const id of state.nodeIds) {
    try {
      const n =
        typeof (figma as any).getNodeByIdAsync === 'function'
          ? await figma.getNodeByIdAsync(id)
          : figma.getNodeById(id);
      if (n && !n.removed) (n as SceneNode).remove();
    } catch (_e) {}
  }
}
