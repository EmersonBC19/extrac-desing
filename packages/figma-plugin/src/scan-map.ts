/**
 * Escaneo del sitio en Figma: cada página llega por separado y se coloca en el MAPA DEL SITIO
 * (en fila, en la página actual, con su ruta como título). Al terminar el escaneo se arma el tablero
 * con todas las rutas juntas: componentes repetidos entre páginas, una sección por ruta y estilos
 * del sitio. El 01 del tablero ES el mapa completo, así que la vista previa se retira al terminar.
 *
 * Con tablero, la vista previa es un MARCADOR por página (título y un marco del tamaño de la página),
 * no la página dibujada: antes cada página se dibujaba dos veces (mapa y tablero) y la primera se
 * borraba al final, el doble de trabajo para Figma. Sin tablero, cada página se dibuja una vez en el
 * mapa y ese es el resultado.
 *
 * Cada página dibujada lleva la marca de su ruta (route-marks.ts): así la extensión sabe cuáles ya
 * están en el archivo y propone escanear solo las que faltan.
 */
import type { Logger, PluginSandboxMessage } from '@code-to-figma/contracts';
import { renderNodesCommand } from './render-command';
import { loadFontSafely } from './fonts';
import { guardRenderPayload } from './validation';
import { routeKey, type RouteMark } from './route-marks';

type Post = (m: PluginSandboxMessage) => void;

interface ScanPage {
  index: number;
  path: string;
  label: string;
  title: string;
  rootNode: any;
  /** Layout original de la página: el tablero lo cambia y el plan B (mapa) lo necesita */
  layout: any;
  /** Marcador de la vista previa (con tablero), para dibujar la página en su sitio si el tablero falla */
  placeholder?: { x: number; y: number; ids: string[] };
}

interface ScanState {
  originX: number;
  y: number;
  nextX: number;
  /** Capas del mapa de vista previa (frames o marcadores, y títulos) */
  nodeIds: string[];
  /** Datos de cada página, para el tablero (sin tablero no se guardan: el mapa es el resultado) */
  pages: ScanPage[];
  /** Páginas recibidas */
  count: number;
  tokens: any;
  /** Lo decide la primera página (Ajustes → Tablero); undefined en clientes anteriores */
  board?: boolean;
}

const GAP = 240;
const TITLE_SPACE = 80; // el título va 65 px encima del frame (render-command)
const scans = new Map<string, ScanState>();

function startState(): ScanState {
  const others = figma.currentPage.children;
  const originX = others.length ? Math.round(Math.max(...others.map(c => c.x + c.width)) + 400) : 0;
  const y = (others.length ? Math.round(Math.min(...others.map(c => c.y))) : 0) + TITLE_SPACE;
  return { originX, y, nextX: originX, nodeIds: [], pages: [], count: 0, tokens: null };
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

/** Título de una ruta encima de su frame, como el de render-command */
async function routeTitle(text: string, x: number, y: number): Promise<TextNode | null> {
  try {
    const font = await loadFontSafely('Inter', 700);
    const t = figma.createText();
    t.fontName = font;
    t.characters = text;
    t.fontSize = 18;
    t.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.5 }, opacity: 0.9 }];
    t.x = x;
    t.y = y - 65;
    figma.currentPage.appendChild(t);
    return t;
  } catch (_e) {
    return null;
  }
}

/** Marcador de la vista previa: marco del tamaño de la página, con su título y un aviso */
async function drawPlaceholder(title: string, x: number, y: number, w: number, h: number): Promise<string[]> {
  const frame = figma.createFrame();
  frame.name = title;
  frame.resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  frame.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97 } }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.84 } }];
  frame.strokeWeight = 2;
  frame.x = x;
  frame.y = y;
  figma.currentPage.appendChild(frame);
  const ids = [frame.id];
  try {
    const font = await loadFontSafely('Inter', 400);
    const note = figma.createText();
    note.fontName = font;
    note.characters = 'Se dibuja en el tablero al terminar el escaneo';
    note.fontSize = 24;
    note.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.45, b: 0.5 } }];
    frame.appendChild(note);
    note.x = 40;
    note.y = 40;
  } catch (_e) {}
  const t = await routeTitle(title, x, y);
  if (t) ids.push(t.id);
  return ids;
}

