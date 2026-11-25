import type { Logger, PluginSandboxMessage } from '@code-to-figma/contracts';
import {
  getFontReport,
  getUnrenderableFonts,
  loadFontSafely,
  prewarmFonts,
  refreshFontCache,
  resetFontReport,
  setUserFontMap,
} from './fonts';
import { countNodes, buildFigmaNode, setRenderBatchContext } from './render';
import { buildDesignBoard } from './board/board';
import { setBoardCtx } from './board/context';
import { guardRenderPayload } from './validation';
import { cssTokensToVariables, variablesAvailable } from './board/variables';
import { hoverReaction } from './prototype';
import { buildResponsiveVariants } from './theme-variants';
import { runDesignQa } from './qa-run';

/**
 * Diagnóstico de textos tras dibujar: cuántos venían en el payload, cuántos se crearon y, de los
 * primeros, fuente, tamaño, posición, si Figma los llega a pintar (absoluteRenderBounds) y qué
 * padres los recortan. Viaja al hub en RENDER_SUCCESS para depurar lo que solo pasa en Figma real.
 */
export function textReport(root: SceneNode, payloadRoot: any) {
  let expected = 0;
  (function walk(n: any) {
    if (!n) return;
    if (n.type === 'TEXT' && n.textData) expected++;
    for (const c of n.children || []) walk(c);
  })(payloadRoot);
  const created: TextNode[] =
    root.type === 'TEXT'
      ? [root as TextNode]
      : typeof (root as any).findAll === 'function'
        ? (root as any).findAll((n: SceneNode) => n.type === 'TEXT')
        : [];
  const rb = (root as any).absoluteBoundingBox || { x: (root as any).x || 0, y: (root as any).y || 0 };
  const r = (v: unknown) => (typeof v === 'number' ? Math.round(v) : v);
  const samples = created.slice(0, 12).map(t => {
    const bb = (t as any).absoluteBoundingBox;
    const rend = (t as any).absoluteRenderBounds;
    const clippedBy: string[] = [];
    for (let p: any = t.parent; p && p.type !== 'PAGE'; p = p.parent) {
      if (p.clipsContent) clippedBy.push(`${p.name} ${r(p.width)}x${r(p.height)}`);
      if (p === root) break;
    }
    const fn = t.fontName as any;
    return {
      text: String(t.characters || '').slice(0, 40),
      font: fn && fn.family ? `${fn.family} ${fn.style}` : 'mixed',
      fontSize: r(t.fontSize as any),
      size: `${r(t.width)}x${r(t.height)}`,
      at: bb ? `${r(bb.x - rb.x)},${r(bb.y - rb.y)}` : `${r(t.x)},${r(t.y)}`,
      painted: rend === undefined ? 'n/d' : rend ? `${r(rend.width)}x${r(rend.height)}` : 'NO',
      visible: t.visible,
      opacity: t.opacity,
      fills: JSON.stringify(t.fills).slice(0, 140),
      autoResize: t.textAutoResize,
      clippedBy,
    };
  });
  return { expected, created: created.length, unrenderableFonts: getUnrenderableFonts(), samples };
}

