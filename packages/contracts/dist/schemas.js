"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSMessageEnvelopeSchema = exports.WSRenderPayloadSchema = exports.UINodeShallowSchema = exports.UITextDataSchema = exports.UITextSegmentSchema = exports.UILayoutSchema = exports.PAYLOAD_LIMITS = void 0;
exports.validateUINodeTree = validateUINodeTree;
exports.validateRenderPayload = validateRenderPayload;
/**
 * Validación en tiempo de ejecución de los payloads (plan de mejoras, fase 1.3).
 *
 * TypeScript solo protege al compilar; por WebSocket o "Pegar JSON" los datos llegan sin
 * garantías. Estos esquemas son estrictos en lo que afecta a la seguridad y a la estabilidad
 * de Figma (tipos, tamaños, profundidad, imágenes, SVG) y permisivos en el resto
 * (`passthrough`), para no rechazar extracciones válidas por campos nuevos.
 */
const zod_1 = require("zod");
exports.PAYLOAD_LIMITS = {
    /** Profundidad máxima del árbol (evita desbordar la pila del plugin) */
    maxDepth: 400,
    /** Nodos totales (una landing grande ronda 5–15 mil) */
    maxNodes: 150_000,
    /** Caracteres de una imagen base64 (~30 MB) */
    maxImageChars: 40 * 1024 * 1024,
    maxSvgChars: 2 * 1024 * 1024,
    maxTextChars: 200_000,
    maxNameChars: 1_000,
};
const finite = zod_1.z.number().finite();
const sizing = zod_1.z.union([finite, zod_1.z.literal('FILL'), zod_1.z.literal('HUG')]);
const spacing = zod_1.z.object({ top: finite, right: finite, bottom: finite, left: finite }).partial().passthrough();
exports.UILayoutSchema = zod_1.z.object({
    mode: zod_1.z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional(),
    width: sizing.optional(),
    height: sizing.optional(),
    measuredWidth: finite.optional(),
    measuredHeight: finite.optional(),
    x: finite.optional(),
    y: finite.optional(),
    itemSpacing: finite.optional(),
    padding: spacing.optional(),
    positioning: zod_1.z.enum(['AUTO', 'ABSOLUTE']).optional(),
}).passthrough();
exports.UITextSegmentSchema = zod_1.z.object({
    start: zod_1.z.number().int().nonnegative(),
    end: zod_1.z.number().int().nonnegative(),
}).passthrough();
exports.UITextDataSchema = zod_1.z.object({
    characters: zod_1.z.string().max(exports.PAYLOAD_LIMITS.maxTextChars),
    fontSize: finite.optional(),
    fontFamily: zod_1.z.string().max(200).optional(),
    segments: zod_1.z.array(exports.UITextSegmentSchema).max(10_000).optional(),
}).passthrough();
/** SVG que Figma va a interpretar: sin scripts ni URLs javascript: */
const svgContent = zod_1.z.string()
    .max(exports.PAYLOAD_LIMITS.maxSvgChars)
    .refine(s => !/<script[\s>]/i.test(s), 'SVG con <script>')
    .refine(s => !/javascript:/i.test(s), 'SVG con URL javascript:');
/** Imagen embebida: solo data URI de imagen en base64 */
const imageData = zod_1.z.string()
    .max(exports.PAYLOAD_LIMITS.maxImageChars)
    .regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i, 'imageData debe ser data:image/...;base64');
/** Un nodo SIN validar sus hijos (el árbol se recorre de forma iterativa, ver validateUINodeTree) */
exports.UINodeShallowSchema = zod_1.z.object({
    id: zod_1.z.string().max(200).optional(),
    type: zod_1.z.enum(['FRAME', 'TEXT', 'SVG', 'COMPONENT', 'INSTANCE']),
    name: zod_1.z.string().max(exports.PAYLOAD_LIMITS.maxNameChars).optional(),
    layout: exports.UILayoutSchema.optional(),
    styles: zod_1.z.object({}).passthrough().optional(),
    textData: exports.UITextDataSchema.optional(),
    svgContent: svgContent.optional(),
    imageData: imageData.optional(),
    children: zod_1.z.array(zod_1.z.unknown()).optional(),
}).passthrough();
/** Ruta legible en errores: en árboles profundos se conserva solo el tramo final */
function shortPath(path) {
    return path.length > 160 ? 'rootNode…' + path.slice(-140) : path;
}
/**
 * Valida el árbol completo de forma iterativa (sin recursión: un payload malicioso muy
 * profundo no puede desbordar la pila) y aplica los límites de profundidad y cantidad.
 */
function validateUINodeTree(root) {
    const stack = [{ node: root, depth: 0, path: 'rootNode' }];
    let count = 0;
    let maxDepth = 0;
    while (stack.length) {
        const { node, depth, path } = stack.pop();
        if (depth > exports.PAYLOAD_LIMITS.maxDepth)
            return { ok: false, error: `Árbol demasiado profundo (> ${exports.PAYLOAD_LIMITS.maxDepth} niveles) en ${shortPath(path)}` };
        if (++count > exports.PAYLOAD_LIMITS.maxNodes)
            return { ok: false, error: `Demasiados nodos (> ${exports.PAYLOAD_LIMITS.maxNodes})` };
        maxDepth = Math.max(maxDepth, depth);
        const parsed = exports.UINodeShallowSchema.safeParse(node);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return { ok: false, error: `${shortPath(path)}${issue.path.length ? '.' + issue.path.join('.') : ''}: ${issue.message}` };
        }
        const children = parsed.data.children || [];
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push({ node: children[i], depth: depth + 1, path: `${path}.children[${i}]` });
        }
    }
    return { ok: true, nodeCount: count, maxDepth };
}
exports.WSRenderPayloadSchema = zod_1.z.object({
    rootNode: zod_1.z.unknown(),
    tokens: zod_1.z.object({}).passthrough().optional(),
    createAsComponent: zod_1.z.boolean().optional(),
    board: zod_1.z.boolean().optional(),
    clearPage: zod_1.z.boolean().optional(),
    pageName: zod_1.z.string().max(200).optional(),
    sectionTitle: zod_1.z.string().max(500).optional(),
    source: zod_1.z.object({
        url: zod_1.z.string().max(4096).optional(),
        title: zod_1.z.string().max(1000).optional(),
    }).passthrough().optional(),
}).passthrough();
/** Payload de RENDER_NODES completo: forma del sobre + árbol de nodos */
function validateRenderPayload(payload) {
    const env = exports.WSRenderPayloadSchema.safeParse(payload);
    if (!env.success) {
        const issue = env.error.issues[0];
        return { ok: false, error: `payload${issue.path.length ? '.' + issue.path.join('.') : ''}: ${issue.message}` };
    }
    return validateUINodeTree(env.data.rootNode);
}
/** Sobre mínimo de cualquier mensaje del bus */
exports.WSMessageEnvelopeSchema = zod_1.z.object({
    type: zod_1.z.string().min(1).max(64),
}).passthrough();
//# sourceMappingURL=schemas.js.map