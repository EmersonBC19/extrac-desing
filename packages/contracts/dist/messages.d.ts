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
import * as z from 'zod';
import type { WSRenderPayload } from './types.js';
/** Envío por partes: tope de partes y de caracteres por parte (64 MB en total como máximo) */
export declare const MAX_CHUNKS = 256;
export declare const MAX_CHUNK_CHARS: number;
export type MessageKind = 'command' | 'query' | 'event';
export type MessageChannel = 'hub' | 'plugin' | 'extension';
export interface MessageInfo {
    channel: MessageChannel;
    kind: MessageKind;
    /** Quién lo envía → quién lo recibe */
    route: string;
    description: string;
}
/** Catálogo completo: documentación viva y base de las pruebas de cobertura de manejadores */
export declare const MESSAGE_CATALOG: {
    readonly REGISTER_CLIENT: {
        readonly channel: "hub";
        readonly kind: "command";
        readonly route: "cliente → hub";
        readonly description: "Presentarse (FIGMA_PLUGIN, CLI_OR_MCP…); el plugin incluye su código de vinculación";
    };
    readonly REGISTER: {
        readonly channel: "hub";
        readonly kind: "command";
        readonly route: "cliente → hub";
        readonly description: "Alias antiguo de REGISTER_CLIENT";
    };
    readonly AUTH_REQUIRED: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → cliente";
        readonly description: "El cliente (origen \"null\") debe vincularse con código";
    };
    readonly AUTH_OK: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → cliente";
        readonly description: "Vinculación aceptada";
    };
    readonly AUTH_FAILED: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → cliente";
        readonly description: "Código incorrecto o demasiados intentos";
    };
    readonly GET_STATUS: {
        readonly channel: "hub";
        readonly kind: "query";
        readonly route: "cliente → hub";
        readonly description: "¿Hay un plugin de Figma conectado?";
    };
    readonly PING: {
        readonly channel: "hub";
        readonly kind: "query";
        readonly route: "cliente → hub";
        readonly description: "Alias de GET_STATUS";
    };
    readonly STATUS_RESPONSE: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → cliente";
        readonly description: "Respuesta a GET_STATUS";
    };
    readonly GET_VIEWS_CATALOG: {
        readonly channel: "hub";
        readonly kind: "query";
        readonly route: "cliente → hub";
        readonly description: "Vistas del crawler disponibles";
    };
    readonly VIEWS_CATALOG: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → cliente";
        readonly description: "Respuesta a GET_VIEWS_CATALOG";
    };
    readonly REQUEST_VIEW_RENDER: {
        readonly channel: "hub";
        readonly kind: "command";
        readonly route: "plugin → hub";
        readonly description: "Dibujar una vista del catálogo (extrayéndola si hace falta)";
    };
    readonly EXTRACT_PROGRESS: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → plugin";
        readonly description: "Progreso de una extracción en curso";
    };
    readonly RENDER_NODES: {
        readonly channel: "hub";
        readonly kind: "command";
        readonly route: "extensión/CLI → hub → plugin";
        readonly description: "Dibujar un árbol UINode en Figma";
    };
    readonly RENDER_CHUNK: {
        readonly channel: "hub";
        readonly kind: "command";
        readonly route: "extensión → hub";
        readonly description: "Una parte de un RENDER_NODES grande (el hub las junta y valida el conjunto)";
    };
    readonly RENDER_PROGRESS: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub → plugin";
        readonly description: "Progreso de recepción de un render enviado por partes";
    };
    readonly RENDER_SUCCESS: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "plugin → hub → CLI/MCP";
        readonly description: "Figma terminó de dibujar";
    };
    readonly SCAN_FINISH: {
        readonly channel: "hub";
        readonly kind: "command";
        readonly route: "extensión → hub → plugin";
        readonly description: "Fin del escaneo del sitio: el plugin arma el tablero con todas las rutas";
    };
    readonly CLIENT_LOG: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "plugin/extensión → hub";
        readonly description: "Aviso o error de un cliente: queda en el log del hub (~/.code-to-figma/hub.log)";
    };
    readonly RENDER_ERROR: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "hub/plugin → cliente";
        readonly description: "Falló un render o un payload fue rechazado";
    };
    readonly GET_FIGMA_SELECTION: {
        readonly channel: "hub";
        readonly kind: "query";
        readonly route: "extensión → hub → plugin";
        readonly description: "QA de diseño: qué frame está seleccionado en Figma (nombre y ancho)";
    };
    readonly FIGMA_SELECTION: {
        readonly channel: "hub";
        readonly kind: "event";
        readonly route: "plugin → hub → extensión";
        readonly description: "Respuesta a GET_FIGMA_SELECTION";
    };
    readonly CLEAR_PAGE: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Vaciar la página actual";
    };
    readonly DELETE_NODE: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Borrar un nodo del lienzo";
    };
    readonly DELETE_MULTIPLE_NODES: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Borrar varios nodos del lienzo";
    };
    readonly CONVERT_TO_COMPONENT: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Convertir un frame en componente";
    };
    readonly FOCUS_NODE: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Seleccionar y enfocar un nodo";
    };
    readonly ZOOM_ALL: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Ajustar el zoom a todo el contenido";
    };
    readonly SET_PAIRING_CODE: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Guardar el código de vinculación en figma.clientStorage";
    };
    readonly GET_PAIRING_CODE: {
        readonly channel: "plugin";
        readonly kind: "query";
        readonly route: "UI → sandbox";
        readonly description: "Leer el código de vinculación guardado";
    };
    readonly PAIRING_CODE: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Respuesta a GET_PAIRING_CODE";
    };
    readonly GET_SETTINGS: {
        readonly channel: "plugin";
        readonly kind: "query";
        readonly route: "UI → sandbox";
        readonly description: "Leer los ajustes del plugin (figma.clientStorage: el iframe no tiene localStorage)";
    };
    readonly SET_SETTINGS: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Guardar los ajustes del plugin";
    };
    readonly SETTINGS: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Respuesta a GET_SETTINGS";
    };
    readonly GET_HISTORY: {
        readonly channel: "plugin";
        readonly kind: "query";
        readonly route: "UI → sandbox";
        readonly description: "Historial del receptor (clientStorage), sin lo que ya no existe en el lienzo";
    };
    readonly SET_HISTORY: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Guardar el historial del receptor";
    };
    readonly HISTORY: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Respuesta a GET_HISTORY";
    };
    readonly DELETED: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Resultado real de un borrado (qué se borró y cuántos ya no existían)";
    };
    readonly GET_PAGE_INFO: {
        readonly channel: "plugin";
        readonly kind: "query";
        readonly route: "UI → sandbox";
        readonly description: "Nombre de la página actual";
    };
    readonly GET_SELECTION: {
        readonly channel: "plugin";
        readonly kind: "query";
        readonly route: "UI → sandbox";
        readonly description: "QA de diseño: el frame seleccionado (id, nombre, tamaño)";
    };
    readonly SELECTION_INFO: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Respuesta a GET_SELECTION";
    };
    readonly PAGE_INFO: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Página actual (respuesta o cambio de página)";
    };
    readonly LOG: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Línea para el registro visible del plugin";
    };
    readonly GET_AVAILABLE_FONTS: {
        readonly channel: "plugin";
        readonly kind: "query";
        readonly route: "UI → sandbox";
        readonly description: "Lista de fuentes disponibles en el entorno Figma del usuario";
    };
    readonly AVAILABLE_FONTS: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Respuesta con fuentes disponibles en Figma";
    };
    readonly REPLACE_FONTS: {
        readonly channel: "plugin";
        readonly kind: "command";
        readonly route: "UI → sandbox";
        readonly description: "Reemplazar familias tipográficas en selección o lienzo";
    };
    readonly FONTS_REPLACED: {
        readonly channel: "plugin";
        readonly kind: "event";
        readonly route: "sandbox → UI";
        readonly description: "Confirmación de fuentes reemplazadas";
    };
    readonly TRANSMIT_TO_FIGMA: {
        readonly channel: "extension";
        readonly kind: "command";
        readonly route: "content → service worker";
        readonly description: "Enviar una extracción al hub";
    };
    readonly CAPTURE_REGIONS: {
        readonly channel: "extension";
        readonly kind: "query";
        readonly route: "content → service worker";
        readonly description: "Recortes de una captura de la pestaña";
    };
    readonly FETCH_IMAGE_AS_BASE64: {
        readonly channel: "extension";
        readonly kind: "query";
        readonly route: "content → service worker";
        readonly description: "Descargar una imagen con los permisos de la extensión";
    };
    readonly FETCH_STYLESHEET: {
        readonly channel: "extension";
        readonly kind: "query";
        readonly route: "content → service worker";
        readonly description: "Texto de una hoja de estilo de otro dominio (\"Exportar HTML\")";
    };
    readonly QUERY_FIGMA_SELECTION: {
        readonly channel: "extension";
        readonly kind: "query";
        readonly route: "content → service worker";
        readonly description: "QA de diseño: el frame seleccionado en Figma (vía hub)";
    };
    readonly COMPARE_IN_FIGMA: {
        readonly channel: "extension";
        readonly kind: "command";
        readonly route: "content → service worker";
        readonly description: "QA de diseño: enviar la extracción para comparar y esperar el resumen";
    };
    readonly RENDER_FRAME_TOKEN: {
        readonly channel: "extension";
        readonly kind: "command";
        readonly route: "content → service worker";
        readonly description: "Token de un solo uso para la página de render (breakpoints y tema)";
    };
    readonly CLAIM_RENDER_TOKEN: {
        readonly channel: "extension";
        readonly kind: "command";
        readonly route: "página de render → service worker";
        readonly description: "La página de render canjea su token antes de dibujar";
    };
    readonly CHECK_FIGMA_STATUS: {
        readonly channel: "extension";
        readonly kind: "query";
        readonly route: "content → service worker";
        readonly description: "Estado del hub y del plugin";
    };
    readonly SCAN_START: {
        readonly channel: "extension";
        readonly kind: "command";
        readonly route: "content → service worker";
        readonly description: "Escanear las rutas confirmadas del sitio en una ventana de escaneo";
    };
    readonly REPORT_TO_HUB: {
        readonly channel: "extension";
        readonly kind: "event";
        readonly route: "content → service worker";
        readonly description: "Aviso o error del inspector: el service worker lo deja en el log del hub (CLIENT_LOG)";
    };
    readonly SCAN_CANCEL: {
        readonly channel: "extension";
        readonly kind: "command";
        readonly route: "content → service worker";
        readonly description: "Detener el escaneo en curso y cerrar su ventana";
    };
    readonly SCAN_PROGRESS: {
        readonly channel: "extension";
        readonly kind: "event";
        readonly route: "service worker → content";
        readonly description: "Avance del escaneo (página actual, terminado, cancelado o error)";
    };
};
export type MessageType = keyof typeof MESSAGE_CATALOG;
/** Tipos de mensaje de un canal (para comprobar en pruebas que todos tienen manejador) */
export declare function messageTypesOf(channel: MessageChannel, route?: RegExp): MessageType[];
/**
 * Versión del protocolo hub ↔ extensión ↔ plugin. Súbela cuando una función necesite que los tres
 * estén al día (2: breakpoints y tema, QA de diseño y selección de Figma). El hub la anuncia en
 * STATUS_RESPONSE y el plugin al registrarse: un hub arrancado antes de actualizar, o el plugin
 * abierto desde entonces, descartan los mensajes nuevos sin avisar, y así la extensión puede decir
 * qué hay que reiniciar en vez de esperar una respuesta que nunca llega.
 */
