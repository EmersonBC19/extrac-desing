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
export declare const HEAVY_PAYLOAD: {
    /** Más de esto: aviso antes de enviar */
    readonly bytes: number;
    readonly nodes: 25000;
    readonly depth: 200;
};
/** Desde este tamaño el service worker envía por partes y el plugin muestra el progreso */
export declare const CHUNK_THRESHOLD_BYTES: number;
/** Tamaño de cada parte (caracteres del JSON) */
export declare const CHUNK_SIZE_CHARS: number;
export declare function measurePayload(root: UINode | null | undefined): PayloadStats;
/** Motivos legibles por los que una extracción es pesada (vacío = enviar sin preguntar) */
export declare function heavyPayloadReasons(s: PayloadStats, limits?: typeof HEAVY_PAYLOAD): string[];
/**
 * Copia del árbol sin imágenes: cada imagen queda como un recuadro gris del mismo tamaño
 * (marcado en metadata.imageOmitted) para no perder la composición.
 */
export declare function withoutImages(root: UINode): UINode;
export declare function formatBytes(bytes: number): string;
/**
 * Parte un texto en trozos de `size` caracteres sin cortar un par sustituto UTF-16
 * (emoji): cada trozo viaja como JSON por separado y debe ser texto válido.
 */
export declare function splitIntoChunks(text: string, size?: number): string[];
//# sourceMappingURL=payload-stats.d.ts.map