/**
 * Peso de una extracción (plan de mejoras, fase 5.1). Se mide antes de enviar para avisar cuando
 * una selección es tan pesada que Figma puede tardar o fallar, y para decidir el envío por partes.
 *
 * Referencias medidas (2026-11): Apple home 3,8 MB · body de un dashboard real 4,4 MB ·
 * Wikipedia ~4 300 textos. Todas se dibujan bien: los umbrales están por encima.
 */
import type { UINode } from './types.js';

export interface PayloadStats {
  /** Nodos del árbol */
  nodes: number;
  /** Nodos con imagen (base64) */
  images: number;
  /** Caracteres base64 de todas las imágenes (≈ bytes en el JSON) */
  imageBytes: number;
  /** Caracteres de texto visibles */
  textChars: number;
  /** Profundidad máxima (raíz = 1) */
  depth: number;
  /** Tamaño del JSON que viajará al hub */
  bytes: number;
}

export const HEAVY_PAYLOAD = {
  /** Más de esto: aviso antes de enviar */
  bytes: 15 * 1024 * 1024,
  nodes: 25_000,
  depth: 200,
} as const;

/** Desde este tamaño el service worker envía por partes y el plugin muestra el progreso */
export const CHUNK_THRESHOLD_BYTES = 1024 * 1024;
/** Tamaño de cada parte (caracteres del JSON) */
export const CHUNK_SIZE_CHARS = 512 * 1024;

export function measurePayload(root: UINode | null | undefined): PayloadStats {
  const stats: PayloadStats = { nodes: 0, images: 0, imageBytes: 0, textChars: 0, depth: 0, bytes: 0 };
  if (!root) return stats;
  // Recorrido iterativo: un árbol muy profundo no debe desbordar la pila
  const stack: [UINode, number][] = [[root, 1]];
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    stats.nodes++;
    if (depth > stats.depth) stats.depth = depth;
    if (typeof node.imageData === 'string' && node.imageData) {
      stats.images++;
      stats.imageBytes += node.imageData.length;
    }
    if (node.textData && typeof node.textData.characters === 'string')
      stats.textChars += node.textData.characters.length;
    if (Array.isArray(node.children)) for (const c of node.children) if (c) stack.push([c, depth + 1]);
  }
  try {
    stats.bytes = JSON.stringify(root).length;
  } catch (_e) {
    stats.bytes = stats.imageBytes;
  }
  return stats;
}

/** Motivos legibles por los que una extracción es pesada (vacío = enviar sin preguntar) */
export function heavyPayloadReasons(s: PayloadStats, limits: typeof HEAVY_PAYLOAD = HEAVY_PAYLOAD): string[] {
  const reasons: string[] = [];
  if (s.bytes > limits.bytes) {
    const share = s.bytes ? Math.round((s.imageBytes / s.bytes) * 100) : 0;
    reasons.push(`${formatBytes(s.bytes)} de datos` + (share >= 50 ? ` (${share}% en ${s.images} imágenes)` : ''));
  }
  if (s.nodes > limits.nodes) reasons.push(`${s.nodes.toLocaleString('es')} capas`);
  if (s.depth > limits.depth) reasons.push(`${s.depth} niveles de anidamiento`);
  return reasons;
}

/**
 * Copia del árbol sin imágenes: cada imagen queda como un recuadro gris del mismo tamaño
 * (marcado en metadata.imageOmitted) para no perder la composición.
 */
export function withoutImages(root: UINode): UINode {
  const PLACEHOLDER = { r: 0.88, g: 0.89, b: 0.91, a: 1 };
  const strip = (n: UINode): UINode => {
    const out: UINode = { ...n };
    if (out.imageData) {
      delete out.imageData;
      out.styles = { ...out.styles, fills: [...(out.styles?.fills || []), PLACEHOLDER] };
      out.metadata = { ...(out.metadata || {}), imageOmitted: true };
    }
    if (Array.isArray(n.children)) out.children = n.children.map(strip);
    return out;
  };
  return strip(root);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Parte un texto en trozos de `size` caracteres sin cortar un par sustituto UTF-16
 * (emoji): cada trozo viaja como JSON por separado y debe ser texto válido.
 */
export function splitIntoChunks(text: string, size: number = CHUNK_SIZE_CHARS): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--; // no separar el par
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}