/** El diagnóstico nunca debe tumbar un render que ya terminó; además lo deja en el log del plugin */
function safeTextReport(root: SceneNode, payloadRoot: any, post: (m: PluginSandboxMessage) => void) {
  try {
    const rep = textReport(root, payloadRoot);
    const notPainted = rep.samples.filter(s => s.painted === 'NO').length;
    post({
      type: 'LOG',
      level: rep.created < rep.expected || notPainted ? 'warn' : 'info',
      message:
        `Textos: ${rep.created}/${rep.expected} creados` +
        (notPainted ? `, ${notPainted} sin pintar en el lienzo` : '') +
        (rep.samples[0] ? ` · ej. "${rep.samples[0].text}" ${rep.samples[0].font} ${rep.samples[0].size}` : ''),
    });
    return rep;
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

/**
 * Comando RENDER_NODES: valida el payload, crea tokens, dibuja (o arma el tablero) y coloca el
 * resultado en el lienzo. Lanza si algo falla; quien lo llama responde RENDER_ERROR a la UI.
 */
export async function renderNodesCommand(
  rawPayload: unknown,
  post: (m: PluginSandboxMessage) => void,
  log: Logger,
): Promise<void> {
  const payload: any = rawPayload;
  // Tiempos por etapa (fase 5.1): se informan a la UI y al CLI/MCP en RENDER_SUCCESS
  const t0 = Date.now();
  // Fuentes (fase 5.3): equivalencias del usuario, lista fresca de fuentes y reporte desde cero
  refreshFontCache();
  setUserFontMap(payload?.fontMap);
  resetFontReport();
  const reportFonts = () => {
    const broken = getUnrenderableFonts();
    if (broken.length) {
      post({
        type: 'LOG',
        level: 'warn',
        message:
          `Figma tiene instaladas pero no puede dibujar: ${broken.slice(0, 6).join(', ')}` +
          `${broken.length > 6 ? ` y ${broken.length - 6} más` : ''}. Se usó la siguiente fuente de la pila. ` +
          'Reinstala esa fuente (o reinicia Figma y su agente de fuentes) para recuperarla.',
      });
    }
    const subs = getFontReport();
    if (!subs.length) return undefined;
    const top = subs.slice(0, 6).map(x => `${x.requested} → ${x.used} (${x.texts})`);
    const more = subs.length > 6 ? ` y ${subs.length - 6} más` : '';
    post({
      type: 'LOG',
      level: 'warn',
      message:
        `Fuentes no disponibles en Figma, sustituidas: ${top.join(', ')}${more}. ` +
        'Si instalas la original y vuelves a enviar, se usará; también puedes definir una equivalencia en Ajustes.',
    });
    return subs.slice(0, 20);
  };
  const rootNode = payload?.rootNode || (Array.isArray(payload?.nodes) ? payload.nodes[0] : null);
  if (!payload || !rootNode) {
    throw new Error('Payload vacío o inválido (se esperaba rootNode o nodes[0])');
  }
  payload.rootNode = rootNode;

  const invalid = guardRenderPayload(payload);
  if (invalid) throw new Error(`Payload inválido: ${invalid}`);

  // QA de diseño (Función B): comparar con un frame de Figma en lugar de dibujar un render normal
  if (payload.compare?.targetNodeId) {
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    } catch (_e) {}
    await runDesignQa(payload, post, log);
    return;
  }

  let targetPage = figma.currentPage;

  // Soporte para crear o cambiar de página en Figma por pestaña
  if (payload.pageName) {
    if (typeof (figma as any).loadAllPagesAsync === 'function') {
      await (figma as any).loadAllPagesAsync();
    }
    const found = figma.root.children.find(p => p.name === payload.pageName);
    if (found) {
      targetPage = found;
    } else {
      const newPage = figma.createPage();
      newPage.name = payload.pageName;
      targetPage = newPage;
    }
    if (typeof (figma as any).setCurrentPageAsync === 'function') {
      await (figma as any).setCurrentPageAsync(targetPage);
    } else {
      figma.currentPage = targetPage;
    }
  }

  // payload.clearPage se ignora a propósito: nunca se borra el trabajo del usuario al dibujar

  // Si se solicita crear como componente raíz oficial de Figma
  if (payload.createAsComponent) {
    payload.rootNode.type = 'COMPONENT';
  }

  // 🎨 Extracción y Creación Automática de Design Tokens en Figma
  let createdTokensCount = 0;
  if (payload.tokens?.colors && variablesAvailable()) {
    // Variables nativas (fase 6.2); sin API de Variables, estilos de color como antes
    try {
      createdTokensCount = await cssTokensToVariables(payload.tokens.colors);
    } catch (_varErr) {}
  }
  if (payload.tokens?.colors && !createdTokensCount && typeof figma.createPaintStyle === 'function') {
    const localStyles =
      typeof (figma as any).getLocalPaintStylesAsync === 'function'
        ? await (figma as any).getLocalPaintStylesAsync()
        : figma.getLocalPaintStyles();
    for (const [tokenName, rgba] of Object.entries(payload.tokens.colors as Record<string, any>)) {
      try {
        const cleanName = 'Token / ' + tokenName.replace(/^--/, '');
        const existing = localStyles.find((s: any) => s.name === cleanName);
        const style = existing || figma.createPaintStyle();
        style.name = cleanName;
        style.paints = [
          {
            type: 'SOLID',
            color: { r: rgba.r, g: rgba.g, b: rgba.b },
            opacity: rgba.a !== undefined ? rgba.a : 1,
          },
        ];
        createdTokensCount++;
      } catch (_tokErr) {}
    }
  }

  // ⚡ Optimización Ultra-Lite: Pre-calentar fuentes tipográficas antes de pintar (Inter Regular siempre garantizada)
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  } catch (_e) {}
  await prewarmFonts(payload.rootNode);
  const responsiveVariants: any[] = Array.isArray(payload.responsive?.variants) ? payload.responsive.variants : [];
  for (const v of responsiveVariants) await prewarmFonts(v.rootNode);
  const fontsMs = Date.now() - t0;

  // Registrar total de nodos y habilitar medición de progreso reactivo en Figma
  const totalNodes = responsiveVariants.length
    ? responsiveVariants.reduce((n, v) => n + countNodes(v.rootNode), 0)
    : countNodes(payload.rootNode);
  setRenderBatchContext(totalNodes);

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
      try {
        figma.currentPage = pageBefore;
      } catch (_e) {
        try {
          await (figma as any).setCurrentPageAsync(pageBefore);
        } catch (_e2) {}
      }
      for (const p of [...figma.root.children]) {
        if (!pagesBefore.has(p.id)) {
          try {
            p.remove();
          } catch (_e) {}
        }
      }
      for (const c of [...pageBefore.children]) {
        if (!nodesBefore.has(c.id)) {
          try {
            c.remove();
          } catch (_e) {}
        }
      }
      log.error('Tablero falló', { error: String(boardErr?.message || boardErr) });
      post({
        type: 'LOG',
        level: 'error',
        message: `No se pudo organizar como tablero (${boardErr?.message || boardErr}). Se dibuja en modo normal.`,
      });
    }
    if (board) {
      // En su página, no en la actual: mientras se dibuja (cede el control) el usuario puede cambiar de página
      try {
        board.page.selection = [board.main];
      } catch (_e) {}
      post({
        type: 'LOG',
        level: 'success',
        message: `Tablero creado en "${board.page.name}": ${board.components} componentes enlazados, secciones y estilos organizados`,
      });
      const boardTotal = Date.now() - t0;
      post({
        type: 'RENDER_SUCCESS',
        nodeId: board.main.id,
        // QA-12: todas las capas del envío, para que borrarlo desde el plugin borre el tablero entero
        nodeIds: board.sections.map(sec => sec.id),
        name: board.main.name,
        nodeCount: board.nodeCount,
        pageName: board.page.name,
        width: Math.round(board.main.width),
        height: Math.round(board.main.height),
        nodeType: board.main.type,
        tokensCount: createdTokensCount,
        rawPayload: payload.rootNode,
        fontSubstitutions: reportFonts(),
        textReport: safeTextReport(board.main, payload.rootNode, post),
        durationMs: boardTotal,
        timings: { fontsMs, buildMs: boardTotal - (boardStart - t0), totalMs: boardTotal },
      });
      return;
    }
  }

  const totalNodeCount = countNodes(payload.rootNode);

  const renderStartTime = Date.now();
  // Breakpoints y tema (Función A): Breakpoint=… con Variables Light/Dark; si no, estados (fase 6.1):
  // Default + Hover… → State=…; si nada de eso aplica o falla, el bloque normal
  const responsive = await buildResponsiveVariants(payload, log, post);
  const rootFigmaNode =
    responsive?.root || (await buildStateVariants(payload, log)) || (await buildFigmaNode(payload.rootNode));
  const extraNodeIds: string[] = []; // capas sueltas que acompañan al render (título de sección)
  const buildMs = Date.now() - renderStartTime;

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
          extraNodeIds.push(headerText.id);
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
        rootFigmaNode.x = Math.round(center.x - rootFigmaNode.width / 2);
        rootFigmaNode.y = Math.round(center.y - rootFigmaNode.height / 2);
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

    // Vista Dark al lado del set de breakpoints (se coloca después del set)
    const companions = responsive ? responsive.afterPlace() : [];
    extraNodeIds.push(...companions.map(n => n.id));

    // Enfocar vista en el nuevo componente
    figma.viewport.scrollAndZoomIntoView([rootFigmaNode, ...companions]);
    targetPage.selection = [rootFigmaNode];

    const totalMs = Date.now() - t0; // un solo instante: duración y suma de etapas coinciden
    post({
      type: 'RENDER_SUCCESS',
      nodeId: rootFigmaNode.id,
      nodeIds: [rootFigmaNode.id, ...extraNodeIds],
      name: rootFigmaNode.name,
      nodeCount: totalNodeCount,
      pageName: targetPage.name,
      width: Math.round(rootFigmaNode.width),
      height: Math.round(rootFigmaNode.height),
      nodeType: rootFigmaNode.type,
      tokensCount: createdTokensCount,
      rawPayload: payload.rootNode,
      fontSubstitutions: reportFonts(),
      textReport: safeTextReport(rootFigmaNode, payload.rootNode, post),
      durationMs: totalMs,
      timings: { fontsMs, buildMs, placeMs: totalMs - (renderStartTime - t0) - buildMs, totalMs },
    });
  } else {
    throw new Error('No se pudo generar el nodo raíz');
  }
}

