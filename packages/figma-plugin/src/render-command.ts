import type { Logger, PluginSandboxMessage } from '@code-to-figma/contracts';
import { loadFontSafely, prewarmFonts } from './fonts';
import { countNodes, buildFigmaNode } from './render';
import { buildDesignBoard } from './board/board';
import { setBoardCtx } from './board/context';
import { guardRenderPayload } from './validation';

/**
 * Comando RENDER_NODES: valida el payload, crea tokens, dibuja (o arma el tablero) y coloca el
 * resultado en el lienzo. Lanza si algo falla; quien lo llama responde RENDER_ERROR a la UI.
 */
export async function renderNodesCommand(rawPayload: unknown, post: (m: PluginSandboxMessage) => void, log: Logger): Promise<void> {
  const payload: any = rawPayload;
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

  // payload.clearPage se ignora a propósito: nunca se borra el trabajo del usuario al dibujar

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
      log.error('Tablero falló', { error: String(boardErr?.message || boardErr) });
      post({
        type: 'LOG', level: 'error',
        message: `No se pudo organizar como tablero (${boardErr?.message || boardErr}). Se dibuja en modo normal.`
      });
    }
  if (board) {
    figma.currentPage.selection = [board.main];
    post({
      type: 'LOG',
      level: 'success',
      message: `Tablero creado en "${board.page.name}": ${board.components} componentes enlazados, secciones y estilos organizados`
    });
    post({
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

    post({
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
}
