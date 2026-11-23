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
exports.HubInboundSchema = exports.HUB_PROTOCOL = exports.MESSAGE_CATALOG = exports.MAX_CHUNK_CHARS = exports.MAX_CHUNKS = void 0;
exports.messageTypesOf = messageTypesOf;
/**
 * Mensajes del sistema (plan de mejoras, fase 4.1): una sola definición de qué mensajes existen,
 * quién los envía y qué forma tienen. Se usa en el hub, el plugin y las pruebas.
 *
 * Tres canales:
 *  - hub:       WebSocket ws://127.0.0.1:8080 (extensión, CLI/MCP y UI del plugin ↔ hub)
 *  - plugin:    postMessage entre la UI del plugin (iframe) y su sandbox (code.ts)
 *  - extension: chrome.runtime entre el content script y el service worker
 *
 * Cada mensaje se clasifica (CQRS ligero) como:
 *  - command: pide un cambio (dibujar, borrar, vincular)
 *  - query:   pide información sin cambiar nada
 *  - event:   informa algo que ya pasó (respuestas y notificaciones)
 * Los nombres que viajan por la red NO cambian (compatibilidad con clientes ya desplegados).
 */
const z = __importStar(require("zod"));
/** Envío por partes: tope de partes y de caracteres por parte (64 MB en total como máximo) */
exports.MAX_CHUNKS = 256;
exports.MAX_CHUNK_CHARS = 1024 * 1024;
/** Catálogo completo: documentación viva y base de las pruebas de cobertura de manejadores */
exports.MESSAGE_CATALOG = {
    // ── Hub (WebSocket) ─────────────────────────────────────────────────────────────────────────
    REGISTER_CLIENT: {
        channel: 'hub',
        kind: 'command',
        route: 'cliente → hub',
        description: 'Presentarse (FIGMA_PLUGIN, CLI_OR_MCP…); el plugin incluye su código de vinculación',
    },
    REGISTER: {
        channel: 'hub',
        kind: 'command',
        route: 'cliente → hub',
        description: 'Alias antiguo de REGISTER_CLIENT',
    },
    AUTH_REQUIRED: {
        channel: 'hub',
        kind: 'event',
        route: 'hub → cliente',
        description: 'El cliente (origen "null") debe vincularse con código',
    },
    AUTH_OK: { channel: 'hub', kind: 'event', route: 'hub → cliente', description: 'Vinculación aceptada' },
    AUTH_FAILED: {
        channel: 'hub',
        kind: 'event',
        route: 'hub → cliente',
        description: 'Código incorrecto o demasiados intentos',
    },
    GET_STATUS: {
        channel: 'hub',
        kind: 'query',
        route: 'cliente → hub',
        description: '¿Hay un plugin de Figma conectado?',
    },
    PING: { channel: 'hub', kind: 'query', route: 'cliente → hub', description: 'Alias de GET_STATUS' },
    STATUS_RESPONSE: { channel: 'hub', kind: 'event', route: 'hub → cliente', description: 'Respuesta a GET_STATUS' },
    GET_VIEWS_CATALOG: {
        channel: 'hub',
        kind: 'query',
        route: 'cliente → hub',
        description: 'Vistas del crawler disponibles',
    },
    VIEWS_CATALOG: {
        channel: 'hub',
        kind: 'event',
        route: 'hub → cliente',
        description: 'Respuesta a GET_VIEWS_CATALOG',
    },
    REQUEST_VIEW_RENDER: {
        channel: 'hub',
        kind: 'command',
        route: 'plugin → hub',
        description: 'Dibujar una vista del catálogo (extrayéndola si hace falta)',
    },
    EXTRACT_PROGRESS: {
        channel: 'hub',
        kind: 'event',
        route: 'hub → plugin',
        description: 'Progreso de una extracción en curso',
    },
    RENDER_NODES: {
        channel: 'hub',
        kind: 'command',
        route: 'extensión/CLI → hub → plugin',
        description: 'Dibujar un árbol UINode en Figma',
    },
    RENDER_CHUNK: {
        channel: 'hub',
        kind: 'command',
        route: 'extensión → hub',
        description: 'Una parte de un RENDER_NODES grande (el hub las junta y valida el conjunto)',
    },
    RENDER_PROGRESS: {
        channel: 'hub',
        kind: 'event',
        route: 'hub → plugin',
        description: 'Progreso de recepción de un render enviado por partes',
    },
    RENDER_SUCCESS: {
        channel: 'hub',
        kind: 'event',
        route: 'plugin → hub → CLI/MCP',
        description: 'Figma terminó de dibujar',
    },
    SCAN_FINISH: {
        channel: 'hub',
        kind: 'command',
        route: 'extensión → hub → plugin',
        description: 'Fin del escaneo del sitio: el plugin arma el tablero con todas las rutas',
    },
    RENDER_ERROR: {
        channel: 'hub',
        kind: 'event',
        route: 'hub/plugin → cliente',
        description: 'Falló un render o un payload fue rechazado',
    },
    GET_FIGMA_SELECTION: {
        channel: 'hub',
        kind: 'query',
        route: 'extensión → hub → plugin',
        description: 'QA de diseño: qué frame está seleccionado en Figma (nombre y ancho)',
    },
    FIGMA_SELECTION: {
        channel: 'hub',
        kind: 'event',
        route: 'plugin → hub → extensión',
        description: 'Respuesta a GET_FIGMA_SELECTION',
    },
    // ── Plugin (UI ↔ sandbox) ───────────────────────────────────────────────────────────────────
    CLEAR_PAGE: { channel: 'plugin', kind: 'command', route: 'UI → sandbox', description: 'Vaciar la página actual' },
    DELETE_NODE: { channel: 'plugin', kind: 'command', route: 'UI → sandbox', description: 'Borrar un nodo del lienzo' },
    DELETE_MULTIPLE_NODES: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Borrar varios nodos del lienzo',
    },
    CONVERT_TO_COMPONENT: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Convertir un frame en componente',
    },
    FOCUS_NODE: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Seleccionar y enfocar un nodo',
    },
    ZOOM_ALL: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Ajustar el zoom a todo el contenido',
    },
    SET_PAIRING_CODE: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Guardar el código de vinculación en figma.clientStorage',
    },
    GET_PAIRING_CODE: {
        channel: 'plugin',
        kind: 'query',
        route: 'UI → sandbox',
        description: 'Leer el código de vinculación guardado',
    },
    PAIRING_CODE: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Respuesta a GET_PAIRING_CODE',
    },
    GET_SETTINGS: {
        channel: 'plugin',
        kind: 'query',
        route: 'UI → sandbox',
        description: 'Leer los ajustes del plugin (figma.clientStorage: el iframe no tiene localStorage)',
    },
    SET_SETTINGS: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Guardar los ajustes del plugin',
    },
    SETTINGS: { channel: 'plugin', kind: 'event', route: 'sandbox → UI', description: 'Respuesta a GET_SETTINGS' },
    GET_HISTORY: {
        channel: 'plugin',
        kind: 'query',
        route: 'UI → sandbox',
        description: 'Historial del receptor (clientStorage), sin lo que ya no existe en el lienzo',
    },
    SET_HISTORY: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Guardar el historial del receptor',
    },
    HISTORY: { channel: 'plugin', kind: 'event', route: 'sandbox → UI', description: 'Respuesta a GET_HISTORY' },
    DELETED: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Resultado real de un borrado (qué se borró y cuántos ya no existían)',
    },
    GET_PAGE_INFO: { channel: 'plugin', kind: 'query', route: 'UI → sandbox', description: 'Nombre de la página actual' },
    GET_SELECTION: {
        channel: 'plugin',
        kind: 'query',
        route: 'UI → sandbox',
        description: 'QA de diseño: el frame seleccionado (id, nombre, tamaño)',
    },
    SELECTION_INFO: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Respuesta a GET_SELECTION',
    },
    PAGE_INFO: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Página actual (respuesta o cambio de página)',
    },
    LOG: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Línea para el registro visible del plugin',
    },
    GET_AVAILABLE_FONTS: {
        channel: 'plugin',
        kind: 'query',
        route: 'UI → sandbox',
        description: 'Lista de fuentes disponibles en el entorno Figma del usuario',
    },
    AVAILABLE_FONTS: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Respuesta con fuentes disponibles en Figma',
    },
    REPLACE_FONTS: {
        channel: 'plugin',
        kind: 'command',
        route: 'UI → sandbox',
        description: 'Reemplazar familias tipográficas en selección o lienzo',
    },
    FONTS_REPLACED: {
        channel: 'plugin',
        kind: 'event',
        route: 'sandbox → UI',
        description: 'Confirmación de fuentes reemplazadas',
    },
    // ── Extensión (content script ↔ service worker) ─────────────────────────────────────────────
    TRANSMIT_TO_FIGMA: {
        channel: 'extension',
        kind: 'command',
        route: 'content → service worker',
        description: 'Enviar una extracción al hub',
    },
    CAPTURE_REGIONS: {
        channel: 'extension',
        kind: 'query',
        route: 'content → service worker',
        description: 'Recortes de una captura de la pestaña',
    },
    FETCH_IMAGE_AS_BASE64: {
        channel: 'extension',
        kind: 'query',
        route: 'content → service worker',
        description: 'Descargar una imagen con los permisos de la extensión',
    },
    FETCH_STYLESHEET: {
        channel: 'extension',
        kind: 'query',
        route: 'content → service worker',
        description: 'Texto de una hoja de estilo de otro dominio ("Exportar HTML")',
    },
    QUERY_FIGMA_SELECTION: {
        channel: 'extension',
        kind: 'query',
        route: 'content → service worker',
        description: 'QA de diseño: el frame seleccionado en Figma (vía hub)',
    },
    COMPARE_IN_FIGMA: {
        channel: 'extension',
        kind: 'command',
        route: 'content → service worker',
        description: 'QA de diseño: enviar la extracción para comparar y esperar el resumen',
    },
    RENDER_FRAME_TOKEN: {
        channel: 'extension',
        kind: 'command',
        route: 'content → service worker',
        description: 'Token de un solo uso para la página de render (breakpoints y tema)',
    },
    CLAIM_RENDER_TOKEN: {
        channel: 'extension',
        kind: 'command',
        route: 'página de render → service worker',
        description: 'La página de render canjea su token antes de dibujar',
    },
    CHECK_FIGMA_STATUS: {
        channel: 'extension',
        kind: 'query',
        route: 'content → service worker',
        description: 'Estado del hub y del plugin',
    },
    SCAN_START: {
        channel: 'extension',
        kind: 'command',
        route: 'content → service worker',
        description: 'Escanear las rutas confirmadas del sitio en una ventana de escaneo',
    },
    SCAN_CANCEL: {
        channel: 'extension',
        kind: 'command',
        route: 'content → service worker',
        description: 'Detener el escaneo en curso y cerrar su ventana',
    },
    SCAN_PROGRESS: {
        channel: 'extension',
        kind: 'event',
        route: 'service worker → content',
        description: 'Avance del escaneo (página actual, terminado, cancelado o error)',
    },
};
/** Tipos de mensaje de un canal (para comprobar en pruebas que todos tienen manejador) */
function messageTypesOf(channel, route) {
    return Object.keys(exports.MESSAGE_CATALOG).filter(t => exports.MESSAGE_CATALOG[t].channel === channel && (!route || route.test(exports.MESSAGE_CATALOG[t].route)));
}
// ── Mensajes que RECIBE el hub: entrada no confiable → esquema Zod ───────────────────────────
// (el árbol de RENDER_NODES lo valida aparte validateRenderPayload, con límites de tamaño)
/** QA de diseño: el frame de Figma con el que se compara */
const FigmaSelectionSchema = z
    .object({
    id: z.string().max(200),
    name: z.string().max(1000),
    type: z.string().max(40),
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative(),
})
    .passthrough();
