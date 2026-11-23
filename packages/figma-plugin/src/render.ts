/**
 * Construcción de nodos de Figma a partir del árbol UINode.
 */
import type { UINode } from './types';
import { loadFontSafely, markFontUnrenderable, trackFontUse } from './fonts';
import { base64ToBytes, cssFillToPaint } from './paint';
import { blendModeFromStyles, effectsFromStyles } from './effects';
import { buildBoardInstance } from './board/board';
import { getBoardCtx } from './board/context';
import { applyTextSegments, applyNoWrapSizing } from './text-sizing';
import { errText, log } from './log';

let _renderedNodeCount = 0;
let _totalBatchNodes = 0;

/**
 * Breakpoints y tema (theme-variants.ts): tras crear cada nodo se le pasa a este enlazador, que
 * vincula sus colores a Variables de modos Light/Dark. null fuera de ese modo.
 */
export type ColorBinder = (node: SceneNode, data: UINode) => void;
let _colorBinder: ColorBinder | null = null;
export function setColorBinder(fn: ColorBinder | null): void {
  _colorBinder = fn;
}

export function setRenderBatchContext(total: number): void {
  _renderedNodeCount = 0;
  _totalBatchNodes = total;
}

export async function yieldToFigma(_force = false): Promise<void> {
  _renderedNodeCount++;
  if (_totalBatchNodes > 0 && typeof figma !== 'undefined' && figma.ui && _renderedNodeCount % 10 === 0) {
    try {
      figma.ui.postMessage({
        type: 'RENDER_PROGRESS',
        rendered: _renderedNodeCount,
        total: _totalBatchNodes,
        percent: Math.min(100, Math.round((_renderedNodeCount / _totalBatchNodes) * 100)),
      });
    } catch (_e) {}
  }
}

export function countNodes(node: UINode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) count += countNodes(child);
  }
  return count;
}

