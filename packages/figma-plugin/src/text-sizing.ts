/**
 * Texto: tramos de estilo y dimensionado sin re-acomodar las líneas del navegador.
 */
import type { UITextSegment, UINode } from './types';
import { loadFontSafely } from './fonts';
import { errText, log } from './log';

// Aplica estilos por rango (fuente/peso, tamaño, color, decoración) a un TextNode
export async function applyTextSegments(tn: TextNode, segments: UITextSegment[]): Promise<void> {
  const len = tn.characters.length;
  for (const seg of segments) {
    const start = Math.max(0, Math.min(len, seg.start));
    const end = Math.max(start, Math.min(len, seg.end));
    if (end <= start) continue;
    try {
      if (seg.fontFamily || seg.fontWeight) {
        const f = await loadFontSafely(seg.fontFamily || 'Inter', seg.fontWeight || 400);
        tn.setRangeFontName(start, end, f);
      }
      if (seg.fontSize && seg.fontSize > 0) tn.setRangeFontSize(start, end, seg.fontSize);
      if (seg.color) {
        tn.setRangeFills(start, end, [{
          type: 'SOLID',
          color: { r: seg.color.r, g: seg.color.g, b: seg.color.b },
          opacity: seg.color.a !== undefined ? seg.color.a : 1
        }]);
      }
      if (seg.underline) tn.setRangeTextDecoration(start, end, 'UNDERLINE');
      else if (seg.strike) tn.setRangeTextDecoration(start, end, 'STRIKETHROUGH');
    } catch (err: any) {
      log.warn('No se pudo aplicar tramo de texto', { error: errText(err) });
    }
  }
}

/**
 * Dimensiona un texto cuyos saltos de línea ya vienen del navegador (noWrap).
 * Figma usa otra fuente si falta la original (SF Pro → Inter, más ancha); si se le deja
 * ancho fijo, re-parte las líneas, el texto crece y pisa lo que hay debajo.
 * Estrategia: mantener el ancho medido; si alguna línea no cabe, pasar a WIDTH_AND_HEIGHT
 * y compensar la posición según la alineación para que siga centrado / a la derecha.
 */
export function applyNoWrapSizing(tn: TextNode, data: UINode, parentIsAutoLayout: boolean): void {
  const td = data.textData!;
  const measuredW = data.layout?.measuredWidth || (typeof data.layout?.width === 'number' ? data.layout.width : 0);
  // 1. Ancho natural sin partir líneas
  tn.textAutoResize = 'WIDTH_AND_HEIGHT';
  const naturalW = tn.width;
  const fitsMeasured = measuredW > 0 && naturalW <= measuredW + 0.5;

  if (parentIsAutoLayout) {
    if (data.layout?.width === 'FILL' && fitsMeasured) {
      try { tn.layoutSizingHorizontal = 'FILL'; tn.textAutoResize = 'HEIGHT'; } catch (_e) {}
    } else if (typeof data.layout?.width === 'number' && fitsMeasured) {
      try { tn.resize(Math.max(1, data.layout.width), tn.height); tn.textAutoResize = 'HEIGHT'; } catch (_e) {}
    }
    // Si no cabe: queda HUG (WIDTH_AND_HEIGHT) y el padre lo alinea; nunca se re-parte.
    return;
  }

  // Padre sin Auto Layout: posición absoluta
  if (measuredW > 0 && fitsMeasured) {
    try { tn.resize(measuredW, tn.height); tn.textAutoResize = 'HEIGHT'; } catch (_e) {}
  } else if (measuredW > 0) {
    // Más ancho que en la web: anclar según la alineación del texto
    const extra = naturalW - measuredW;
    if (td.textAlign === 'CENTER') tn.x = tn.x - extra / 2;
    else if (td.textAlign === 'RIGHT') tn.x = tn.x - extra;
  }
}