/**
 * Versión del protocolo hub ↔ extensión ↔ plugin. Súbela cuando una función necesite que los tres
 * estén al día (2: breakpoints y tema, QA de diseño y selección de Figma). El hub la anuncia en
 * STATUS_RESPONSE y el plugin al registrarse: un hub arrancado antes de actualizar, o el plugin
 * abierto desde entonces, descartan los mensajes nuevos sin avisar, y así la extensión puede decir
 * qué hay que reiniciar en vez de esperar una respuesta que nunca llega.
 */
exports.HUB_PROTOCOL = 2;
const RegisterSchema = z
    .object({
    type: z.enum(['REGISTER_CLIENT', 'REGISTER']),
    clientType: z.string().max(64).optional(),
    role: z.string().max(64).optional(),
    client: z.string().max(200).optional(),
    pairingCode: z.string().max(32).optional(),
    protocol: z.number().int().nonnegative().max(1000).optional(),
})
    .passthrough();
/** Tiempos de dibujo en Figma por etapa (fase 5.1: medir en lugar de suponer) */
const RenderTimingsSchema = z
    .object({
    fontsMs: z.number().finite(),
    buildMs: z.number().finite(),
    placeMs: z.number().finite(),
    totalMs: z.number().finite(),
})
    .partial();
/** Fuentes que Figma no tenía y con cuál se sustituyeron (fase 5.3) */
const FontSubstitutionsSchema = z
    .array(z.object({ requested: z.string().max(200), used: z.string().max(200), texts: z.number().int().min(0) }))
    .max(50);
