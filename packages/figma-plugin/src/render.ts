/**
 * Construcción de nodos de Figma a partir del árbol UINode.
 */
import type { UINode } from './types';
import { loadFontSafely } from './fonts';
import { base64ToBytes, cssFillToPaint } from './paint';
import { buildBoardInstance } from './board/board';
import { getBoardCtx } from './board/context';
import { applyTextSegments, applyNoWrapSizing } from './text-sizing';
import { errText, log } from './log';

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

      // 2. Cargar la fuente deseada preservando peso visual
      const font = await loadFontSafely(nodeData.textData.fontFamily, nodeData.textData.fontWeight);

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

      // 10. Fills de texto
      if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
        try {
          textNode.fills = nodeData.styles.fills.map((f: any) => ({
            type: 'SOLID',
            color: { r: f.r, g: f.g, b: f.b },
            opacity: f.a !== undefined ? f.a : 1,
          }));
        } catch (_e) {}
      }

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
      try {
        const svgNode = figma.createNodeFromSvg(nodeData.svgContent);
        const targetW = typeof nodeData.layout?.width === 'number' ? nodeData.layout.width : 24;
        const targetH = typeof nodeData.layout?.height === 'number' ? nodeData.layout.height : 24;
        if (targetW > 0 && targetH > 0) {
          svgNode.resize(targetW, targetH);
        }
        createdNode = svgNode;
      } catch (err) {
        log.warn('No se pudo crear SVG, se usa un frame de reemplazo', { error: errText(err) });
        const fallback = figma.createFrame();
        fallback.resize(24, 24);
        createdNode = fallback;
      }
    } else {
      // FRAME o COMPONENT
      const frame = nodeData.type === 'COMPONENT' ? figma.createComponent() : figma.createFrame();
      // Registrar desde ya: si algo falla más abajo, el frame parcial se devuelve y se anida
      // en su padre en vez de quedar huérfano en la raíz de la página (detrás del diseño).
      createdNode = frame;

      frame.name = nodeData.name || 'Frame';

      // Auto Layout
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
          };
          frame.fills = [...baseFills.map(cssFillToPaint), imagePaint, ...overlayFills.map(cssFillToPaint)];
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
        frame.fills = nodeData.styles.fills.map(cssFillToPaint);
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

      // Efectos: Box Shadows & Glassmorphism Backdrop Blur
      const effects: Effect[] = [];
      if (nodeData.styles?.boxShadow && nodeData.styles.boxShadow.length > 0) {
        for (const shadow of nodeData.styles.boxShadow) {
          effects.push({
            type: 'DROP_SHADOW',
            color: {
              r: shadow.color.r,
              g: shadow.color.g,
              b: shadow.color.b,
              a: shadow.color.a,
            },
            offset: { x: shadow.offset.x, y: shadow.offset.y },
            radius: Math.max(0, shadow.radius),
            spread: shadow.spread || 0,
            visible: true,
            blendMode: 'NORMAL',
          });
        }
      }
      if (typeof nodeData.styles?.backdropBlur === 'number' && nodeData.styles.backdropBlur > 0) {
        effects.push({
          type: 'BACKGROUND_BLUR',
          radius: Math.max(1, nodeData.styles.backdropBlur),
          visible: true,
        } as any);
      }
      if (effects.length > 0) {
        frame.effects = effects;
      }

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

      // Habilitar Clip Content en frames raíz o frames con fondo y esquinas redondeadas
      const hasRoundCorners = typeof frame.cornerRadius === 'number' ? frame.cornerRadius > 0 : false;
      const hasFills = Array.isArray(frame.fills) && frame.fills.length > 0;
      // createFrame() recorta por defecto: fijarlo explícitamente según el CSS (overflow),
      // si no, contenido desplazado (slides, overlays) desaparece en vez de verse.
      frame.clipsContent = !!(nodeData.clipsContent || (hasRoundCorners && hasFills));

      // Procesar hijos recursivamente
      if (nodeData.children && nodeData.children.length > 0) {
        for (const childData of nodeData.children) {
          const childNode = await buildFigmaNode(childData);
          if (childNode)
            try {
              frame.appendChild(childNode);

              // Ajustar sizing del hijo dentro del padre con Auto Layout
              if (frame.layoutMode !== 'NONE') {
                const layoutChild = childNode as any;

                if (childData.layout?.positioning === 'ABSOLUTE') {
                  try {
                    // 1. En Figma un nodo ABSOLUTE no puede tener layoutSizingHorizontal = 'FILL'.
                    // Debe tener dimensiones explícitas fijas en píxeles.
                    const targetW =
                      typeof childData.layout.width === 'number' && childData.layout.width > 0
                        ? childData.layout.width
                        : childData.layout.measuredWidth || layoutChild.width || 100;
                    const targetH =
                      typeof childData.layout.height === 'number' && childData.layout.height > 0
                        ? childData.layout.height
                        : childData.layout.measuredHeight || layoutChild.height || 100;

                    if (targetW > 0 && targetH > 0 && typeof layoutChild.resize === 'function') {
                      try {
                        layoutChild.resize(targetW, targetH);
                      } catch (_resErr) {}
                    }

                    // 2. Establecer layoutPositioning a ABSOLUTE en Figma
                    if ('layoutPositioning' in layoutChild) {
                      layoutChild.layoutPositioning = 'ABSOLUTE';
                    }

                    // 3. Posicionar en coordenadas exactas relativas al padre
                    if (typeof childData.layout.x === 'number') childNode.x = childData.layout.x;
                    if (typeof childData.layout.y === 'number') childNode.y = childData.layout.y;
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
                if (childNode.type === 'FRAME' || childNode.type === 'COMPONENT') {
                  const targetW =
                    (typeof childData.layout?.width === 'number'
                      ? childData.layout.width
                      : childData.layout?.measuredWidth) || childNode.width;
                  const targetH =
                    (typeof childData.layout?.height === 'number'
                      ? childData.layout.height
                      : childData.layout?.measuredHeight) || childNode.height;
                  if (targetW > 0 && targetH > 0 && (targetW !== childNode.width || targetH !== childNode.height)) {
                    childNode.resize(targetW, targetH);
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
          fb.fills = nodeData.styles.fills.map((f: any) => ({
            type: 'SOLID',
            color: { r: f.r, g: f.g, b: f.b },
            opacity: f.a !== undefined ? f.a : 1,
          }));
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
