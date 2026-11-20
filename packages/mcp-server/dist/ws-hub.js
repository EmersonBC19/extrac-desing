import { WebSocketServer, WebSocket } from 'ws';
import { consoleSink, createLogger, HubInboundSchema, parseLogLevel, validateRenderPayload, } from '@code-to-figma/contracts';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { createRequire } from 'module';
import { rotatingFileSink } from './log-file.js';
import { ChunkAssembler } from './chunk-assembler.js';
import { fileURLToPath } from 'url';
import { classifyOrigin, loadOrCreatePairingCode, pairingCodeMatches, PairingRateLimiter, validateViewRenderRequest, } from './hub-security.js';
const PORT = parseInt(process.env.WS_PORT || '8080', 10);
/** Solo escuchar en la propia máquina (antes: todas las interfaces de red) */
const HOST = process.env.WS_HOST || '127.0.0.1';
/** IDs de extensión permitidos (opcional, separados por coma). Vacío = cualquier extensión local */
const ALLOWED_EXTENSION_IDS = (process.env.CTF_EXTENSION_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
/** Guardar el último RENDER_NODES en disco solo si se pide explícitamente (puede contener datos privados) */
const DEBUG_CAPTURE = process.env.CTF_DEBUG_CAPTURE === '1';
/** Tope de tamaño por mensaje (payloads con imágenes base64) */
const MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;
/** Tiempo para vincularse antes de cerrar la conexión */
const PAIRING_TIMEOUT_MS = 10_000;
function defaultLogger() {
    const sinks = [consoleSink()];
    if (process.env.CTF_LOG_FILE)
        sinks.push(rotatingFileSink(process.env.CTF_LOG_FILE));
    return createLogger('hub', { sinks, level: parseLogLevel(process.env.CTF_LOG_LEVEL) });
}
export class FigmaWsHub {
    wss = null;
    figmaSockets = new Set();
    otherClients = new Set();
    lastRenderPayload = null;
    pairing = loadOrCreatePairingCode();
    pairingLimiter = new PairingRateLimiter();
    log;
    constructor(options = {}) {
        this.log = options.logger || defaultLogger();
    }
    getCatalog() {
        try {
            const catalogPath = path.resolve(process.cwd(), 'scratch/views/views-catalog.json');
            if (fs.existsSync(catalogPath)) {
                const list = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
                const viewsDir = path.resolve(process.cwd(), 'scratch/views');
                return list.map((item) => {
                    const cached = fs.existsSync(path.join(viewsDir, `${item.id}.json`)) ||
                        (item.id === 'dashboard' && fs.existsSync(path.resolve(process.cwd(), 'scratch/dashboard_tree.json')));
                    return { ...item, isReady: !!cached };
                });
            }
        }
        catch (_e) { }
        return [];
    }
    send(ws, msg) {
        if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify(msg));
    }
    start(port = PORT) {
        this.wss = new WebSocketServer({
            port,
            host: HOST,
            maxPayload: MAX_PAYLOAD_BYTES,
            // Rechazar en el handshake a cualquier página web (el navegador no deja falsificar Origin)
            verifyClient: (info, done) => {
                const cls = classifyOrigin(info.origin || undefined, ALLOWED_EXTENSION_IDS);
                if (cls === 'rejected') {
                    this.log.warn('Conexión rechazada: origen no permitido', { origin: info.origin });
                    return done(false, 403, 'Origen no permitido');
                }
                info.req.__ctfOrigin = cls;
                done(true);
            },
        });
        // Puerto ocupado (p. ej. otro hub ya corriendo): avisar en lugar de tumbar el proceso.
        // Antes el error era asíncrono y el try/catch de quien llamaba no lo atrapaba.
        this.wss.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                this.log.warn(`El puerto ${port} ya está en uso (¿otro hub corriendo?). Este hub no escuchará.`);
            }
            else {
                this.log.error('Error del servidor WebSocket', { error: err.message });
            }
            this.wss = null;
        });
        this.wss.on('listening', () => {
            this.log.info(`⚡ Figma WebSocket Hub en ws://${HOST}:${port}`);
            this.log.info(`🔑 Código de vinculación para el plugin de Figma: ${this.pairing.code}`, {
                archivo: this.pairing.file,
            });
            if (DEBUG_CAPTURE)
                this.log.info('🐞 CTF_DEBUG_CAPTURE=1: se guardará el último render en scratch/captured-last-payload.json');
            this.log.info('Esperando conexión del Plugin de Figma...');
        });
        this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    }
    onConnection(ws, req) {
        const originClass = req.__ctfOrigin || 'needs-pairing';
        const state = {
            originClass,
            authenticated: originClass !== 'needs-pairing',
            isFigma: false,
            pairingTimer: null,
            chunks: new ChunkAssembler({ maxBytes: MAX_PAYLOAD_BYTES, maxTransfers: 2, ttlMs: 60_000 }),
        };
        // Clientes con origen "null" (plugin de Figma) deben vincularse a tiempo
        if (!state.authenticated) {
            this.send(ws, { type: 'AUTH_REQUIRED' });
            state.pairingTimer = setTimeout(() => {
                if (!state.authenticated)
                    ws.close(4401, 'Vinculación requerida');
            }, PAIRING_TIMEOUT_MS);
        }
        ws.on('message', raw => {
            try {
                const parsed = HubInboundSchema.safeParse(JSON.parse(raw.toString()));
                if (!parsed.success) {
                    this.log.debug('Mensaje ignorado: tipo desconocido o forma inválida');
                    return;
                }
                const msg = parsed.data;
                const isRegister = msg.type === 'REGISTER_CLIENT' || msg.type === 'REGISTER';
                // Nada más que el registro se atiende hasta que el cliente esté autenticado
                if (!state.authenticated && !isRegister)
                    return;
                this.handlers[msg.type](ws, state, msg);
            }
            catch (err) {
                this.log.error('Error procesando mensaje WebSocket', { error: err.message });
            }
        });
        ws.on('close', () => {
            if (state.pairingTimer)
                clearTimeout(state.pairingTimer);
            state.chunks.clear();
            if (state.isFigma) {
                this.figmaSockets.delete(ws);
                this.log.info(`Plugin de Figma desconectado. Restantes: ${this.figmaSockets.size}`);
            }
            else {
                this.otherClients.delete(ws);
            }
        });
        ws.on('error', err => this.log.error('Error en socket', { error: err.message }));
    }
    // ── Manejadores (uno por tipo de mensaje entrante; ver MESSAGE_CATALOG en contracts) ──────
    handlers = {
        REGISTER_CLIENT: (ws, state, msg) => this.onRegister(ws, state, msg),
        REGISTER: (ws, state, msg) => this.onRegister(ws, state, msg),
        GET_STATUS: ws => this.sendStatus(ws),
        PING: ws => this.sendStatus(ws),
        GET_VIEWS_CATALOG: ws => this.send(ws, { type: 'VIEWS_CATALOG', payload: { views: this.getCatalog() } }),
        REQUEST_VIEW_RENDER: (ws, _state, msg) => this.handleViewRender(ws, msg),
        RENDER_NODES: (ws, _state, msg) => {
            // Validación en tiempo de ejecución: nada malformado ni desmesurado llega a Figma
            const check = validateRenderPayload(msg.payload);
            if (!check.ok) {
                this.log.warn('RENDER_NODES rechazado', { error: check.error });
                this.send(ws, { type: 'RENDER_ERROR', error: `Payload inválido: ${check.error}` });
                return;
            }
            const renderMsg = msg;
            this.lastRenderPayload = renderMsg;
            if (DEBUG_CAPTURE)
                this.saveDebugCapture(msg.payload);
            this.log.info(`Render recibido. Transmitiendo a ${this.figmaSockets.size} plugin(s) de Figma`, {
                nodos: check.nodeCount,
            });
            this.broadcastToFigma(renderMsg);
        },
        RENDER_CHUNK: (ws, state, msg) => {
            const res = state.chunks.accept(msg);
            if (res.status === 'error') {
                this.log.warn('Envío por partes rechazado', { error: res.error });
                this.send(ws, { type: 'RENDER_ERROR', error: res.error });
                return;
            }
            if (res.status === 'progress') {
                this.broadcastToPlugins({
                    type: 'RENDER_PROGRESS',
                    payload: { transferId: res.transferId, received: res.received, total: res.total, bytes: res.bytes },
                });
                return;
            }
            // Completo: el conjunto pasa por la misma validación que un RENDER_NODES de una sola pieza
            let assembled;
            try {
                assembled = JSON.parse(res.text);
            }
            catch (_e) {
                this.send(ws, { type: 'RENDER_ERROR', error: 'Envío por partes corrupto (JSON inválido)' });
                return;
            }
            const parsed = HubInboundSchema.safeParse(assembled);
            if (!parsed.success || parsed.data.type !== 'RENDER_NODES') {
                this.send(ws, { type: 'RENDER_ERROR', error: 'El envío por partes no contiene un RENDER_NODES' });
                return;
            }
            this.broadcastToPlugins({
                type: 'RENDER_PROGRESS',
                payload: { transferId: res.transferId, received: res.total, total: res.total, bytes: res.bytes },
            });
            this.log.info(`Render por partes recibido (${res.total} partes)`, { bytes: res.bytes });
            this.handlers.RENDER_NODES(ws, state, parsed.data);
        },
        RENDER_SUCCESS: (_ws, _state, msg) => {
            this.log.info('Render completado en Figma', {
                nodeId: msg.nodeId,
                name: msg.name,
                durationMs: msg.durationMs,
                ...(msg.timings ? { etapas: msg.timings } : {}),
            });
            this.broadcastToClients({
                type: 'RENDER_SUCCESS',
                nodeId: msg.nodeId,
                name: msg.name,
                durationMs: msg.durationMs,
                timings: msg.timings,
                fontSubstitutions: msg.fontSubstitutions,
            });
        },
        RENDER_ERROR: (_ws, _state, msg) => {
            this.log.error('Error reportado por el plugin de Figma', { error: msg.error });
            this.broadcastToClients({ type: 'RENDER_ERROR', error: String(msg.error || 'Error desconocido') });
        },
    };
    sendStatus(ws) {
        this.send(ws, {
            type: 'STATUS_RESPONSE',
            payload: { connected: true, figmaConnected: this.figmaSockets.size > 0, figmaCount: this.figmaSockets.size },
        });
    }
    onRegister(ws, state, msg) {
        if (!state.authenticated) {
            if (this.pairingLimiter.isLocked()) {
                this.send(ws, { type: 'AUTH_FAILED', reason: 'Demasiados intentos. Espera un minuto.' });
                ws.close(4429, 'Demasiados intentos');
                return;
            }
            if (!pairingCodeMatches(this.pairing.code, msg.pairingCode)) {
                this.pairingLimiter.recordFailure();
                this.log.warn('Código de vinculación incorrecto', { origen: state.originClass });
                this.send(ws, { type: 'AUTH_FAILED', reason: 'Código de vinculación incorrecto' });
                ws.close(4401, 'Código incorrecto');
                return;
            }
            state.authenticated = true;
            if (state.pairingTimer)
                clearTimeout(state.pairingTimer);
            this.send(ws, { type: 'AUTH_OK' });
        }
        const isFigmaPlugin = msg.clientType === 'FIGMA_PLUGIN' ||
            msg.role === 'plugin' ||
            (typeof msg.client === 'string' && msg.client.toLowerCase().includes('figma'));
        if (isFigmaPlugin) {
            state.isFigma = true;
            this.figmaSockets.add(ws);
            this.log.info(`Plugin de Figma conectado. Total activos: ${this.figmaSockets.size}`);
            // Enviar catálogo de vistas al plugin automáticamente
            this.send(ws, { type: 'VIEWS_CATALOG', payload: { views: this.getCatalog() } });
            if (this.lastRenderPayload) {
                this.log.info('Reenviando el último diseño al plugin recién conectado');
                if (ws.readyState === WebSocket.OPEN)
                    ws.send(JSON.stringify(this.lastRenderPayload));
            }
        }
        else {
            this.otherClients.add(ws);
            this.log.info('Cliente externo conectado', { cliente: msg.clientType || msg.client || 'CLI' });
        }
    }
    /**
     * Renderizar una vista del catálogo. Antes los datos del mensaje se interpolaban en un
     * comando de shell (inyección de comandos) y en rutas de archivo (path traversal).
     * Ahora: solo ids del catálogo, rutas de URL simples y execFile SIN shell.
     */
    handleViewRender(ws, msg) {
        const catalogIds = this.getCatalog().map((v) => String(v.id));
        const req = validateViewRenderRequest(msg.payload, catalogIds);
        if (typeof req === 'string') {
            this.log.warn('REQUEST_VIEW_RENDER rechazado', { motivo: req });
            this.send(ws, { type: 'RENDER_ERROR', error: req });
            return;
        }
        const { viewId, route, name, pageName, useSeparatePage } = req;
        this.log.info(`Renderizar vista "${viewId}"`, { pagina: useSeparatePage ? pageName : 'actual' });
        const viewsDir = path.resolve(process.cwd(), 'scratch/views');
        const targetFile = path.join(viewsDir, `${viewId}.json`);
        const fallbackDash = path.resolve(process.cwd(), 'scratch/dashboard_tree.json');
        const fileToLoad = fs.existsSync(targetFile)
            ? targetFile
            : viewId === 'dashboard' && fs.existsSync(fallbackDash)
                ? fallbackDash
                : null;
        if (fileToLoad) {
            const rootNode = JSON.parse(fs.readFileSync(fileToLoad, 'utf-8'));
            const renderMsg = {
                type: 'RENDER_NODES',
                payload: { rootNode, pageName: useSeparatePage ? pageName : undefined, clearPage: false },
            };
            this.lastRenderPayload = renderMsg;
            this.broadcastToFigma(renderMsg);
            return;
        }
        this.log.info(`La vista "${viewId}" no está en caché. Iniciando extracción automática`);
        this.send(ws, {
            type: 'EXTRACT_PROGRESS',
            payload: { status: 'EXTRACTING', viewId, message: `Extrayendo vista ${viewId} del navegador...` },
        });
        const scriptPath = path.resolve(process.cwd(), 'scratch/extract-single-view.ts');
        let tsxCli;
        try {
            tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
        }
        catch (_e) {
            this.send(ws, { type: 'RENDER_ERROR', error: 'tsx no está instalado' });
            return;
        }
        execFile(process.execPath, [tsxCli, scriptPath, viewId, route, name, useSeparatePage ? pageName : ''], { shell: false, timeout: 5 * 60_000 }, err => {
            if (err) {
                this.log.error('Error extrayendo vista', { viewId, error: err.message });
                this.send(ws, { type: 'RENDER_ERROR', error: `Error al extraer vista ${viewId}: ${err.message}` });
            }
            else {
                this.log.info(`Vista ${viewId} extraída`);
            }
        });
    }
    saveDebugCapture(payload) {
        try {
            const scratchDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scratch');
            fs.mkdirSync(scratchDir, { recursive: true });
            fs.writeFileSync(path.join(scratchDir, 'captured-last-payload.json'), JSON.stringify(payload));
        }
        catch (_saveErr) { }
    }
    broadcastToFigma(message) {
        if (this.figmaSockets.size === 0) {
            this.log.warn('No hay ningún plugin de Figma conectado en este momento');
            return false;
        }
        const payload = JSON.stringify(message);
        for (const socket of this.figmaSockets) {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(payload);
        }
        return true;
    }
    /** Eventos para los plugins de Figma (progreso de envíos por partes) */
    broadcastToPlugins(message) {
        const payload = JSON.stringify(message);
        for (const socket of this.figmaSockets) {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(payload);
        }
    }
    /** Solo a clientes autenticados (únicos que llegan a otherClients) */
    broadcastToClients(message) {
        const payload = JSON.stringify(message);
        for (const socket of this.otherClients) {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(payload);
        }
    }
    getConnectedPluginsCount() {
        return this.figmaSockets.size;
    }
    /** ¿Escuchando? (false si el puerto estaba ocupado) */
    isListening() {
        return this.wss !== null;
    }
}
// Si se ejecuta directamente desde terminal:
const isDirectRun = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.includes('ws-hub');
if (isDirectRun) {
    const hub = new FigmaWsHub();
    hub.start();
}
//# sourceMappingURL=ws-hub.js.map