exports.HubInboundSchema = z.discriminatedUnion('type', [
    RegisterSchema,
    z.object({ type: z.literal('GET_STATUS') }).passthrough(),
    z.object({ type: z.literal('PING') }).passthrough(),
    z.object({ type: z.literal('GET_VIEWS_CATALOG') }).passthrough(),
    z.object({ type: z.literal('REQUEST_VIEW_RENDER'), payload: z.object({}).passthrough().optional() }).passthrough(),
    z.object({ type: z.literal('RENDER_NODES'), payload: z.unknown() }).passthrough(),
    z.object({
        type: z.literal('RENDER_CHUNK'),
        transferId: z.string().min(1).max(64),
        index: z.number().int().min(0),
        total: z.number().int().min(1).max(exports.MAX_CHUNKS),
        data: z.string().max(exports.MAX_CHUNK_CHARS),
    }),
    z
        .object({
        type: z.literal('RENDER_SUCCESS'),
        nodeId: z.string().max(200).optional(),
        name: z.string().max(1000).optional(),
        durationMs: z.number().finite().optional(),
        timings: RenderTimingsSchema.optional(),
        fontSubstitutions: FontSubstitutionsSchema.optional(),
    })
        .passthrough(),
    z.object({ type: z.literal('RENDER_ERROR'), error: z.string().max(5000).optional() }).passthrough(),
    z.object({
        type: z.literal('SCAN_FINISH'),
        scanId: z.string().min(1).max(64),
        count: z.number().int().min(0).max(100),
        source: z.object({ url: z.string().max(4096).optional(), title: z.string().max(1000).optional() }).optional(),
    }),
    z.object({ type: z.literal('GET_FIGMA_SELECTION'), requestId: z.string().max(64).optional() }).passthrough(),
    z
        .object({
        type: z.literal('FIGMA_SELECTION'),
        requestId: z.string().max(64).optional(),
        selection: FigmaSelectionSchema.nullable().optional(),
        error: z.string().max(1000).optional(),
    })
        .passthrough(),
]);
//# sourceMappingURL=messages.js.map