async function removeNodes(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      const n =
        typeof (figma as any).getNodeByIdAsync === 'function'
          ? await figma.getNodeByIdAsync(id)
          : figma.getNodeById(id);
      if (n && !n.removed) (n as SceneNode).remove();
    } catch (_e) {}
  }
}

function mergeScanTokens(current: any, incoming: any): any {
  if (!incoming || typeof incoming !== 'object') return current;
  const base = current && typeof current === 'object' ? current : {};
  return {
    ...base,
    ...incoming,
    colors: { ...(base.colors || {}), ...(incoming.colors || {}) },
    radii: { ...(base.radii || {}), ...(incoming.radii || {}) },
  };
}

/** Una página del escaneo → un frame (o un marcador, con tablero) del mapa, a la derecha de la anterior */
export async function renderScanPage(payload: any, post: Post, log: Logger): Promise<void> {
  const scan = payload.scan;
  const state = scans.get(scan.id) || startState();
  scans.set(scan.id, state);
  if (state.board === undefined && typeof scan.board === 'boolean') state.board = scan.board;
  if (payload.tokens) state.tokens = mergeScanTokens(state.tokens, payload.tokens);

  // Marca de la ruta: la URL que se pidió (la de la página puede ser la de una redirección)
  const url = routeKey(String(scan.url || payload.source?.url || ''));
  if (url && payload.rootNode) {
    const mark: RouteMark = { url, path: String(scan.path || ''), scanId: scan.id, at: Date.now() };
    if (scan.label) mark.label = String(scan.label).slice(0, 200);
    payload.rootNode.__route = mark;
  }

  const title = (`${scan.index + 1} · ${scan.path}` + (scan.label ? ` — ${scan.label}` : '')).slice(0, 300);
  const reply = (m: any) =>
    post({ ...m, scan: { id: scan.id, index: scan.index, total: scan.total, path: scan.path } } as any);

  if (state.board) {
    // Se dibuja una sola vez, en el tablero: aquí solo se guardan los datos (sin copiarlos: no se
    // dibujan todavía, así que nada los modifica) y se coloca el marcador. Se validan igual que si
    // se dibujaran: una página inválida se rechaza aquí, no rompe el tablero al final
    const invalid = payload.rootNode ? guardRenderPayload(payload) : 'sin rootNode';
    if (invalid) throw new Error(`Payload inválido: ${invalid}`);
    state.count++;
    const w = widthOf(payload.rootNode);
    const h = heightOf(payload.rootNode);
    const x = state.nextX;
    const ids = await drawPlaceholder(title, x, state.y, w, h);
    state.nodeIds.push(...ids);
    state.pages.push({
      index: scan.index,
      path: scan.path,
      label: scan.label || '',
      title,
      rootNode: payload.rootNode,
      layout: payload.rootNode.layout,
      placeholder: { x, y: state.y, ids },
    });
    state.nextX += Math.round(w) + GAP;
    reply({
      type: 'RENDER_SUCCESS',
      nodeId: ids[0],
      nodeIds: ids,
      name: title,
      nodeType: 'SCAN_PLACEHOLDER',
      width: Math.round(w),
      height: Math.round(h),
    });
    return;
  }

  // Sin tablero (o un cliente anterior que no lo dice): la página se dibuja en el mapa. Solo un
  // cliente anterior puede armar luego el tablero, y para eso se guarda una copia ANTES de dibujar
  // (el render modifica los datos)
  if (state.board === undefined) {
    state.pages.push({
      index: scan.index,
      path: scan.path,
      label: scan.label || '',
      title,
      rootNode: JSON.parse(JSON.stringify(payload.rootNode)),
      layout: payload.rootNode.layout,
    });
  }
  state.count++;
  const pagePayload = {
    ...payload,
    board: false,
    createAsComponent: false,
    targetCanvasPosition: { x: state.nextX, y: state.y },
    sectionTitle: title,
  };
  // El resultado del render dice el ancho real y sus capas: se usa para colocar la siguiente
  const wrapped: Post = m => {
    if (m.type === 'RENDER_SUCCESS') {
      const ids = Array.isArray((m as any).nodeIds) ? ((m as any).nodeIds as string[]) : [m.nodeId];
      state.nodeIds.push(...ids);
      const w = Number((m as any).width) || widthOf(payload.rootNode);
      state.nextX += Math.round(w) + GAP;
      reply(m);
      return;
    }
    post(m);
  };
  await renderNodesCommand(pagePayload, wrapped, log);
}

