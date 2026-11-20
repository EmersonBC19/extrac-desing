"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHUNK_SIZE_CHARS = exports.CHUNK_THRESHOLD_BYTES = exports.HEAVY_PAYLOAD = void 0;
exports.measurePayload = measurePayload;
exports.heavyPayloadReasons = heavyPayloadReasons;
exports.withoutImages = withoutImages;
exports.formatBytes = formatBytes;
exports.splitIntoChunks = splitIntoChunks;
exports.HEAVY_PAYLOAD = {
    /** Más de esto: aviso antes de enviar */
    bytes: 15 * 1024 * 1024,
    nodes: 25_000,
    depth: 200,
};
/** Desde este tamaño el service worker envía por partes y el plugin muestra el progreso */
exports.CHUNK_THRESHOLD_BYTES = 1024 * 1024;
/** Tamaño de cada parte (caracteres del JSON) */
exports.CHUNK_SIZE_CHARS = 512 * 1024;
function measurePayload(root) {
    const stats = { nodes: 0, images: 0, imageBytes: 0, textChars: 0, depth: 0, bytes: 0 };
    if (!root)
        return stats;
    // Recorrido iterativo: un árbol muy profundo no debe desbordar la pila
    const stack = [[root, 1]];
    while (stack.length) {
        const [node, depth] = stack.pop();
        stats.nodes++;
        if (depth > stats.depth)
            stats.depth = depth;
        if (typeof node.imageData === 'string' && node.imageData) {
            stats.images++;
            stats.imageBytes += node.imageData.length;
        }
        if (node.textData && typeof node.textData.characters === 'string')
            stats.textChars += node.textData.characters.length;
        if (Array.isArray(node.children))
            for (const c of node.children)
                if (c)
                    stack.push([c, depth + 1]);
    }
    try {
        stats.bytes = JSON.stringify(root).length;
    }
    catch (_e) {
        stats.bytes = stats.imageBytes;
    }
    return stats;
}
/** Motivos legibles por los que una extracción es pesada (vacío = enviar sin preguntar) */
function heavyPayloadReasons(s, limits = exports.HEAVY_PAYLOAD) {
    const reasons = [];
    if (s.bytes > limits.bytes) {
        const share = s.bytes ? Math.round((s.imageBytes / s.bytes) * 100) : 0;
        reasons.push(`${formatBytes(s.bytes)} de datos` + (share >= 50 ? ` (${share}% en ${s.images} imágenes)` : ''));
    }
    if (s.nodes > limits.nodes)
        reasons.push(`${s.nodes.toLocaleString('es')} capas`);
    if (s.depth > limits.depth)
        reasons.push(`${s.depth} niveles de anidamiento`);
    return reasons;
}
/**
 * Copia del árbol sin imágenes: cada imagen queda como un recuadro gris del mismo tamaño
 * (marcado en metadata.imageOmitted) para no perder la composición.
 */
function withoutImages(root) {
    const PLACEHOLDER = { r: 0.88, g: 0.89, b: 0.91, a: 1 };
    const strip = (n) => {
        const out = { ...n };
        if (out.imageData) {
            delete out.imageData;
            out.styles = { ...out.styles, fills: [...(out.styles?.fills || []), PLACEHOLDER] };
            out.metadata = { ...(out.metadata || {}), imageOmitted: true };
        }
        if (Array.isArray(n.children))
            out.children = n.children.map(strip);
        return out;
    };
    return strip(root);
}
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024)
        return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}
/**
 * Parte un texto en trozos de `size` caracteres sin cortar un par sustituto UTF-16
 * (emoji): cada trozo viaja como JSON por separado y debe ser texto válido.
 */
function splitIntoChunks(text, size = exports.CHUNK_SIZE_CHARS) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = Math.min(text.length, i + size);
        const code = text.charCodeAt(end - 1);
        if (end < text.length && code >= 0xd800 && code <= 0xdbff)
            end--; // no separar el par
        chunks.push(text.slice(i, end));
        i = end;
    }
    return chunks;
}
//# sourceMappingURL=payload-stats.js.map