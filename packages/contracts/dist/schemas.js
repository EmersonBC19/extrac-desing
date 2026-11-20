"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const z = __importStar(require("zod"));
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
const finite = z.number().finite();
const sizing = z.union([finite, z.literal('FILL'), z.literal('HUG')]);
const spacing = z.object({ top: finite, right: finite, bottom: finite, left: finite }).partial().passthrough();
exports.UILayoutSchema = z
    .object({
    mode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional(),
    width: sizing.optional(),
    height: sizing.optional(),
    measuredWidth: finite.optional(),
    measuredHeight: finite.optional(),
    x: finite.optional(),
    y: finite.optional(),
    itemSpacing: finite.optional(),
    padding: spacing.optional(),
    positioning: z.enum(['AUTO', 'ABSOLUTE']).optional(),
})
    .passthrough();
exports.UITextSegmentSchema = z
    .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
})
    .passthrough();
exports.UITextDataSchema = z
    .object({
    characters: z.string().max(exports.PAYLOAD_LIMITS.maxTextChars),
    fontSize: finite.optional(),
    fontFamily: z.string().max(200).optional(),
    segments: z.array(exports.UITextSegmentSchema).max(10_000).optional(),
})
    .passthrough();
/** SVG que Figma va a interpretar: sin scripts ni URLs javascript: */
const svgContent = z
    .string()
    .max(exports.PAYLOAD_LIMITS.maxSvgChars)
    .refine(s => !/<script[\s>]/i.test(s), 'SVG con <script>')
    .refine(s => !/javascript:/i.test(s), 'SVG con URL javascript:');
/** Imagen embebida: solo data URI de imagen en base64 */
const imageData = z
    .string()
    .max(exports.PAYLOAD_LIMITS.maxImageChars)
    .regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i, 'imageData debe ser data:image/...;base64');
/** Un nodo SIN validar sus hijos (el árbol se recorre de forma iterativa, ver validateUINodeTree) */
exports.UINodeShallowSchema = z
    .object({
    id: z.string().max(200).optional(),
    type: z.enum(['FRAME', 'TEXT', 'SVG', 'COMPONENT', 'INSTANCE']),
    name: z.string().max(exports.PAYLOAD_LIMITS.maxNameChars).optional(),
    layout: exports.UILayoutSchema.optional(),
    styles: z.object({}).passthrough().optional(),
    textData: exports.UITextDataSchema.optional(),
    svgContent: svgContent.optional(),
    imageData: imageData.optional(),
    children: z.array(z.unknown()).optional(),
})
    .passthrough();
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
            return {
                ok: false,
                error: `Árbol demasiado profundo (> ${exports.PAYLOAD_LIMITS.maxDepth} niveles) en ${shortPath(path)}`,
            };
        if (++count > exports.PAYLOAD_LIMITS.maxNodes)
            return { ok: false, error: `Demasiados nodos (> ${exports.PAYLOAD_LIMITS.maxNodes})` };
        maxDepth = Math.max(maxDepth, depth);
        const parsed = exports.UINodeShallowSchema.safeParse(node);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return {
                ok: false,
                error: `${shortPath(path)}${issue.path.length ? '.' + issue.path.join('.') : ''}: ${issue.message}`,
            };
        }
        const children = parsed.data.children || [];
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push({ node: children[i], depth: depth + 1, path: `${path}.children[${i}]` });
        }
    }
    return { ok: true, nodeCount: count, maxDepth };
}
exports.WSRenderPayloadSchema = z
    .object({
    rootNode: z.unknown(),
    tokens: z.object({}).passthrough().optional(),
    createAsComponent: z.boolean().optional(),
    board: z.boolean().optional(),
    clearPage: z.boolean().optional(),
    pageName: z.string().max(200).optional(),
    sectionTitle: z.string().max(500).optional(),
    source: z
        .object({
        url: z.string().max(4096).optional(),
        title: z.string().max(1000).optional(),
    })
        .passthrough()
        .optional(),
})
    .passthrough();
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
exports.WSMessageEnvelopeSchema = z
    .object({
    type: z.string().min(1).max(64),
})
    .passthrough();
//# sourceMappingURL=schemas.js.map