/**
 * Un componente por estado (State=Default, State=Hover…) unidos con combineAsVariants.
 * Devuelve el set, o null si no hay estados o no se pudo (quien llama dibuja el normal).
 */
async function buildStateVariants(payload: any, log: Logger): Promise<SceneNode | null> {
  const states: any[] = Array.isArray(payload.states) ? payload.states : [];
  if (!states.length || typeof (figma as any).combineAsVariants !== 'function') return null;
  const asComponent = (root: any, state: string) => {
    const data = JSON.parse(JSON.stringify(root));
    data.type = 'COMPONENT';
    data.name = `State=${String(state).replace(/[=,]/g, ' ').trim() || 'Estado'}`;
    data.layout = { ...data.layout, positioning: 'AUTO', x: 0, y: 0 };
    return data;
  };
  const built: ComponentNode[] = [];
  try {
    for (const [root, state] of [[payload.rootNode, 'Default'], ...states.map(s => [s.rootNode, s.name])]) {
      const node = await buildFigmaNode(asComponent(root, state));
      if (!node || node.type !== 'COMPONENT') throw new Error('estado sin componente');
      built.push(node as ComponentNode);
    }
    const set = figma.combineAsVariants(built, figma.currentPage);
    set.name = payload.rootNode?.name || 'Componente';
    set.layoutMode = 'HORIZONTAL';
    set.primaryAxisSizingMode = 'AUTO';
    set.counterAxisSizingMode = 'AUTO';
    set.counterAxisAlignItems = 'CENTER';
    set.itemSpacing = 40;
    set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 32;
    // al pasar el ratón, Default → Hover con Smart Animate y la transición CSS real
    const hoverIndex = states.findIndex(st => /^hover$/i.test(String(st?.name || '')));
    if (hoverIndex >= 0) {
      try {
        const reaction = hoverReaction(built[hoverIndex + 1].id, states[hoverIndex].transition);
        const node: any = built[0];
        if (typeof node.setReactionsAsync === 'function') await node.setReactionsAsync([reaction]);
        else node.reactions = [reaction];
      } catch (err: any) {
        log.warn('Variantes creadas, pero sin la interacción de hover', { error: String(err?.message || err) });
      }
    }
    return set;
  } catch (err: any) {
    log.warn('No se pudieron unir los estados como variantes', { error: String(err?.message || err) });
    for (const n of built) {
      try {
        n.remove();
      } catch (_e) {}
    }
    return null;
  }
}
