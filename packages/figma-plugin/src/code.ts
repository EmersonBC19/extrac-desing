import type { PluginSandboxMessage, PluginUiMessage, PluginUiMessageType } from '@code-to-figma/contracts';
import { renderNodesCommand } from './render-command';
import { log } from './log';
import { finishScan, renderScanPage } from './scan-map';

/** Cola de trabajo del sandbox: una tarea a la vez, en el orden en que llegan */
let workQueue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  workQueue = workQueue.then(task, task);
  return workQueue;
}

// Code to Figma — plugin de Figma (entrada). Módulos: render, render-command, fonts, paint,
// text-sizing, board/, validation. Se empaqueta con esbuild en dist/code.js (scripts/build-plugin.mjs).

/** Mensajes sandbox → UI, tipados con el catálogo de contracts */
const post = (m: PluginSandboxMessage) => figma.ui.postMessage(m);

// Iniciar UI flotante para WebSocket con nuevo tamaño Studio & Receiver
figma.showUI(__html__, {
  width: 470,
  height: 630,
  title: '⚡ Code to Figma AI — Studio & Receiver',
});

// Notificar cambio de página activa al UI
figma.on('currentpagechange', () => {
  try {
    post({ type: 'PAGE_INFO', pageName: figma.currentPage.name });
  } catch (_e) {}
});

type Handler<T extends PluginUiMessageType> = (msg: Extract<PluginUiMessage, { type: T }>) => void | Promise<void>;