export async function buildFigmaNode(nodeData: UINode): Promise<SceneNode | null> {
  let createdNode: SceneNode | null = null;

  // Tablero de design system: un bloque repetido se dibuja como instancia de su componente
  const cg = (nodeData as any).__cg;
  const boardCtx = getBoardCtx();
  if (boardCtx && cg && boardCtx.masters.has(cg)) {
    try {
      return await buildBoardInstance(nodeData, boardCtx.masters.get(cg)!);
    } catch (instErr: any) {
      figma.ui.postMessage({
        type: 'LOG',
        level: 'warn',
        message: `Instancia "${nodeData.name}" no creada, se dibuja como copia: ${instErr?.message || instErr}`,
      });
    }
  }

  try {
    if (nodeData.type === 'TEXT' && nodeData.textData) {
      // 1. Cargar obligatoriamente Inter Regular primero para que figma.createText() nunca falle
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      } catch (_e) {}

      // 2. Cargar la fuente deseada preservando peso visual (solo fuentes que Figma dibuja: fonts.ts)
      const fontStack = nodeData.textData.fontStack || nodeData.textData.fontFamily;
      let font = await loadFontSafely(fontStack, nodeData.textData.fontWeight);

      // 3. Crear el nodo de texto (garantizado libre de excepciones)
      const textNode = figma.createText();

      // 4. Asignar fuente
      try {
        textNode.fontName = font;
      } catch (_fErr) {
        try {
          textNode.fontName = { family: 'Inter', style: 'Regular' };
        } catch (_fErr2) {}
      }

      // 5. Asignar caracteres
      textNode.characters = nodeData.textData.characters || ' ';

      // 6. Asignar fontSize
      try {
        textNode.fontSize = Math.max(1, nodeData.textData.fontSize || 14);
      } catch (_e) {}

      // 6b. Si Figma no maqueta el texto con esa fuente (queda en 0 de ancho, sin pintarse), pasar a
      //     la siguiente de la pila que sí dibuje. La prueba de fonts.ts lo evita casi siempre; esto
      //     cubre una fuente que falle solo con ciertos caracteres o tamaños.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!(textNode.characters || '').trim() || textNode.width >= 1) break;
        const current = textNode.fontName as FontName;
        if (!current || (current as any) === figma.mixed || current.family === 'Inter') break;
        markFontUnrenderable(current);
        font = await loadFontSafely(fontStack, nodeData.textData.fontWeight);
        try {
          textNode.fontName = font;
        } catch (_e) {
          break;
        }
      }
      trackFontUse(fontStack, textNode.fontName !== figma.mixed ? (textNode.fontName as FontName) : font);

      // 7. Asignar lineHeight
      if (nodeData.textData.lineHeight && nodeData.textData.lineHeight > 0) {
        try {
          textNode.lineHeight = { value: nodeData.textData.lineHeight, unit: 'PIXELS' };
        } catch (_e) {}
      }

      // 8. Asignar letterSpacing
      if (nodeData.textData.letterSpacing !== undefined && nodeData.textData.letterSpacing !== 0) {
        try {
          textNode.letterSpacing = { value: nodeData.textData.letterSpacing, unit: 'PIXELS' };
        } catch (_e) {}
      }

      // 9. Asignar alineación horizontal
      if (nodeData.textData.textAlign) {
        try {
          const alignMap: Record<string, 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'> = {
            LEFT: 'LEFT',
            CENTER: 'CENTER',
            RIGHT: 'RIGHT',
            JUSTIFIED: 'JUSTIFIED',
          };
          textNode.textAlignHorizontal = alignMap[nodeData.textData.textAlign] || 'LEFT';
        } catch (_e) {}
      }

      // 10. Fills de texto: color o degradado en las letras (background-clip: text)
      if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
        try {
          const tw = nodeData.layout?.measuredWidth || textNode.width;
          const th = nodeData.layout?.measuredHeight || textNode.height;
          textNode.fills = nodeData.styles.fills.map((f: any) => cssFillToPaint(f, tw, th));
        } catch (_e) {}
      }
      // 10a. -webkit-text-stroke: contorno de las letras (centrado, como en CSS)
      const ts = (nodeData.styles as any)?.textStroke;
      if (ts && ts.color && ts.width > 0) {
        try {
          textNode.strokes = [cssFillToPaint(ts.color)];
          textNode.strokeWeight = ts.width;
          textNode.strokeAlign = 'CENTER';
        } catch (_e) {}
      }

      // 10b. text-shadow, desenfoque y modo de fusión
      try {
        const textFx = effectsFromStyles(nodeData.styles, 'TEXT');
        if (textFx.length) textNode.effects = textFx;
        const textBlend = blendModeFromStyles(nodeData.styles);
        if (textBlend) textNode.blendMode = textBlend;
      } catch (_e) {}

      // 11. Tramos con estilo propio (links, negritas, <sup>…) dentro del mismo texto
      if (Array.isArray(nodeData.textData.segments) && nodeData.textData.segments.length > 0) {
        await applyTextSegments(textNode, nodeData.textData.segments);
      }

      // 12. Texto con saltos de línea medidos en el navegador: no dejar que Figma lo re-acomode.
      //     El dimensionado final lo ajusta el padre (applyNoWrapSizing).
      if (nodeData.textData.noWrap) {
        try {
          textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
        } catch (_e) {}
      }

      createdNode = textNode;
    } else if (nodeData.type === 'SVG' && nodeData.svgContent) {
      let svgNode: FrameNode;
      try {
        svgNode = figma.createNodeFromSvg(nodeData.svgContent);
      } catch (_err) {
        // Reintento: sanear degradados o filtros unresolvables que hacen fallar a Figma
        try {
          const fallbackHex = '#94a3b8';
          const sanitized = nodeData.svgContent
            .replace(/fill="url\(#[^"]+\)"/gi, `fill="${fallbackHex}"`)
            .replace(/stroke="url\(#[^"]+\)"/gi, `stroke="${fallbackHex}"`)
            .replace(/filter="url\(#[^"]+\)"/gi, '')
            .replace(/<filter[\s\S]*?<\/filter>/gi, '');
          svgNode = figma.createNodeFromSvg(sanitized);
        } catch (sanErr) {
          log.warn('No se pudo crear SVG, se usa un frame de reemplazo', { error: errText(sanErr) });
          const fallback = figma.createFrame();
          fallback.resize(24, 24);
          svgNode = fallback;
        }
      }
      const targetW = typeof nodeData.layout?.width === 'number' ? nodeData.layout.width : 24;
      const targetH = typeof nodeData.layout?.height === 'number' ? nodeData.layout.height : 24;
      if (targetW > 0 && targetH > 0) {
        svgNode.resize(targetW, targetH);
      }
      if (nodeData.styles?.cornerRadius !== undefined) {
        if (typeof nodeData.styles.cornerRadius === 'number' && nodeData.styles.cornerRadius > 0) {
          svgNode.cornerRadius = nodeData.styles.cornerRadius;
        } else if (Array.isArray(nodeData.styles.cornerRadius) && nodeData.styles.cornerRadius.length === 4) {
          const [tl, tr, br, bl] = nodeData.styles.cornerRadius;
          svgNode.topLeftRadius = Math.max(0, tl);
          svgNode.topRightRadius = Math.max(0, tr);
          svgNode.bottomRightRadius = Math.max(0, br);
          svgNode.bottomLeftRadius = Math.max(0, bl);
        }
        svgNode.clipsContent = true;
      }
      if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
        const toPaint = (f: any) => cssFillToPaint(f, targetW, targetH);
        svgNode.fills = nodeData.styles.fills.map(toPaint);
      }
      const svgEffects = effectsFromStyles(nodeData.styles, 'FRAME');
      if (svgEffects.length > 0) {
        try {
          svgNode.effects = svgEffects;
        } catch (_effErr) {}
      }
      createdNode = svgNode;
    } else {
      // FRAME o COMPONENT
      const frame = nodeData.type === 'COMPONENT' ? figma.createComponent() : figma.createFrame();
      // Registrar desde ya: si algo falla más abajo, el frame parcial se devuelve y se anida
      // en su padre en vez de quedar huérfano en la raíz de la página (detrás del diseño).
      createdNode = frame;

      frame.name = nodeData.name || 'Frame';

      // Auto Layout
      // Tamaño medido en la web: la geometría de los degradados depende de la forma del nodo
      const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : 0);
      const boxW = num(nodeData.layout?.measuredWidth) || num(nodeData.layout?.width) || 100;
      const boxH = num(nodeData.layout?.measuredHeight) || num(nodeData.layout?.height) || 100;
      const toPaint = (f: any) => cssFillToPaint(f, boxW, boxH);

      const mode = nodeData.layout?.mode || 'NONE';
      if (mode === 'HORIZONTAL') {
        frame.layoutMode = 'HORIZONTAL';
      } else if (mode === 'VERTICAL') {
        frame.layoutMode = 'VERTICAL';
      } else {
        frame.layoutMode = 'NONE';
      }

      if (frame.layoutMode !== 'NONE') {
        // Spacing y Padding
        frame.itemSpacing = Math.max(0, nodeData.layout?.itemSpacing || 0);

        const pad = nodeData.layout?.padding || { top: 0, right: 0, bottom: 0, left: 0 };
        frame.paddingTop = Math.max(0, pad.top || 0);
        frame.paddingRight = Math.max(0, pad.right || 0);
        frame.paddingBottom = Math.max(0, pad.bottom || 0);
        frame.paddingLeft = Math.max(0, pad.left || 0);

        // Alineación de ejes
        if (nodeData.layout?.primaryAxisAlignItems) {
          const mapPrimary: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'> = {
            MIN: 'MIN',
            CENTER: 'CENTER',
            MAX: 'MAX',
            SPACE_BETWEEN: 'SPACE_BETWEEN',
          };
          frame.primaryAxisAlignItems = mapPrimary[nodeData.layout.primaryAxisAlignItems] || 'MIN';
        }

        if (nodeData.layout?.counterAxisAlignItems) {
          const mapCounter: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'> = {
            MIN: 'MIN',
            CENTER: 'CENTER',
            MAX: 'MAX',
            BASELINE: 'BASELINE',
          };
          frame.counterAxisAlignItems = mapCounter[nodeData.layout.counterAxisAlignItems] || 'MIN';
        }

        if (nodeData.layout?.layoutWrap === 'WRAP') {
          frame.layoutWrap = 'WRAP';
          // Separación entre filas medida en el navegador
          const cas = (nodeData.layout as any).counterAxisSpacing;
          if (typeof cas === 'number' && cas >= 0) {
            try {
              frame.counterAxisSpacing = cas;
            } catch (_e) {}
          }
        }
      }

      // Estilos de Relleno (Fills) e Imágenes Base64
      if (nodeData.imageData) {
        try {
          const image = figma.createImage(base64ToBytes(nodeData.imageData));
          // Orden CSS → Figma: color de fondo abajo, imagen en medio, degradados (overlays) arriba
          const baseFills = (nodeData.styles?.fills || []).filter((f: any) => !f.type || f.type === 'SOLID');
          const overlayFills = (nodeData.styles?.fills || []).filter((f: any) => f.type && f.type !== 'SOLID');
          const imagePaint: Paint = {
            type: 'IMAGE',
            scaleMode: (nodeData.styles?.imageScaleMode as any) || 'FILL',
            imageHash: image.hash,
            scalingFactor: nodeData.styles?.imageScaleMode === 'TILE' ? 1 : undefined,
          };
          frame.fills = [...baseFills.map(toPaint), imagePaint, ...overlayFills.map(toPaint)];
          await yieldToFigma(true);
        } catch (_imgErr: any) {
          log.warn('Error decodificando imagen base64', { error: errText(_imgErr) });
          figma.ui.postMessage({
            type: 'LOG',
            level: 'error',
            message: `Imagen no aplicada en "${nodeData.name}": ${_imgErr?.message || _imgErr}`,
          });
          // Placeholder visible para que la capa no quede "vacía" sin aviso
          frame.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }];
        }
      } else if (nodeData.styles?.fills) {
        frame.fills = nodeData.styles.fills.map(toPaint);
      } else {
        frame.fills = [];
      }

      // Bordes (Strokes) y lados individuales
      if (nodeData.styles?.strokes && nodeData.styles.strokes.length > 0) {
        const stroke = nodeData.styles.strokes[0];
        frame.strokes = [
          {
            type: 'SOLID',
            color: { r: stroke.r, g: stroke.g, b: stroke.b },
            opacity: stroke.a !== undefined ? stroke.a : 1,
          },
        ];
        frame.strokeAlign = 'INSIDE';

        // Lados individuales de borde si aplican
        if (nodeData.styles?.borderSides) {
          const bs = nodeData.styles.borderSides;
          try {
            (frame as any).strokeTopWeight = Math.max(0, bs.top ?? 0);
            (frame as any).strokeRightWeight = Math.max(0, bs.right ?? 0);
            (frame as any).strokeBottomWeight = Math.max(0, bs.bottom ?? 0);
            (frame as any).strokeLeftWeight = Math.max(0, bs.left ?? 0);
          } catch (_e) {
            frame.strokeWeight = Math.max(1, stroke.width || 1);
          }
        } else {
          frame.strokeWeight = Math.max(1, stroke.width || 1);
        }

        // Estilo discontinuo de borde (dashed o dotted)
        if (stroke.style === 'DASHED') {
          try {
            const dash = Math.max(4, stroke.width * 3);
            const gap = Math.max(3, stroke.width * 2);
            (frame as any).dashPattern = [dash, gap];
            (frame as any).strokeDashes = [dash, gap]; // compatibilidad
            (frame as any).strokeCap = 'ROUND';
            (frame as any).strokeJoin = 'ROUND';
          } catch (_e) {}
        } else if (stroke.style === 'DOTTED') {
          try {
            const dot = Math.max(1, stroke.width);
            const gap = Math.max(3, stroke.width * 2.5);
            (frame as any).dashPattern = [dot, gap];
            (frame as any).strokeDashes = [dot, gap]; // compatibilidad
            (frame as any).strokeCap = 'ROUND';
            (frame as any).strokeJoin = 'ROUND';
          } catch (_e) {}
        }
      }

      // Border Radius (Corner Radius)
      if (nodeData.styles?.cornerRadius !== undefined) {
        if (typeof nodeData.styles.cornerRadius === 'number') {
          frame.cornerRadius = Math.max(0, nodeData.styles.cornerRadius);
        } else if (Array.isArray(nodeData.styles.cornerRadius) && nodeData.styles.cornerRadius.length === 4) {
          const [tl, tr, br, bl] = nodeData.styles.cornerRadius;
          frame.topLeftRadius = Math.max(0, tl);
          frame.topRightRadius = Math.max(0, tr);
          frame.bottomRightRadius = Math.max(0, br);
          frame.bottomLeftRadius = Math.max(0, bl);
        }
      }

      // Opacity
      if (typeof nodeData.styles?.opacity === 'number') {
        frame.opacity = Math.max(0, Math.min(1, nodeData.styles.opacity));
      }

      // Efectos: sombras, desenfoques y modo de fusión (effects.ts, fase 5.4)
      const effects = effectsFromStyles(nodeData.styles, 'FRAME');
      if (effects.length > 0) frame.effects = effects;
      const frameBlend = blendModeFromStyles(nodeData.styles);
      if (frameBlend) frame.blendMode = frameBlend;

      // Dimensiones iniciales (usar width explícito o measuredWidth del DOM real)
      // Ojo: measured 0 es un valor real (elemento colapsado), no "desconocido"
      const initW =
        typeof nodeData.layout?.width === 'number'
          ? nodeData.layout.width
          : typeof nodeData.layout?.measuredWidth === 'number'
            ? nodeData.layout.measuredWidth
            : 100;
      const initH =
        typeof nodeData.layout?.height === 'number'
          ? nodeData.layout.height
          : typeof nodeData.layout?.measuredHeight === 'number'
            ? nodeData.layout.measuredHeight
            : 40;
      frame.resize(Math.max(1, initW), Math.max(1, initH));

      // Asegurar modo de dimensionamiento inicial FIXED en Auto Layout para permitir hijos con FILL
      if (frame.layoutMode !== 'NONE') {
        try {
          frame.layoutSizingHorizontal = 'FIXED';
          frame.layoutSizingVertical = 'FIXED';
        } catch (_e) {}
      }

      // createFrame() recorta por defecto: fijarlo explícitamente según el CSS (overflow),
      // si no, contenido desplazado (slides, overlays, callouts fuera de la caja) desaparece en vez de verse.
      frame.clipsContent = !!nodeData.clipsContent;

      // Borde de acento asimétrico individual (ej. barra o línea de color a la izquierda de la tarjeta)
      if (nodeData.styles?.accentBorder) {
        const ab = nodeData.styles.accentBorder;
        try {
          const abW = ab.width || 3;
          const abColor = toPaint(ab.color);
          const fW = Math.max(1, initW);
          const fH = Math.max(1, initH);

          if (ab.style === 'DOTTED' || ab.style === 'DASHED') {
            const line = figma.createLine();
            line.name = `Accent / ${ab.side}`;
            line.strokes = [abColor];
            line.strokeWeight = abW;
            const dash = ab.style === 'DASHED' ? Math.max(4, abW * 3) : Math.max(1, abW);
            const gap = ab.style === 'DASHED' ? Math.max(3, abW * 2) : Math.max(3, abW * 2.5);
            try {
              (line as any).dashPattern = [dash, gap];
              (line as any).strokeCap = 'ROUND';
            } catch (_e) {}

            frame.appendChild(line);
            if (frame.layoutMode !== 'NONE' && 'layoutPositioning' in line) {
              try {
                (line as any).layoutPositioning = 'ABSOLUTE';
              } catch (_e) {}
            }

            if (ab.side === 'LEFT' || ab.side === 'RIGHT') {
              line.rotation = -90;
              line.resize(fH, 0);
              line.x = ab.side === 'LEFT' ? Math.round(abW / 2) : fW - Math.round(abW / 2);
              line.y = fH;
            } else {
              line.resize(fW, 0);
              line.x = 0;
              line.y = ab.side === 'TOP' ? Math.round(abW / 2) : fH - Math.round(abW / 2);
            }
          } else {
            const accentRect = figma.createRectangle();
            accentRect.name = `Accent / ${ab.side}`;
            accentRect.fills = [abColor];
            accentRect.strokes = [];
            accentRect.strokeWeight = 0;

            // Solo las esquinas del lado del acento (un radio uniforme en una barra de 3 px la volvía píldora)
            const rawCr = nodeData.styles?.cornerRadius;
            const cr = typeof rawCr === 'number' ? [rawCr, rawCr, rawCr, rawCr] : rawCr;
            if (Array.isArray(cr) && cr.length === 4) {
              const [tl, tr, br, bl] = cr;
              if (ab.side === 'LEFT') {
                accentRect.topLeftRadius = Math.max(0, tl);
                accentRect.bottomLeftRadius = Math.max(0, bl);
                accentRect.topRightRadius = 0;
                accentRect.bottomRightRadius = 0;
              } else if (ab.side === 'RIGHT') {
                accentRect.topRightRadius = Math.max(0, tr);
                accentRect.bottomRightRadius = Math.max(0, br);
                accentRect.topLeftRadius = 0;
                accentRect.bottomLeftRadius = 0;
              } else if (ab.side === 'TOP') {
                accentRect.topLeftRadius = Math.max(0, tl);
                accentRect.topRightRadius = Math.max(0, tr);
                accentRect.bottomLeftRadius = 0;
                accentRect.bottomRightRadius = 0;
              } else if (ab.side === 'BOTTOM') {
                accentRect.bottomLeftRadius = Math.max(0, bl);
                accentRect.bottomRightRadius = Math.max(0, br);
                accentRect.topLeftRadius = 0;
                accentRect.topRightRadius = 0;
              }
            }

            frame.appendChild(accentRect);
            if (frame.layoutMode !== 'NONE' && 'layoutPositioning' in accentRect) {
              try {
                (accentRect as any).layoutPositioning = 'ABSOLUTE';
              } catch (_e) {}
            }

            if (ab.side === 'LEFT') {
              accentRect.x = 0;
              accentRect.y = 0;
              accentRect.resize(abW, fH);
              accentRect.constraints = { horizontal: 'MIN', vertical: 'STRETCH' };
            } else if (ab.side === 'RIGHT') {
              accentRect.x = fW - abW;
              accentRect.y = 0;
              accentRect.resize(abW, fH);
              accentRect.constraints = { horizontal: 'MAX', vertical: 'STRETCH' };
            } else if (ab.side === 'TOP') {
              accentRect.x = 0;
              accentRect.y = 0;
              accentRect.resize(fW, abW);
              accentRect.constraints = { horizontal: 'STRETCH', vertical: 'MIN' };
            } else if (ab.side === 'BOTTOM') {
              accentRect.x = 0;
              accentRect.y = fH - abW;
              accentRect.resize(fW, abW);
              accentRect.constraints = { horizontal: 'STRETCH', vertical: 'MAX' };
            }
          }
        } catch (_e) {}
      }

      // Procesar hijos recursivamente
      if (nodeData.children && nodeData.children.length > 0) {
        for (const childData of nodeData.children) {
          try {
            const childNode = await buildFigmaNode(childData);
            if (childNode) {
              frame.appendChild(childNode);

              // Ajustar sizing del hijo dentro del padre con Auto Layout
              if (frame.layoutMode !== 'NONE') {
                const layoutChild = childNode as any;

                if (childData.layout?.positioning === 'ABSOLUTE') {
                  try {
                    // 1. Establecer layoutPositioning a ABSOLUTE en Figma PRIMERO
                    // En Figma Auto Layout, un hijo debe ser ABSOLUTE antes de poder posicionarlo y redimensionarlo libremente
                    if ('layoutPositioning' in layoutChild) {
                      try {
                        layoutChild.layoutPositioning = 'ABSOLUTE';
                      } catch (_posErr) {
                        log.warn('No se pudo fijar layoutPositioning ABSOLUTE', { error: errText(_posErr) });
                      }
                    }

                    // 2. Posicionar en coordenadas exactas relativas al padre (incluso si resize o layoutPositioning dieron aviso)
                    if (typeof childData.layout.x === 'number') childNode.x = childData.layout.x;
                    if (typeof childData.layout.y === 'number') childNode.y = childData.layout.y;

                    // 3. En Figma un nodo ABSOLUTE no puede tener layoutSizingHorizontal = 'FILL'.
                    // Debe tener dimensiones explícitas fijas en píxeles.
                    const specW =
                      typeof childData.layout.width === 'number' && childData.layout.width > 0
                        ? childData.layout.width
                        : childData.layout.measuredWidth || layoutChild.width || 100;
                    const specH =
                      typeof childData.layout.height === 'number' && childData.layout.height > 0
                        ? childData.layout.height
                        : childData.layout.measuredHeight || layoutChild.height || 100;
                    // Tamaño medido en la web, no el mayor: con Math.max los elementos crecían más que
                    // en la web (p. ej. con una fuente sustituta más ancha) y tapaban a sus vecinos
                    const targetW = specW;
                    const targetH = specH;

                    if (targetW > 0 && targetH > 0 && typeof layoutChild.resize === 'function') {
                      try {
                        layoutChild.resize(targetW, targetH);
                      } catch (_resErr) {}
                    }
                  } catch (absErr) {
                    log.warn('Error configurando layoutPositioning ABSOLUTE', { error: errText(absErr) });
                  }
                } else {
                  // Si el hijo es texto dentro de Auto Layout
                  if (childNode.type === 'TEXT' && childData.textData?.noWrap) {
                    applyNoWrapSizing(childNode as TextNode, childData, true);
                  } else if (childNode.type === 'TEXT') {
                    const tn = childNode as TextNode;
                    const isMulti =
                      childData.textData?.isMultiline ||
                      (childData.textData?.characters && childData.textData.characters.includes('\n'));

                    if (childData.layout?.width === 'FILL') {
                      // Texto que se expande al ancho del contenedor y envuelve en altura
                      tn.textAutoResize = 'HEIGHT';
                      try {
                        tn.layoutSizingHorizontal = 'FILL';
                      } catch (_e) {
                        const fallbackW = childData.layout?.measuredWidth || frame.width;
                        if (fallbackW > 0) {
                          try {
                            tn.resize(fallbackW, tn.height);
                          } catch (_r) {}
                        }
                      }
                    } else if (childData.layout?.width === 'HUG') {
                      if (isMulti && frame.layoutMode === 'VERTICAL') {
                        // Texto multilínea en contenedor vertical: FILL para que no se trunque horizontalmente
                        tn.textAutoResize = 'HEIGHT';
                        try {
                          tn.layoutSizingHorizontal = 'FILL';
                        } catch (_e) {
                          const fallbackW = childData.layout?.measuredWidth || frame.width;
                          if (fallbackW > 0) {
                            try {
                              tn.resize(fallbackW, tn.height);
                            } catch (_r) {}
                          }
                        }
                      } else {
                        // Texto de una línea (etiquetas de botón, badges, links cortos)
                        tn.textAutoResize = 'WIDTH_AND_HEIGHT';
                      }
                    } else if (typeof childData.layout?.width === 'number') {
                      try {
                        tn.resize(Math.max(1, childData.layout.width), tn.height);
                      } catch (_e) {}
                      tn.textAutoResize = 'HEIGHT';
                    }
                  } else {
                    // Si el hijo es Frame u otro nodo con Auto Layout
                    // Primero redimensionar dimensiones fijas explícitas para no sobreescribir FILL/HUG después
                    const hasFixedW = typeof childData.layout?.width === 'number';
                    const hasFixedH = typeof childData.layout?.height === 'number';
                    if (hasFixedW || hasFixedH) {
                      const targetW = hasFixedW ? Math.max(1, childData.layout!.width as number) : layoutChild.width;
                      const targetH = hasFixedH ? Math.max(1, childData.layout!.height as number) : layoutChild.height;
                      try {
                        layoutChild.resize(targetW, targetH);
                      } catch (_e) {}
                    }

                    // LUEGO asignar layoutSizing para que resize no lo resetee a FIXED
                    try {
                      if (childData.layout?.width === 'FILL' && 'layoutSizingHorizontal' in layoutChild) {
                        layoutChild.layoutSizingHorizontal = 'FILL';
                      } else if (childData.layout?.width === 'HUG' && 'layoutSizingHorizontal' in layoutChild) {
                        layoutChild.layoutSizingHorizontal = 'HUG';
                      } else if (hasFixedW && 'layoutSizingHorizontal' in layoutChild) {
                        layoutChild.layoutSizingHorizontal = 'FIXED';
                      }
                    } catch (_e) {}

                    try {
                      if (childData.layout?.height === 'FILL' && 'layoutSizingVertical' in layoutChild) {
                        layoutChild.layoutSizingVertical = 'FILL';
                      } else if (childData.layout?.height === 'HUG' && 'layoutSizingVertical' in layoutChild) {
                        layoutChild.layoutSizingVertical = 'HUG';
                      } else if (hasFixedH && 'layoutSizingVertical' in layoutChild) {
                        layoutChild.layoutSizingVertical = 'FIXED';
                      }
                    } catch (_e) {}
                  }
                }
              } else {
                // Posicionamiento en modo canvas libre (NONE)
                if (typeof childData.layout?.x === 'number') childNode.x = childData.layout.x;
                if (typeof childData.layout?.y === 'number') childNode.y = childData.layout.y;
                if (childNode.type === 'FRAME' || childNode.type === 'COMPONENT' || childNode.type === 'INSTANCE') {
                  const dataW =
                    (typeof childData.layout?.width === 'number'
                      ? childData.layout.width
                      : childData.layout?.measuredWidth) || childNode.width;
                  const dataH =
                    (typeof childData.layout?.height === 'number'
                      ? childData.layout.height
                      : childData.layout?.measuredHeight) || childNode.height;
                  // Tamaño medido en la web (ver nota en los hijos ABSOLUTE)
                  const targetW = dataW;
                  const targetH = dataH;
                  if (targetW > 0 && targetH > 0 && (targetW !== childNode.width || targetH !== childNode.height)) {
                    try {
                      childNode.resize(targetW, targetH);
                    } catch (_e) {}
                  }
                } else if (childNode.type === 'TEXT' && childData.textData?.noWrap) {
                  applyNoWrapSizing(childNode as TextNode, childData, false);
                } else if (childNode.type === 'TEXT') {
                  const tn = childNode as TextNode;
                  const isMulti =
                    childData.textData?.isMultiline ||
                    (childData.textData?.characters && childData.textData.characters.includes('\n'));
                  const targetW =
                    typeof childData.layout?.width === 'number' && childData.layout.width > 0
                      ? childData.layout.width
                      : childData.layout?.measuredWidth || 0;
                  if (targetW > 0 && (isMulti || childData.layout?.width !== 'HUG')) {
                    tn.resize(targetW, tn.height);
                    tn.textAutoResize = 'HEIGHT';
                  } else {
                    tn.textAutoResize = 'WIDTH_AND_HEIGHT';
                  }
                }
              }
            }
          } catch (childErr: any) {
            // Un hijo con error de dimensionado no debe abortar a sus hermanos
            figma.ui.postMessage({
              type: 'LOG',
              level: 'warn',
              message: `Ajuste de capa "${childData.name}" incompleto: ${childErr?.message || childErr}`,
            });
          }
        }
      }

      // Configurar Sizing del propio frame padre
      const hasSelfFixedW = typeof nodeData.layout?.width === 'number' && nodeData.layout.width > 0;
      const hasSelfFixedH = typeof nodeData.layout?.height === 'number' && nodeData.layout.height > 0;
      const targetFrameW = hasSelfFixedW
        ? (nodeData.layout!.width as number)
        : nodeData.layout?.measuredWidth || frame.width;
      const targetFrameH = hasSelfFixedH
        ? (nodeData.layout!.height as number)
        : nodeData.layout?.measuredHeight || frame.height;

      if (targetFrameW > 0 && targetFrameH > 0 && (targetFrameW !== frame.width || targetFrameH !== frame.height)) {
        try {
          frame.resize(targetFrameW, targetFrameH);
        } catch (_e) {}
      }

      // (Sin "auto-expansión defensiva": a todo frame NONE de ≤ 50 px con un hijo que sobresaliera,
      // aunque fuera 1 px por redondeo, le borraba el fondo — botones, badges y avatares salían sin
      // color. Los contenedores colapsados de verdad ya los corrige el extractor, y sin recorte CSS el
      // contenido desbordado se ve igual que en la web.)

      if (frame.layoutMode !== 'NONE') {
        try {
          if (nodeData.layout?.width === 'HUG') {
            frame.layoutSizingHorizontal = 'HUG';
          } else if (nodeData.layout?.width === 'FILL') {
            frame.layoutSizingHorizontal = 'FILL';
          } else if (hasSelfFixedW) {
            frame.layoutSizingHorizontal = 'FIXED';
          }
        } catch (_e) {}

        try {
          if (nodeData.layout?.height === 'HUG') {
            frame.layoutSizingVertical = 'HUG';
          } else if (nodeData.layout?.height === 'FILL') {
            frame.layoutSizingVertical = 'FILL';
          } else if (hasSelfFixedH) {
            frame.layoutSizingVertical = 'FIXED';
          }
        } catch (_e) {}
      }

      createdNode = frame;
    }

    if (createdNode) {
      createdNode.name = nodeData.name || createdNode.name;
      if (_colorBinder) {
        try {
          _colorBinder(createdNode, nodeData);
        } catch (_e) {}
      }
    }
  } catch (error: any) {
    log.error('Error creando nodo Figma', { error: errText(error) });
    try {
      figma.ui.postMessage({
        type: 'LOG',
        level: 'error',
        message: `Error en capa "${nodeData.name}": ${error?.message || error}`,
      });
    } catch (_logErr) {}
    // Safety Net: si falló la creación de un texto por fuentes o métricas, intentar crearlo con Inter Regular
    if (nodeData.type === 'TEXT' && nodeData.textData && !createdNode) {
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        const fb = figma.createText();
        fb.name = nodeData.name || 'Text';
        fb.characters = nodeData.textData.characters || ' ';
        fb.fontSize = nodeData.textData.fontSize || 14;
        if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
          fb.fills = nodeData.styles.fills.map((f: any) =>
            cssFillToPaint(f, nodeData.layout?.measuredWidth || fb.width, nodeData.layout?.measuredHeight || fb.height),
          );
        } else {
          fb.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 }, opacity: 1 }];
        }
        createdNode = fb;
      } catch (_fbErr) {
        log.error('El texto de reemplazo también falló', { error: errText(_fbErr) });
      }
    }
  }

  return createdNode;
}