/**
 * Plan B si el tablero no se pudo armar: cada página se dibuja en el mapa, en el sitio de su
 * marcador, y el mapa queda como resultado (sin esto solo quedaban los marcadores).
 */
async function drawMapInstead(pages: ScanPage[], post: Post, log: Logger): Promise<string[]> {
  const ids: string[] = [];
  for (const p of pages) {
    if (!p.placeholder) continue;
    await removeNodes(p.placeholder.ids);
    const node = p.rootNode;
    node.layout = p.layout;
    delete node.__cg;
    try {
      await renderNodesCommand(
        {
          rootNode: node,
          board: false,
          createAsComponent: false,
          targetCanvasPosition: { x: p.placeholder.x, y: p.placeholder.y },
          sectionTitle: p.title,
        },
        m => {
          if (m.type === 'RENDER_SUCCESS') {
            ids.push(...(Array.isArray((m as any).nodeIds) ? ((m as any).nodeIds as string[]) : [m.nodeId]));
            return;
          }
          post(m);
        },
        log,
      );
    } catch (err: any) {
      post({ type: 'LOG', level: 'error', message: `No se pudo dibujar ${p.path}: ${err?.message || err}` });
    }
  }
  return ids;
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
  if (!state || !state.count) {
    post({ type: 'LOG', level: 'warn', message: 'El escaneo terminó sin páginas recibidas.' });
    return;
  }
  let host = 'Sitio';
  try {
    host = new URL(msg.source?.url || '').hostname.replace(/^www\./, '') || host;
  } catch (_e) {}
  const pages = [...state.pages].sort((a, b) => a.index - b.index);
  // La decisión de la primera página manda: con marcadores, sin tablero no habría resultado
  const board = state.board ?? msg.board;
  const mapResult = (nodeIds: string[], count: number) => {
    post({
      type: 'RENDER_SUCCESS',
      nodeId: nodeIds[0],
      nodeIds,
      name: `Mapa del sitio · ${host} (${count} páginas)`,
      nodeType: 'SCAN_MAP',
      nodeCount: count,
    } as any);
    post({ type: 'LOG', level: 'success', message: `Mapa del sitio listo: ${count} páginas de ${host}.` });
  };

  if (!board || !pages.length) {
    mapResult(state.nodeIds, state.count);
    return;
  }

  // Todas las rutas en un solo árbol, en fila (el tablero las trata como una multi-selección:
  // cada ruta es su propia sección en 02 y los componentes se detectan entre todas las páginas)
  let x = 0;
  let maxH = 0;
  const children = pages.map(p => {
    const node = p.rootNode;
    node.name = `${p.path}` + (p.label ? ` — ${p.label}` : '');
    node.layout = { ...p.layout, positioning: 'ABSOLUTE', x, y: 0 };
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
    const withPlaceholders = pages.some(p => p.placeholder);
    post({
      type: 'LOG',
      level: 'error',
      message:
        `No se pudo armar el tablero del sitio (${err?.message || err}). ` +
        (withPlaceholders ? 'Se dibuja el mapa del sitio en su lugar.' : 'El mapa del sitio queda como resultado.'),
    });
    if (withPlaceholders) {
      mapResult(await drawMapInstead(pages, post, log), pages.length);
    }
    return;
  }
  // El 01 del tablero ya es el mapa completo: la vista previa sobra
  await removeNodes(state.nodeIds);
}