/** Un manejador por cada mensaje UI → sandbox del catálogo: el compilador exige que estén todos */
const handlers: { [T in PluginUiMessageType]: Handler<T> } = {
  // Código de vinculación con el hub: se pide una vez y se guarda en el almacenamiento local de Figma
  GET_PAIRING_CODE: async () => {
    let code = '';
    try {
      code = (await figma.clientStorage.getAsync('hubPairingCode')) || '';
    } catch (_e) {}
    post({ type: 'PAIRING_CODE', code });
  },

  SET_PAIRING_CODE: async msg => {
    try {
      await figma.clientStorage.setAsync('hubPairingCode', String(msg.code || ''));
    } catch (_e) {}
  },

  // Ajustes del plugin: la UI es un iframe sin origen (sin localStorage fiable) → clientStorage
  GET_SETTINGS: async () => {
    let settings: Record<string, unknown> = {};
    try {
      const saved = await figma.clientStorage.getAsync('pluginSettings');
      if (saved && typeof saved === 'object') settings = saved;
    } catch (_e) {}
    post({ type: 'SETTINGS', settings });
  },

  SET_SETTINGS: async msg => {
    const settings = msg.settings && typeof msg.settings === 'object' ? msg.settings : {};
    // Tope de tamaño: son unas pocas opciones y una tabla de equivalencias de fuentes
    if (JSON.stringify(settings).length > 20_000) {
      log.warn('Ajustes demasiado grandes: no se guardan');
      return;
    }
    try {
      await figma.clientStorage.setAsync('pluginSettings', settings);
    } catch (_e) {}
  },

  CLEAR_PAGE: () => {
    for (const child of figma.currentPage.children) child.remove();
  },

  // QA-12: borrar de verdad (todas las capas de un envío, p. ej. las 4 Sections de un tablero) y
  // confirmar a la UI lo que se borró. getNodeByIdAsync funciona también con acceso dinámico a páginas.
  DELETE_NODE: async msg => {
    if (msg.nodeId) await deleteNodes([msg.nodeId]);
  },

  DELETE_MULTIPLE_NODES: async msg => {
    if (Array.isArray(msg.nodeIds)) await deleteNodes(msg.nodeIds.map(String));
  },

  // Historial del receptor (QA-12): en clientStorage, sin lo que ya no existe en el lienzo
  GET_HISTORY: async () => {
    let items: any[] = [];
    try {
      const saved = await figma.clientStorage.getAsync('receivedItems');
      if (Array.isArray(saved)) items = saved;
    } catch (_e) {}
    const alive: any[] = [];
    for (const item of items) {
      const ids: string[] = Array.isArray(item?.nodeIds) && item.nodeIds.length ? item.nodeIds : [item?.id];
      for (const id of ids) {
        const n = id ? await findNode(String(id)) : null;
        if (n && !n.removed) {
          alive.push(item);
          break;
        }
      }
    }
    post({ type: 'HISTORY', items: alive });
  },

  SET_HISTORY: async msg => {
    const items = Array.isArray(msg.items) ? msg.items.slice(0, 50) : [];
    try {
      await figma.clientStorage.setAsync('receivedItems', items);
    } catch (err: any) {
      log.warn('No se pudo guardar el historial', { error: String(err?.message || err) });
    }
  },

  ZOOM_ALL: () => {
    if (figma.currentPage.children.length > 0) {
      figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
    }
  },

  GET_PAGE_INFO: () => {
    post({ type: 'PAGE_INFO', pageName: figma.currentPage.name });
  },

  // QA de diseño: el frame seleccionado, para que la extensión capture la web a su mismo ancho
  GET_SELECTION: msg => {
    const node = figma.currentPage.selection[0] as SceneNode | undefined;
    const selection =
      node && 'width' in node
        ? {
            id: node.id,
            name: node.name,
            type: node.type,
            width: Math.round((node as any).width),
            height: Math.round((node as any).height),
          }
        : null;
    post({ type: 'SELECTION_INFO', requestId: (msg as any).requestId, selection });
  },

  FOCUS_NODE: async msg => {
    if (!msg.nodeId) return;
    try {
      const node = (await findNode(msg.nodeId)) as SceneNode;
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    } catch (_e) {}
  },

  CONVERT_TO_COMPONENT: async msg => {
    if (!msg.nodeId) return;
    try {
      const node = (await findNode(msg.nodeId)) as FrameNode;
      if (node && node.type === 'FRAME') {
        const comp = figma.createComponent();
        comp.name = node.name;
        comp.x = node.x;
        comp.y = node.y;
        comp.resize(node.width, node.height);
        comp.layoutMode = node.layoutMode;
        comp.primaryAxisAlignItems = node.primaryAxisAlignItems;
        comp.counterAxisAlignItems = node.counterAxisAlignItems;
        comp.itemSpacing = node.itemSpacing;
        comp.paddingTop = node.paddingTop;
        comp.paddingRight = node.paddingRight;
        comp.paddingBottom = node.paddingBottom;
        comp.paddingLeft = node.paddingLeft;
        comp.fills = node.fills;
        comp.strokes = node.strokes;
        comp.strokeWeight = node.strokeWeight;
        comp.cornerRadius = node.cornerRadius;
        comp.effects = node.effects;

        while (node.children.length > 0) {
          comp.appendChild(node.children[0]);
        }

        node.parent?.appendChild(comp);
        node.remove();
        figma.currentPage.selection = [comp];
        figma.viewport.scrollAndZoomIntoView([comp]);

        post({
          type: 'LOG',
          message: `Frame "${comp.name}" convertido a Componente nativo de Figma`,
          level: 'success',
        });
      }
    } catch (convErr: any) {
      post({ type: 'LOG', message: `Error al convertir a componente: ${convErr.message}`, level: 'error' });
    }
  },

  // En cola: los renders (y el cierre de un escaneo) se procesan de a uno y en orden. Sin esto,
  // dos renders asíncronos se intercalaban, y el fin del escaneo podía adelantarse a su última página.
  RENDER_NODES: msg =>
    enqueue(async () => {
      try {
        const payload: any = msg.payload;
        if (payload && payload.scan && typeof payload.scan.id === 'string') await renderScanPage(payload, post, log);
        else await renderNodesCommand(payload, post, log);
      } catch (err: any) {
        log.error('Fallo en RENDER_NODES', { error: err?.message || String(err) });
        post({ type: 'RENDER_ERROR', error: err?.message || String(err) });
      }
    }),

  // Fin del escaneo del sitio: tablero con todas las rutas (o el mapa, si el tablero está desactivado)
  SCAN_FINISH: msg =>
    enqueue(async () => {
      try {
        await finishScan(msg, post, log);
      } catch (err: any) {
        log.error('Fallo al terminar el escaneo', { error: err?.message || String(err) });
        post({ type: 'RENDER_ERROR', error: err?.message || String(err) });
      }
    }),

  GET_AVAILABLE_FONTS: async () => {
    try {
      if (typeof figma.listAvailableFontsAsync === 'function') {
        const fonts = await figma.listAvailableFontsAsync();
        const familiesSet = new Set<string>();
        for (const f of fonts) familiesSet.add(f.fontName.family);
        const uniqueFamilies = Array.from(familiesSet).sort();
        post({
          type: 'AVAILABLE_FONTS',
          fonts: uniqueFamilies.map(fam => ({ family: fam, style: 'Regular' })),
        });
      }
    } catch (err: any) {
      log.warn('No se pudo listar fuentes disponibles', { error: String(err?.message || err) });
    }
  },

  REPLACE_FONTS: async msg => {
    const mapping = msg.mapping || {};
    const targetNode = msg.targetNodeId ? await findNode(msg.targetNodeId) : null;
    const scope = targetNode && !targetNode.removed ? targetNode : figma.currentPage;

    const textNodes: TextNode[] = (scope as any).findAllWithCriteria
      ? (scope as any).findAllWithCriteria({ types: ['TEXT'] })
      : (scope as any).findAll
        ? (scope as any).findAll((n: any) => n.type === 'TEXT')
        : [];

    let replacedCount = 0;
    for (const tNode of textNodes) {
      try {
        const curFont = tNode.fontName;
        if (curFont === figma.mixed) continue;
        const curFam = (curFont as FontName).family;
        const curStyle = (curFont as FontName).style;

        const targetFam = mapping[curFam] || mapping[`${curFam}:::${curStyle}`];
        if (targetFam && targetFam !== curFam) {
          try {
            await figma.loadFontAsync({ family: targetFam, style: curStyle });
            tNode.fontName = { family: targetFam, style: curStyle };
            replacedCount++;
          } catch (_e1) {
            try {
              await figma.loadFontAsync({ family: targetFam, style: 'Regular' });
              tNode.fontName = { family: targetFam, style: 'Regular' };
              replacedCount++;
            } catch (_e2) {}
          }
        }
      } catch (_tErr) {}
    }

    post({
      type: 'FONTS_REPLACED',
      count: replacedCount,
      details: `${replacedCount} capa(s) de texto actualizadas con las nuevas tipografías.`,
    });
    post({
      type: 'LOG',
      level: 'success',
      message: `Tipografía reemplazada en ${replacedCount} capa(s) de texto.`,
    });
  },
};

