/**
 * Texto que rodea un float (plan de mejoras, fase 5.5).
 *
 * En la web las líneas que corren junto a una imagen flotante empiezan más a la derecha (float
 * left) que las de debajo. Un texto de Figma tiene un solo margen para todas sus líneas: dibujado
 * de una pieza, las primeras líneas quedan encima del float. Con el margen medido de cada línea
 * (buildRichText → lineLefts/lineTops) se parte en grupos de líneas consecutivas con el mismo
 * margen, cada uno en su posición, dentro de un frame con el tamaño original del párrafo.
 */
import type { RawNode } from './types';

const TOL = 3;

interface LineGroup {
  from: number;
  to: number; // exclusivo
  left: number;
  top: number;
}

export function lineGroups(lineLefts: number[], lineTops: number[]): LineGroup[] {
  const groups: LineGroup[] = [];
  lineLefts.forEach((left, i) => {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g.left - left) <= TOL) g.to = i + 1;
    else groups.push({ from: i, to: i + 1, left, top: lineTops[i] });
  });
  return groups;
}

/** Tramos de estilo de [start, end) reindexados desde 0 */
function sliceSegments(segments: any[] | undefined, start: number, end: number) {
  if (!segments) return undefined;
  const out = segments
    .filter(s => s.end > start && s.start < end)
    .map(s => ({ ...s, start: Math.max(s.start, start) - start, end: Math.min(s.end, end) - start }));
  return out.length > 1 ? out : undefined;
}

/**
 * Si las líneas tienen márgenes distintos (float), devuelve un frame con un texto por grupo.
 * Si no, devuelve el mismo nodo de texto.
 */
export function splitTextAroundFloats(
  textNode: RawNode,
  rich: { lineLefts: number[] | null; lineTops: number[] | null },
  width: number,
): RawNode {
  const { lineLefts, lineTops } = rich;
  const td = textNode.textData;
  if (!lineLefts || !lineTops || lineLefts.length < 2 || !td) return textNode;
  if (td.textAlign !== 'LEFT' && td.textAlign !== 'JUSTIFIED') return textNode; // centrado/derecha: no aplica
  if (Math.max(...lineLefts) - Math.min(...lineLefts) <= TOL) return textNode;
  const groups = lineGroups(lineLefts, lineTops);
  if (groups.length < 2) return textNode;

  const lines: string[] = td.characters.split('\n');
  const offsets: number[] = [];
  let acc = 0;
  for (const l of lines) {
    offsets.push(acc);
    acc += l.length + 1;
  }

  const L = textNode.layout;
  const children = groups.map((g, i) => {
    const start = offsets[g.from];
    const end = offsets[g.to - 1] + lines[g.to - 1].length;
    const characters = td.characters.slice(start, end);
    const count = g.to - g.from;
    return {
      ...textNode,
      id: `${textNode.id}_l${i}`,
      name: `${textNode.name} · ${i + 1}`,
      layout: {
        ...L,
        width: Math.max(1, Math.round(width - g.left)),
        height: 'HUG',
        measuredWidth: Math.max(1, Math.round(width - g.left)),
        measuredHeight: undefined,
        x: Math.max(0, g.left),
        y: Math.max(0, g.top),
        positioning: 'AUTO',
      },
      textData: {
        ...td,
        characters,
        isMultiline: count > 1,
        lineCount: count,
        segments: sliceSegments(td.segments, start, end),
      },
    };
  });

  return {
    id: textNode.id,
    name: textNode.name,
    type: 'FRAME',
    layout: {
      ...L,
      mode: 'NONE',
      height: typeof L.measuredHeight === 'number' ? L.measuredHeight : L.height,
    },
    styles: { fills: [] },
    metadata: { textAroundFloat: true },
    children,
  };
}

/**
 * Celda de tabla con texto directo (fase 5.5): en la web `vertical-align` centra o baja el
 * contenido en la celda y `text-align` lo mueve en horizontal. El texto sintético de la celda no
 * tiene posición medida, así que se traduce a la alineación del Auto Layout.
 */
export function alignTableCell(node: RawNode, style: CSSStyleDeclaration): void {
  const va = style.verticalAlign;
  const vertical = va === 'middle' ? 'CENTER' : va === 'bottom' ? 'MAX' : 'MIN';
  const ta = style.textAlign || '';
  const horizontal = /center/.test(ta) ? 'CENTER' : /right|end/.test(ta) ? 'MAX' : 'MIN';
  const L = node.layout;
  if (L.mode === 'NONE') L.mode = 'VERTICAL';
  if (L.mode === 'VERTICAL') {
    L.primaryAxisAlignItems = vertical;
    L.counterAxisAlignItems = horizontal;
  } else {
    L.counterAxisAlignItems = vertical;
    L.primaryAxisAlignItems = horizontal;
  }
}