export declare const HUB_PROTOCOL = 2;
/** Tiempos de dibujo en Figma por etapa (fase 5.1: medir en lugar de suponer) */
declare const RenderTimingsSchema: z.ZodObject<{
    fontsMs: z.ZodOptional<z.ZodNumber>;
    buildMs: z.ZodOptional<z.ZodNumber>;
    placeMs: z.ZodOptional<z.ZodNumber>;
    totalMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type RenderTimings = z.infer<typeof RenderTimingsSchema>;
/** Fuentes que Figma no tenía y con cuál se sustituyeron (fase 5.3) */
declare const FontSubstitutionsSchema: z.ZodArray<z.ZodObject<{
    requested: z.ZodString;
    used: z.ZodString;
    texts: z.ZodNumber;
}, z.core.$strip>>;
export type FontSubstitutions = z.infer<typeof FontSubstitutionsSchema>;
export declare const HubInboundSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodEnum<{
        REGISTER_CLIENT: "REGISTER_CLIENT";
        REGISTER: "REGISTER";
    }>;
    clientType: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    client: z.ZodOptional<z.ZodString>;
    pairingCode: z.ZodOptional<z.ZodString>;
    protocol: z.ZodOptional<z.ZodNumber>;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"GET_STATUS">;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"PING">;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"GET_VIEWS_CATALOG">;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"REQUEST_VIEW_RENDER">;
    payload: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"RENDER_NODES">;
    payload: z.ZodUnknown;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"RENDER_CHUNK">;
    transferId: z.ZodString;
    index: z.ZodNumber;
    total: z.ZodNumber;
    data: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"RENDER_SUCCESS">;
    nodeId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    timings: z.ZodOptional<z.ZodObject<{
        fontsMs: z.ZodOptional<z.ZodNumber>;
        buildMs: z.ZodOptional<z.ZodNumber>;
        placeMs: z.ZodOptional<z.ZodNumber>;
        totalMs: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    fontSubstitutions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        requested: z.ZodString;
        used: z.ZodString;
        texts: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"RENDER_ERROR">;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"CLIENT_LOG">;
    source: z.ZodEnum<{
        plugin: "plugin";
        extension: "extension";
    }>;
    level: z.ZodEnum<{
        error: "error";
        info: "info";
        warn: "warn";
    }>;
    message: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"SCAN_FINISH">;
    scanId: z.ZodString;
    count: z.ZodNumber;
    source: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"GET_FIGMA_SELECTION">;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"FIGMA_SELECTION">;
    requestId: z.ZodOptional<z.ZodString>;
    selection: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, z.core.$loose>>>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$loose>], "type">;
export type HubInboundMessage = z.infer<typeof HubInboundSchema>;
export type HubInboundType = HubInboundMessage['type'];
/** Mensajes que ENVÍA el hub */
export type HubOutboundMessage = {
    type: 'AUTH_REQUIRED';
} | {
    type: 'AUTH_OK';
} | {
    type: 'AUTH_FAILED';
    reason: string;
} | {
    type: 'STATUS_RESPONSE';
    payload: {
        connected: boolean;
        figmaConnected: boolean;
        figmaCount: number;
        /** HUB_PROTOCOL de este hub (un hub anterior no lo envía) */
        protocol: number;
        /** El más alto entre los plugins conectados (1 = anterior a que existiera; 0 = ninguno) */
        pluginProtocol: number;
    };
} | {
    type: 'VIEWS_CATALOG';
    payload: {
        views: unknown[];
    };
} | {
    type: 'EXTRACT_PROGRESS';
    payload: {
        status: string;
        viewId: string;
        message: string;
    };
} | {
    type: 'RENDER_NODES';
    payload: WSRenderPayload;
} | {
    type: 'RENDER_PROGRESS';
    payload: {
        transferId: string;
        received: number;
        total: number;
        bytes: number;
    };
} | {
    type: 'SCAN_FINISH';
    scanId: string;
    count: number;
    source?: {
        url?: string;
        title?: string;
    };
} | {
    type: 'RENDER_SUCCESS';
    nodeId?: string;
    name?: string;
    durationMs?: number;
    timings?: RenderTimings;
    fontSubstitutions?: FontSubstitutions;
    /** QA de diseño: resumen de la comparación */
    qa?: Record<string, unknown>;
} | {
    type: 'RENDER_ERROR';
    error: string;
} | {
    type: 'GET_FIGMA_SELECTION';
    requestId: string;
} | {
    type: 'FIGMA_SELECTION';
    requestId?: string;
    selection?: FigmaSelection | null;
    error?: string;
};
/** Frame de Figma seleccionado (QA de diseño) */
export interface FigmaSelection {
    id: string;
    name: string;
    type: string;
    width: number;
    height: number;
}
export type PluginUiMessage = {
    type: 'RENDER_NODES';
    payload: unknown;
} | {
    type: 'CLEAR_PAGE';
} | {
    type: 'DELETE_NODE';
    nodeId: string;
} | {
    type: 'DELETE_MULTIPLE_NODES';
    nodeIds: string[];
} | {
    type: 'CONVERT_TO_COMPONENT';
    nodeId: string;
} | {
    type: 'FOCUS_NODE';
    nodeId: string;
} | {
    type: 'ZOOM_ALL';
} | {
    type: 'GET_PAGE_INFO';
} | {
    type: 'GET_SELECTION';
    requestId?: string;
} | {
    type: 'GET_PAIRING_CODE';
} | {
    type: 'SET_PAIRING_CODE';
    code: string;
} | {
    type: 'GET_SETTINGS';
} | {
    type: 'GET_HISTORY';
} | {
    type: 'SCAN_FINISH';
    scanId: string;
    board: boolean;
    source?: {
        url?: string;
        title?: string;
    };
} | {
    type: 'SET_HISTORY';
    items: unknown[];
} | {
    type: 'SET_SETTINGS';
    settings: Record<string, unknown>;
} | {
    type: 'GET_AVAILABLE_FONTS';
} | {
    type: 'REPLACE_FONTS';
    mapping: Record<string, string>;
    targetNodeId?: string;
};
export type PluginUiMessageType = PluginUiMessage['type'];
/** Plugin: sandbox → UI */
export type PluginSandboxMessage = {
    type: 'PAGE_INFO';
    pageName: string;
} | {
    type: 'PAIRING_CODE';
    code: string;
} | {
    type: 'SETTINGS';
    settings: Record<string, unknown>;
} | {
    type: 'HISTORY';
    items: unknown[];
} | {
    type: 'DELETED';
    nodeIds: string[];
    missing: number;
} | {
    type: 'LOG';
    message: string;
    level?: 'info' | 'warn' | 'error' | 'success';
} | {
    type: 'RENDER_PROGRESS';
    rendered: number;
    total: number;
    percent: number;
    phase?: string;
} | {
    type: 'AVAILABLE_FONTS';
    fonts: Array<{
        family: string;
        style: string;
    }>;
} | {
    type: 'FONTS_REPLACED';
    count: number;
    details?: string;
} | {
    type: 'RENDER_SUCCESS';
    nodeId: string;
    name: string;
    [k: string]: unknown;
} | {
    type: 'RENDER_ERROR';
    error: string;
} | {
    type: 'SELECTION_INFO';
    requestId?: string;
    selection: FigmaSelection | null;
};
export {};
//# sourceMappingURL=messages.d.ts.map