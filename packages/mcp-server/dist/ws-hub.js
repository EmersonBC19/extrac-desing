import { WebSocketServer, WebSocket } from 'ws';
import { consoleSink, createLogger, HUB_PROTOCOL, HubInboundSchema, parseLogLevel, validateRenderPayload, } from '@code-to-figma/contracts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { createRequire } from 'module';
import { rotatingFileSink } from './log-file.js';
import { ChunkAssembler } from './chunk-assembler.js';
import { fileURLToPath } from 'url';
import { classifyOrigin, loadOrCreatePairingCode, pairingCodeMatches, PairingRateLimiter, validateViewRenderRequest, } from './hub-security.js';
import { optimizePayloadWithGemini } from './ai-optimizer.js';
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
    // Siempre a ~/.code-to-figma/hub.log (también en desarrollo): lo que pasa en Figma y en la
    // extensión llega aquí con CLIENT_LOG y se puede revisar después. En las pruebas, solo si se pide.
    const defaultLogFile = process.env.VITEST
        ? undefined
        : path.join(process.env.CTF_PAIRING_DIR || path.join(os.homedir(), '.code-to-figma'), 'hub.log');
    const logFile = process.env.CTF_LOG_FILE || defaultLogFile;
    if (logFile) {
        try {
            fs.mkdirSync(path.dirname(logFile), { recursive: true });
            sinks.push(rotatingFileSink(logFile));
        }
        catch (_e) { }
    }
    return createLogger('hub', { sinks, level: parseLogLevel(process.env.CTF_LOG_LEVEL) });
}
export class FigmaWsHub {
    wss = null;
    figmaSockets = new Set();
    /** HUB_PROTOCOL que anunció cada plugin al registrarse (1 si no lo anunció: versión anterior) */
    pluginProtocols = new Map();
    otherClients = new Set();
    /** Consultas al plugin en curso (selección del QA, rutas del escaneo): requestId → quién preguntó */
    pendingQueries = new Map();
    pairing = loadOrCreatePairingCode();
    pairingLimiter = new PairingRateLimiter();
    pluginGeminiApiKey = null;
    pluginGeminiModel = 'gemini-2.5-flash';
    pluginAiOptimization = false;
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
                if (process.env.CTF_STANDALONE === '1') {
                    process.exit(0); // Instancia única: en modo instalado sale en silencio sin error
                }
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
                this.pluginProtocols.delete(ws);
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
        RENDER_NODES: async (ws, _state, msg) => {
            // Validación en tiempo de ejecución: nada malformado ni desmesurado llega a Figma
            const check = validateRenderPayload(msg.payload);
            if (!check.ok) {
                this.log.warn('RENDER_NODES rechazado', { error: check.error });
                this.send(ws, { type: 'RENDER_ERROR', error: `Payload inválido: ${check.error}` });
                return;
            }
            let finalPayload = msg.payload;
            // Optimización semántica opcional con Gemini Flash si hay API Key disponible
            const geminiKey = msg.payload?.geminiApiKey || this.pluginGeminiApiKey || process.env.GEMINI_API_KEY;
            // QA y variantes miden los árboles tal como salieron del navegador: no se reescriben con IA
            const measured = Boolean(msg.payload?.compare || msg.payload?.responsive);
            const shouldOptimize = !measured &&
                (msg.payload?.optimizeWithAi === true ||
                    (msg.payload?.optimizeWithAi !== false && this.pluginAiOptimization === true && Boolean(geminiKey)));
            const geminiModel = msg.payload?.geminiModel || this.pluginGeminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            if (geminiKey && shouldOptimize) {
                this.log.info(`Iniciando optimización con Gemini Flash (${geminiModel})...`);
                try {
                    const optRes = await optimizePayloadWithGemini(finalPayload, geminiKey, { model: geminiModel });
                    // Lo que devuelve el modelo es entrada externa: pasa por la misma validación que el original
                    // (estructura, tamaños, SVG sin scripts). Si no la supera, se dibuja el árbol original.
                    const optCheck = optRes.optimized ? validateRenderPayload(optRes.payload) : null;
                    if (optRes.optimized && optCheck && !optCheck.ok) {
                        this.log.warn('Árbol de Gemini descartado: no supera la validación', { error: optCheck.error });
                    }
                    else if (optRes.optimized) {
                        finalPayload = optRes.payload;
                        this.log.info('Árbol optimizado con IA (Gemini Flash)', { ms: optRes.durationMs });
                    }
                    else if (optRes.reason) {
                        this.log.warn('AI Optimizer omitido / fallback', { reason: optRes.reason });
                    }
                }
                catch (_optErr) {
                    this.log.warn('Fallo en AI Optimizer, usando payload original', { error: _optErr?.message });
                }
            }
            else {
                this.log.info(`Render normal (${!geminiKey ? 'sin GEMINI_API_KEY' : 'optimización de IA desactivada'})`);
            }
            // La clave y las opciones de IA son para el hub: nunca se reenvían a Figma ni se guardan en disco
            if (finalPayload && typeof finalPayload === 'object') {
                const { geminiApiKey: _k, geminiModel: _m, optimizeWithAi: _o, ...rest } = finalPayload;
                finalPayload = rest;
            }
            const renderMsg = { ...msg, payload: finalPayload };
            if (DEBUG_CAPTURE)
                this.saveDebugCapture(finalPayload);
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
            // Diagnóstico de textos del plugin: en el log y en un archivo local para depurar lo que solo
            // ocurre en Figma real (~/.code-to-figma/last-render-report.json, se sobrescribe en cada render)
            const textReport = msg.textReport;
            if (textReport && typeof textReport === 'object') {
                this.log.info('Diagnóstico de textos', {
                    creados: textReport.created,
                    esperados: textReport.expected,
                    sinPintar: Array.isArray(textReport.samples)
                        ? textReport.samples.filter((s) => s && s.painted === 'NO').length
                        : undefined,
                });
                try {
                    const dir = process.env.CTF_PAIRING_DIR || path.join(os.homedir(), '.code-to-figma');
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(path.join(dir, 'last-render-report.json'), JSON.stringify({ time: new Date().toISOString(), name: msg.name, fontSubstitutions: msg.fontSubstitutions, textReport }, null, 2));
                }
                catch (_e) { }
            }
            // QA de diseño: el resumen de la comparación vuelve a la extensión
            const qa = msg.qa;
            this.broadcastToClients({
                type: 'RENDER_SUCCESS',
                nodeId: msg.nodeId,
                name: msg.name,
                durationMs: msg.durationMs,
                timings: msg.timings,
                fontSubstitutions: msg.fontSubstitutions,
                ...(qa && typeof qa === 'object' ? { qa } : {}),
            });
        },
        RENDER_ERROR: (_ws, _state, msg) => {
            this.log.error('Error reportado por el plugin de Figma', { error: msg.error });
            this.broadcastToClients({ type: 'RENDER_ERROR', error: String(msg.error || 'Error desconocido') });
        },
        // Fin del escaneo del sitio: el plugin arma el tablero con todas las rutas recibidas
        CLIENT_LOG: (_ws, state, msg) => {
            // Tope por conexión: un cliente con un error en bucle no llena el disco
            const now = Date.now();
            const rl = (state.clientLogWindow ||= { start: now, count: 0 });
            if (now - rl.start > 60_000) {
                rl.start = now;
                rl.count = 0;
            }
            if (++rl.count > 120)
                return;
            const text = `[${msg.source}] ${msg.message}`;
            const data = msg.context ? { context: msg.context } : undefined;
            if (msg.level === 'error')
                this.log.error(text, data);
            else if (msg.level === 'warn')
                this.log.warn(text, data);
            else
                this.log.info(text, data);
        },
        SCAN_FINISH: (_ws, _state, msg) => {
            this.log.info(`Escaneo del sitio terminado (${msg.count} rutas)`, { scanId: msg.scanId });
            this.broadcastToPlugins({ type: 'SCAN_FINISH', scanId: msg.scanId, count: msg.count, source: msg.source });
        },
        // QA de diseño: la extensión pregunta qué frame está seleccionado en Figma (para capturar la web
        // al mismo ancho). Se reenvía a los plugins y la primera respuesta vuelve a quien preguntó.
        GET_FIGMA_SELECTION: (ws, _state, msg) => {
            this.askPlugins(ws, { type: 'GET_FIGMA_SELECTION' }, msg.requestId, 'FIGMA_SELECTION', 2, 6000);
        },
        FIGMA_SELECTION: (_ws, state, msg) => {
            this.answerQuery(state, msg.requestId, 'FIGMA_SELECTION', {
                selection: msg.selection ?? null,
                ...(msg.error ? { error: msg.error } : {}),
            });
        },
        // Escaneo del sitio: qué rutas de ese sitio ya están en el archivo de Figma. Recorrer el archivo
        // puede tardar (el plugin carga sus páginas), de ahí el tiempo más largo
        GET_FIGMA_ROUTES: (ws, _state, msg) => {
            this.askPlugins(ws, { type: 'GET_FIGMA_ROUTES', origin: msg.origin }, msg.requestId, 'FIGMA_ROUTES', 3, 9000);
        },
        FIGMA_ROUTES: (_ws, state, msg) => {
            this.answerQuery(state, msg.requestId, 'FIGMA_ROUTES', {
                routes: msg.routes || [],
                ...(msg.error ? { error: msg.error } : {}),
            });
        },
    };
    /**
     * Reenvía una consulta a los plugins; la primera respuesta vuelve a quien preguntó (answerQuery).
     * Sin plugin, o con uno anterior a `minProtocol` (la ignoraría y la extensión esperaría en vano),
     * se responde en el acto con el motivo.
     */
    askPlugins(ws, query, id, reply, minProtocol, timeoutMs) {
        const requestId = id || Math.random().toString(36).slice(2, 12);
        if (this.figmaSockets.size === 0) {
            this.send(ws, { type: reply, requestId, error: 'El plugin de Figma no está abierto' });
            return;
        }
        if (this.pluginProtocol() < minProtocol) {
            this.send(ws, {
                type: reply,
                requestId,
                error: 'El plugin de Figma es de una versión anterior: ciérralo y vuelve a abrirlo en Figma',
            });
            return;
        }
        const timer = setTimeout(() => {
            if (!this.pendingQueries.has(requestId))
                return;
            this.pendingQueries.delete(requestId);
            this.send(ws, { type: reply, requestId, error: 'Figma no respondió a tiempo' });
        }, timeoutMs);
        this.pendingQueries.set(requestId, { ws, reply, timer });
        this.broadcastToPlugins({ ...query, requestId });
    }
    /** Respuesta de un plugin a askPlugins: solo los plugins responden, y solo a lo que se preguntó */
    answerQuery(state, requestId, reply, body) {
        if (!state.isFigma || !requestId)
            return;
        const pending = this.pendingQueries.get(requestId);
        if (!pending || pending.reply !== reply)
            return;
        clearTimeout(pending.timer);
        this.pendingQueries.delete(requestId);
        this.send(pending.ws, { type: reply, requestId, ...body });
    }
    sendStatus(ws) {
        this.send(ws, {
            type: 'STATUS_RESPONSE',
            payload: {
                connected: true,
                figmaConnected: this.figmaSockets.size > 0,
                figmaCount: this.figmaSockets.size,
                protocol: HUB_PROTOCOL,
                pluginProtocol: this.pluginProtocol(),
            },
        });
    }
    /** La versión más alta entre los plugins conectados (0 si no hay ninguno) */
    pluginProtocol() {
        let best = 0;
        for (const ws of this.figmaSockets)
            best = Math.max(best, this.pluginProtocols.get(ws) ?? 1);
        return best;
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
            const protocol = msg.protocol;
            this.pluginProtocols.set(ws, typeof protocol === 'number' && protocol >= 1 ? protocol : 1);
            if (typeof msg.geminiApiKey === 'string') {
                const k = msg.geminiApiKey.trim();
                this.pluginGeminiApiKey = k.length > 0 ? k : null;
            }
            else if (msg.geminiApiKey === null || msg.geminiApiKey === '') {
                this.pluginGeminiApiKey = null;
            }
            if (typeof msg.geminiModel === 'string') {
                const m = msg.geminiModel.trim();
                if (m)
                    this.pluginGeminiModel = m;
            }
            if (typeof msg.aiOptimization === 'boolean') {
                this.pluginAiOptimization = msg.aiOptimization;
            }
            else {
                this.pluginAiOptimization = false;
            }
            this.log.info(`Plugin de Figma conectado. Total activos: ${this.figmaSockets.size}`, {
                hasGeminiKey: Boolean(this.pluginGeminiApiKey),
                aiOptimization: this.pluginAiOptimization,
            });
            // Enviar catálogo de vistas al plugin automáticamente
            this.send(ws, { type: 'VIEWS_CATALOG', payload: { views: this.getCatalog() } });
            // QA-11: no se reenvía el último render. Antes, abrir el plugin (o reconectar) volvía a
            // dibujar lo último enviado; un render solo se dibuja cuando alguien lo envía.
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
        if (process.env.CTF_STANDALONE === '1') {
            this.log.warn('REQUEST_VIEW_RENDER rechazado: no disponible en modo hub instalado');
            this.send(ws, { type: 'RENDER_ERROR', error: 'Función de desarrollo no disponible en el hub instalado' });
            return;
        }
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
// Si se ejecuta directamente desde terminal o como binario instalado:
const isDirectRun = process.env.CTF_STANDALONE === '1' ||
    (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
    (typeof import.meta !== 'undefined' &&
        typeof import.meta.url === 'string' &&
        import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) ||
    process.argv[1]?.includes('ws-hub') ||
    process.argv[1]?.includes('code-to-figma-hub');
if (isDirectRun) {
    const hub = new FigmaWsHub();
    hub.start();
}
//# sourceMappingURL=ws-hub.js.map