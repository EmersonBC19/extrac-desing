import type { PluginSandboxMessage, PluginUiMessage, PluginUiMessageType } from '@code-to-figma/contracts';
import { renderNodesCommand } from './render-command';
import { log } from './log';

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

  CLEAR_PAGE: () => {
    for (const child of figma.currentPage.children) child.remove();
  },

  DELETE_NODE: msg => {
    if (!msg.nodeId) return;
    try {
      const node = figma.getNodeById(msg.nodeId) as SceneNode;
      if (node && !node.removed) {
        const name = node.name;
        node.remove();
        post({ type: 'LOG', message: `"${name}" eliminado del lienzo de Figma`, level: 'info' });
      }
    } catch (delErr: any) {
      log.warn('Error al borrar nodo', { error: String(delErr?.message || delErr) });
    }
  },

  DELETE_MULTIPLE_NODES: msg => {
    if (!Array.isArray(msg.nodeIds)) return;
    try {
      let count = 0;
      for (const id of msg.nodeIds) {
        const node = figma.getNodeById(id) as SceneNode;
        if (node && !node.removed) {
          node.remove();
          count++;
        }
      }
      post({ type: 'LOG', message: `${count} componentes eliminados del lienzo de Figma`, level: 'info' });
    } catch (batchDelErr: any) {
      log.warn('Error al borrar nodos múltiples', { error: String(batchDelErr?.message || batchDelErr) });
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

  FOCUS_NODE: msg => {
    if (!msg.nodeId) return;
    try {
      const node = figma.getNodeById(msg.nodeId) as SceneNode;
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    } catch (_e) {}
  },

  CONVERT_TO_COMPONENT: msg => {
    if (!msg.nodeId) return;
    try {
      const node = figma.getNodeById(msg.nodeId) as FrameNode;
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

  RENDER_NODES: async msg => {
    try {
      await renderNodesCommand(msg.payload, post, log);
    } catch (err: any) {
      log.error('Fallo en RENDER_NODES', { error: err?.message || String(err) });
      post({ type: 'RENDER_ERROR', error: err?.message || String(err) });
    }
  },
};

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