async function findNode(id: string): Promise<BaseNode | null> {
  try {
    if (typeof (figma as any).getNodeByIdAsync === 'function') return await figma.getNodeByIdAsync(id);
    return figma.getNodeById(id);
  } catch (_e) {
    return null;
  }
}

async function deleteNodes(ids: string[]): Promise<void> {
  const removed: string[] = [];
  let missing = 0;
  for (const id of ids) {
    const node = await findNode(id);
    if (!node || node.removed || node.type === 'PAGE' || node.type === 'DOCUMENT') {
      missing++;
      continue;
    }
    try {
      (node as SceneNode).remove();
      removed.push(id);
    } catch (err: any) {
      log.warn('Error al borrar nodo', { id, error: String(err?.message || err) });
    }
  }
  post({ type: 'DELETED', nodeIds: removed, missing });
  post({
    type: 'LOG',
    level: removed.length ? 'info' : 'warn',
    message: removed.length
      ? `${removed.length} capa(s) eliminada(s) del lienzo de Figma` + (missing ? ` (${missing} ya no existían)` : '')
      : 'No había nada que borrar: las capas ya no existen en el lienzo',
  });
}

// Receptor de mensajes de la UI del plugin
figma.ui.onmessage = async (msg: PluginUiMessage) => {
  const handler =
    msg && typeof msg.type === 'string' && Object.prototype.hasOwnProperty.call(handlers, msg.type)
      ? (handlers[msg.type] as Handler<PluginUiMessageType>)
      : null;
  if (!handler) {
    log.warn('Mensaje de la UI desconocido', { type: String((msg as any)?.type) });
    return;
  }
  await handler(msg as never);
};
