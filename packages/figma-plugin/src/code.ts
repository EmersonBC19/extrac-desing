import { loadFontSafely, prewarmFonts } from './fonts';
import { countNodes, buildFigmaNode } from './render';
import { buildDesignBoard } from './board/board';
import { setBoardCtx } from './board/context';
import { guardRenderPayload } from './validation';

// Code to Figma — plugin de Figma (entrada). Módulos: render, fonts, paint, text-sizing, board/, validation.
// Se empaqueta con esbuild en dist/code.js (scripts/build-plugin.mjs).

// Iniciar UI flotante para WebSocket con nuevo tamaño Studio & Receiver
figma.showUI(__html__, {
  width: 470,
  height: 630,
  title: "⚡ Code to Figma AI — Studio & Receiver"
});

// Notificar cambio de página activa al UI
figma.on('currentpagechange', () => {
  try {
    figma.ui.postMessage({
      type: 'PAGE_INFO',
      pageName: figma.currentPage.name
    });
  } catch (_e) {}
});

// Receptor de eventos de Figma UI
figma.ui.onmessage = async (msg) => {
  // Código de vinculación con el hub: se pide una vez y se guarda en el almacenamiento local de Figma
  if (msg.type === 'GET_PAIRING_CODE') {
    let code = '';
    try { code = (await figma.clientStorage.getAsync('hubPairingCode')) || ''; } catch (_e) {}
    figma.ui.postMessage({ type: 'PAIRING_CODE', code });
    return;
  }
  if (msg.type === 'SET_PAIRING_CODE') {
    try { await figma.clientStorage.setAsync('hubPairingCode', String(msg.code || '')); } catch (_e) {}
    return;
  }

  if (msg.type === 'CLEAR_PAGE') {
    for (const child of figma.currentPage.children) {
      child.remove();
    }
    return;
  }

  if (msg.type === 'DELETE_NODE' && msg.nodeId) {
    try {
      const node = figma.getNodeById(msg.nodeId) as SceneNode;
      if (node && !node.removed) {
        const name = node.name;
        node.remove();
        figma.ui.postMessage({
          type: 'LOG',
          message: `"${name}" eliminado del lienzo de Figma`,
          level: 'info'
        });
      }
    } catch (delErr: any) {
      console.warn('Error al borrar nodo:', delErr);
    }
    return;
  }

  if (msg.type === 'DELETE_MULTIPLE_NODES' && Array.isArray(msg.nodeIds)) {
    try {
      let count = 0;
      for (const id of msg.nodeIds) {
        const node = figma.getNodeById(id) as SceneNode;
        if (node && !node.removed) {
          node.remove();
          count++;
        }
      }
      figma.ui.postMessage({
        type: 'LOG',
        message: `${count} componentes eliminados del lienzo de Figma`,
        level: 'info'
      });
    } catch (batchDelErr: any) {
      console.warn('Error al borrar nodos múltiples:', batchDelErr);
    }
    return;
  }

  if (msg.type === 'ZOOM_ALL') {
    if (figma.currentPage.children.length > 0) {
      figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
    }
    return;
  }

  if (msg.type === 'GET_PAGE_INFO') {
    figma.ui.postMessage({
      type: 'PAGE_INFO',
      pageName: figma.currentPage.name
    });
    return;
  }

  if (msg.type === 'FOCUS_NODE' && msg.nodeId) {
    try {
      const node = figma.getNodeById(msg.nodeId) as SceneNode;
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    } catch (_e) {}
    return;
  }

  if (msg.type === 'CONVERT_TO_COMPONENT' && msg.nodeId) {
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

        figma.ui.postMessage({
          type: 'LOG',
          message: `Frame "${comp.name}" convertido a Componente nativo de Figma`,
          level: 'success'
        });
      }
    } catch (convErr: any) {
      figma.ui.postMessage({
        type: 'LOG',
        message: `Error al convertir a componente: ${convErr.message}`,
        level: 'error'
      });
    }
    return;
  }

  if (msg.type === 'RENDER_NODES') {
    try {
      const payload: any = msg.payload;
      const rootNode = payload?.rootNode || (Array.isArray(payload?.nodes) ? payload.nodes[0] : null);
      if (!payload || !rootNode) {
        throw new Error('Payload vacío o inválido (se esperaba rootNode o nodes[0])');
      }
      payload.rootNode = rootNode;

      const invalid = guardRenderPayload(payload);
      if (invalid) throw new Error(`Payload inválido: ${invalid}`);

      let targetPage = figma.currentPage;

      // Soporte para crear o cambiar de página en Figma por pestaña
      if (payload.pageName) {
        const found = figma.root.children.find(p => p.name === payload.pageName);
        if (found) {
          targetPage = found;
        } else {
          const newPage = figma.createPage();
          newPage.name = payload.pageName;
          targetPage = newPage;
        }
        figma.currentPage = targetPage;
      }

      // Preservar elementos existentes en el canvas de Figma (no borrar el trabajo del usuario)
      if (false && payload.clearPage) {
        for (const child of targetPage.children) {
          child.remove();
        }
      }

      // Si se solicita crear como componente raíz oficial de Figma
      if (payload.createAsComponent) {
        payload.rootNode.type = 'COMPONENT';
      }

      // 🎨 Extracción y Creación Automática de Design Tokens en Figma
      let createdTokensCount = 0;
      if (payload.tokens?.colors && typeof figma.createPaintStyle === 'function') {
        for (const [tokenName, rgba] of Object.entries(payload.tokens.colors as Record<string, any>)) {
          try {
            const cleanName = 'Token / ' + tokenName.replace(/^--/, '');
            const existing = figma.getLocalPaintStyles().find(s => s.name === cleanName);
            const style = existing || figma.createPaintStyle();
            style.name = cleanName;
            style.paints = [{
              type: 'SOLID',
              color: { r: rgba.r, g: rgba.g, b: rgba.b },
              opacity: rgba.a !== undefined ? rgba.a : 1
            }];
            createdTokensCount++;
          } catch (_tokErr) {}
        }
      }

      // ⚡ Optimización Ultra-Lite: Pre-calentar fuentes tipográficas antes de pintar (Inter Regular siempre garantizada)
      try {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      } catch (_e) {}
      await prewarmFonts(payload.rootNode);

      // 🗂️ Landing completa / multi-selección → tablero tipo design system
      if (payload.board) {
        const boardStart = Date.now();
        const pageBefore = figma.currentPage;
        const nodesBefore = new Set(pageBefore.children.map(c => c.id));
        const pagesBefore = new Set(figma.root.children.map(p => p.id));
        let board: Awaited<ReturnType<typeof buildDesignBoard>> | null = null;
        try {
          board = await buildDesignBoard(payload);
        } catch (boardErr: any) {
          // Exportar nunca debe quedar bloqueado: limpiar restos del tablero y dibujar en modo normal
          setBoardCtx(null);
          try { figma.currentPage = pageBefore; } catch (_e) { try { await (figma as any).setCurrentPageAsync(pageBefore); } catch (_e2) {} }
          for (const p of [...figma.root.children]) {
            if (!pagesBefore.has(p.id)) { try { p.remove(); } catch (_e) {} }
          }
          for (const c of [...pageBefore.children]) {
            if (!nodesBefore.has(c.id)) { try { c.remove(); } catch (_e) {} }
          }
          console.error('Tablero falló:', boardErr);
          figma.ui.postMessage({
            type: 'LOG', level: 'error',
            message: `No se pudo organizar como tablero (${boardErr?.message || boardErr}). Se dibuja en modo normal.`
          });
        }
      if (board) {
        figma.currentPage.selection = [board.main];
        figma.ui.postMessage({
          type: 'LOG',
          level: 'success',
          message: `Tablero creado en "${board.page.name}": ${board.components} componentes enlazados, secciones y estilos organizados`
        });
        figma.ui.postMessage({
          type: 'RENDER_SUCCESS',
          nodeId: board.main.id,
          name: board.main.name,
          nodeCount: board.nodeCount,
          pageName: board.page.name,
          width: Math.round(board.main.width),
          height: Math.round(board.main.height),
          nodeType: board.main.type,
          tokensCount: createdTokensCount,
          rawPayload: payload.rootNode,
          durationMs: Date.now() - boardStart
        });
        return;
      }
      }

      const totalNodeCount = countNodes(payload.rootNode);

      const renderStartTime = Date.now();
      const rootFigmaNode = await buildFigmaNode(payload.rootNode);
      const durationMs = Date.now() - renderStartTime;

      if (rootFigmaNode) {
        targetPage.appendChild(rootFigmaNode);

        // Posicionamiento inteligente: coordenadas explícitas o al lado del último frame
        if (payload.targetCanvasPosition) {
          rootFigmaNode.x = payload.targetCanvasPosition.x;
          rootFigmaNode.y = payload.targetCanvasPosition.y;

          // Sección header: título de grupo de menú de navegación (alejado del nombre nativo del frame)
          if (payload.sectionTitle) {
            try {
              const headerFont = await loadFontSafely('Inter', 700);
              const headerText = figma.createText();
              headerText.fontName = headerFont;
              headerText.characters = payload.sectionTitle;
              headerText.fontSize = 18;
              headerText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.5 }, opacity: 0.9 }];
              headerText.x = payload.targetCanvasPosition.x;
              headerText.y = payload.targetCanvasPosition.y - 65;
              targetPage.appendChild(headerText);
            } catch (_hdrErr) {}
          }
        } else {
          // Posicionamiento inteligente: A su lado (Horizontal) o Debajo (Vertical)
          const GAP = Number(payload.placementGap) || 120;
          const placementMode = (payload.placementMode || 'SIDE').toUpperCase();
          const otherChildren = targetPage.children.filter(child => child.id !== rootFigmaNode.id);

          if (otherChildren.length === 0 || placementMode === 'CENTER') {
            // Primer elemento en la página o centrado explícito
            const center = figma.viewport.center;
            rootFigmaNode.x = Math.round(center.x - (rootFigmaNode.width / 2));
            rootFigmaNode.y = Math.round(center.y - (rootFigmaNode.height / 2));
          } else if (placementMode === 'BELOW') {
            // Colocar DEBAJO (Vertical):
            // Si el usuario tenía un elemento seleccionado antes de renderizar, colocar debajo de ese;
            // de lo contrario, buscar el elemento con mayor y + height de la página.
            const selected = targetPage.selection.find(s => s.id !== rootFigmaNode.id);
            if (selected) {
              rootFigmaNode.x = Math.round(selected.x);
              rootFigmaNode.y = Math.round(selected.y + selected.height + GAP);
            } else {
              let maxBottom = -Infinity;
              let alignX = otherChildren[0].x;
              for (const child of otherChildren) {
                const bottom = child.y + child.height;
                if (bottom > maxBottom) {
                  maxBottom = bottom;
                  alignX = child.x;
                }
              }
              rootFigmaNode.x = Math.round(alignX);
              rootFigmaNode.y = Math.round(maxBottom + GAP);
            }
          } else {
            // Colocar A SU LADO (Horizontal / SIDE - Predeterminado):
            // Si el usuario tenía un elemento seleccionado, colocar a la derecha de ese elemento;
            // de lo contrario, buscar el elemento con mayor x + width de la página.
            const selected = targetPage.selection.find(s => s.id !== rootFigmaNode.id);
            if (selected) {
              rootFigmaNode.x = Math.round(selected.x + selected.width + GAP);
              rootFigmaNode.y = Math.round(selected.y);
            } else {
              let maxRight = -Infinity;
              let alignY = otherChildren[0].y;
              for (const child of otherChildren) {
                const right = child.x + child.width;
                if (right > maxRight) {
                  maxRight = right;
                  alignY = child.y;
                }
              }
              rootFigmaNode.x = Math.round(maxRight + GAP);
              rootFigmaNode.y = Math.round(alignY);
            }
          }
        }

        // Enfocar vista en el nuevo componente
        figma.viewport.scrollAndZoomIntoView([rootFigmaNode]);
        targetPage.selection = [rootFigmaNode];

        figma.ui.postMessage({
          type: 'RENDER_SUCCESS',
          nodeId: rootFigmaNode.id,
          name: rootFigmaNode.name,
          nodeCount: totalNodeCount,
          pageName: targetPage.name,
          width: Math.round(rootFigmaNode.width),
          height: Math.round(rootFigmaNode.height),
          nodeType: rootFigmaNode.type,
          tokensCount: createdTokensCount,
          rawPayload: payload.rootNode,
          durationMs
        });
      } else {
        throw new Error('No se pudo generar el nodo raíz');
      }
    } catch (err: any) {
      console.error('Fallo en RENDER_NODES:', err);
      figma.ui.postMessage({
        type: 'RENDER_ERROR',
        error: err.message || String(err)
      });
    }
  }
};
