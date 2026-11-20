import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';
import { validateRenderPayload, WSMessageEnvelopeSchema } from '@code-to-figma/contracts';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
  classifyOrigin,
  loadOrCreatePairingCode,
  pairingCodeMatches,
  PairingRateLimiter,
  validateViewRenderRequest,
  type OriginClass,
} from './hub-security.js';

const PORT = parseInt(process.env.WS_PORT || '8080', 10);
/** Solo escuchar en la propia máquina (antes: todas las interfaces de red) */
const HOST = process.env.WS_HOST || '127.0.0.1';
/** IDs de extensión permitidos (opcional, separados por coma). Vacío = cualquier extensión local */
const ALLOWED_EXTENSION_IDS = (process.env.CTF_EXTENSION_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
/** Guardar el último RENDER_NODES en disco solo si se pide explícitamente (puede contener datos privados) */
const DEBUG_CAPTURE = process.env.CTF_DEBUG_CAPTURE === '1';
/** Tope de tamaño por mensaje (payloads con imágenes base64) */
const MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;
/** Tiempo para vincularse antes de cerrar la conexión */
const PAIRING_TIMEOUT_MS = 10_000;

interface ClientState {
  originClass: OriginClass;
  authenticated: boolean;
  isFigma: boolean;
}

export class FigmaWsHub {
  private wss: WebSocketServer | null = null;
  private figmaSockets: Set<WebSocket> = new Set();
  private otherClients: Set<WebSocket> = new Set();
  private lastRenderPayload: WSMessage<WSRenderPayload> | null = null;
  private pairing = loadOrCreatePairingCode();
  private pairingLimiter = new PairingRateLimiter();

  private getCatalog(): any[] {
    try {
      const catalogPath = path.resolve(process.cwd(), 'scratch/views/views-catalog.json');
      if (fs.existsSync(catalogPath)) {
        const list = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        const viewsDir = path.resolve(process.cwd(), 'scratch/views');
        return list.map((item: any) => {
          const cached = fs.existsSync(path.join(viewsDir, `${item.id}.json`)) ||
                         (item.id === 'dashboard' && fs.existsSync(path.resolve(process.cwd(), 'scratch/dashboard_tree.json')));
          return { ...item, isReady: !!cached };
        });
      }
    } catch (_e) {}
    return [];
  }

  start(port: number = PORT): void {
    this.wss = new WebSocketServer({
      port,
      host: HOST,
      maxPayload: MAX_PAYLOAD_BYTES,
      // Rechazar en el handshake a cualquier página web (el navegador no deja falsificar Origin)
      verifyClient: (info: { origin: string; req: IncomingMessage }, done: (ok: boolean, code?: number, msg?: string) => void) => {
        const cls = classifyOrigin(info.origin || undefined, ALLOWED_EXTENSION_IDS);
        if (cls === 'rejected') {
          console.warn(`[✗] Conexión rechazada desde origen no permitido: ${info.origin}`);
          return done(false, 403, 'Origen no permitido');
        }
        (info.req as any).__ctfOrigin = cls;
        done(true);
      },
    });

    console.log(`\n======================================================`);
    console.log(`⚡ Figma WebSocket Hub en ws://${HOST}:${port}`);
    console.log(`🔑 Código de vinculación para el plugin de Figma: ${this.pairing.code}`);
    console.log(`   (se pide una sola vez; guardado en ${this.pairing.file})`);
    if (DEBUG_CAPTURE) console.log(`🐞 CTF_DEBUG_CAPTURE=1: se guardará el último render en scratch/captured-last-payload.json`);
    console.log(`Esperando conexión del Plugin de Figma...`);
    console.log(`======================================================\n`);

    this.wss.on('connection', (ws, req) => {
      const originClass: OriginClass = (req as any).__ctfOrigin || 'needs-pairing';
      const state: ClientState = {
        originClass,
        authenticated: originClass !== 'needs-pairing',
        isFigma: false,
      };

      // Clientes con origen "null" (plugin de Figma) deben vincularse a tiempo
      let pairingTimer: NodeJS.Timeout | null = null;
      if (!state.authenticated) {
        ws.send(JSON.stringify({ type: 'AUTH_REQUIRED' }));
        pairingTimer = setTimeout(() => {
          if (!state.authenticated) ws.close(4401, 'Vinculación requerida');
        }, PAIRING_TIMEOUT_MS);
      }

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as any;
          if (!WSMessageEnvelopeSchema.safeParse(msg).success) return;

          if (msg.type === 'REGISTER_CLIENT' || msg.type === 'REGISTER') {
            if (!state.authenticated) {
              if (this.pairingLimiter.isLocked()) {
                ws.send(JSON.stringify({ type: 'AUTH_FAILED', reason: 'Demasiados intentos. Espera un minuto.' }));
                return ws.close(4429, 'Demasiados intentos');
              }
              if (!pairingCodeMatches(this.pairing.code, msg.pairingCode)) {
                this.pairingLimiter.recordFailure();
                console.warn(`[✗] Código de vinculación incorrecto (origen ${state.originClass}).`);
                ws.send(JSON.stringify({ type: 'AUTH_FAILED', reason: 'Código de vinculación incorrecto' }));
                return ws.close(4401, 'Código incorrecto');
              }
              state.authenticated = true;
              if (pairingTimer) clearTimeout(pairingTimer);
              ws.send(JSON.stringify({ type: 'AUTH_OK' }));
            }

            const isFigmaPlugin = msg.clientType === 'FIGMA_PLUGIN' ||
                                  msg.role === 'plugin' ||
                                  (typeof msg.client === 'string' && msg.client.toLowerCase().includes('figma'));
            if (isFigmaPlugin) {
              state.isFigma = true;
              this.figmaSockets.add(ws);
              console.log(`[+] Plugin de Figma conectado con éxito. Total activos: ${this.figmaSockets.size}`);

              // Enviar catálogo de vistas al plugin automáticamente
              ws.send(JSON.stringify({ type: 'VIEWS_CATALOG', payload: { views: this.getCatalog() } }));

              if (this.lastRenderPayload) {
                console.log(`[->] Reenviando último diseño en caché al plugin de Figma recién conectado...`);
                ws.send(JSON.stringify(this.lastRenderPayload));
              }
            } else {
              this.otherClients.add(ws);
              console.log(`[+] Cliente externo conectado (${msg.clientType || msg.client || 'CLI'}).`);
            }
            return;
          }

          // Nada más se atiende hasta que el cliente esté autenticado
          if (!state.authenticated) return;

          if (msg.type === 'GET_VIEWS_CATALOG') {
            ws.send(JSON.stringify({ type: 'VIEWS_CATALOG', payload: { views: this.getCatalog() } }));
          } else if (msg.type === 'GET_STATUS' || msg.type === 'PING') {
            ws.send(JSON.stringify({
              type: 'STATUS_RESPONSE',
              payload: {
                connected: true,
                figmaConnected: this.figmaSockets.size > 0,
                figmaCount: this.figmaSockets.size
              }
            }));
          } else if (msg.type === 'REQUEST_VIEW_RENDER') {
            this.handleViewRender(ws, msg);
          } else if (msg.type === 'RENDER_NODES') {
            // Validación en tiempo de ejecución: nada malformado ni desmesurado llega a Figma
            const check = validateRenderPayload(msg.payload);
            if (!check.ok) {
              console.warn(`[✗] RENDER_NODES rechazado: ${check.error}`);
              ws.send(JSON.stringify({ type: 'RENDER_ERROR', error: `Payload inválido: ${check.error}` }));
              return;
            }
            this.lastRenderPayload = msg as WSMessage<WSRenderPayload>;
            if (DEBUG_CAPTURE) this.saveDebugCapture(msg.payload);
            console.log(`[->] Solicitud de RENDER recibida. Transmitiendo a ${this.figmaSockets.size} plugin(s) de Figma...`);
            this.broadcastToFigma(msg as WSMessage<WSRenderPayload>);
          } else if (msg.type === 'RENDER_SUCCESS') {
            console.log(`[✓] Render completado con éxito en Figma! (ID: ${(msg as any).nodeId}, Nombre: ${(msg as any).name})`);
            this.broadcastToClients(msg);
          } else if (msg.type === 'RENDER_ERROR') {
            console.error(`[✗] Error reportado por el Plugin de Figma:`, msg.error);
            this.broadcastToClients(msg);
          }
        } catch (err: any) {
          console.error(`[!] Error procesando mensaje WebSocket:`, err.message);
        }
      });

      ws.on('close', () => {
        if (pairingTimer) clearTimeout(pairingTimer);
        if (state.isFigma) {
          this.figmaSockets.delete(ws);
          console.log(`[-] Plugin de Figma desconectado. Restantes: ${this.figmaSockets.size}`);
        } else {
          this.otherClients.delete(ws);
        }
      });

      ws.on('error', (err) => {
        console.error(`[!] Error en socket:`, err.message);
      });
    });
  }

  /**
   * Renderizar una vista del catálogo. Antes los datos del mensaje se interpolaban en un
   * comando de shell (inyección de comandos) y en rutas de archivo (path traversal).
   * Ahora: solo ids del catálogo, rutas de URL simples y execFile SIN shell.
   */
  private handleViewRender(ws: WebSocket, msg: any): void {
    const catalogIds = this.getCatalog().map((v: any) => String(v.id));
    const req = validateViewRenderRequest(msg.payload, catalogIds);
    if (typeof req === 'string') {
      console.warn(`[✗] REQUEST_VIEW_RENDER rechazado: ${req}`);
      ws.send(JSON.stringify({ type: 'RENDER_ERROR', error: req }));
      return;
    }
    const { viewId, route, name, pageName, useSeparatePage } = req;
    console.log(`[->] Solicitud de renderizar vista: "${viewId}" (Página: ${useSeparatePage ? pageName : 'Actual'})...`);

    const viewsDir = path.resolve(process.cwd(), 'scratch/views');
    const targetFile = path.join(viewsDir, `${viewId}.json`);
    const fallbackDash = path.resolve(process.cwd(), 'scratch/dashboard_tree.json');
    const fileToLoad = fs.existsSync(targetFile) ? targetFile : (viewId === 'dashboard' && fs.existsSync(fallbackDash) ? fallbackDash : null);

    if (fileToLoad) {
      const rootNode = JSON.parse(fs.readFileSync(fileToLoad, 'utf-8'));
      const renderMsg: WSMessage<WSRenderPayload> = {
        type: 'RENDER_NODES',
        payload: { rootNode, pageName: useSeparatePage ? pageName : undefined, clearPage: false }
      };
      this.lastRenderPayload = renderMsg;
      this.broadcastToFigma(renderMsg);
      return;
    }

    console.log(`[!] La vista "${viewId}" no está en caché local. Iniciando extracción automática...`);
    ws.send(JSON.stringify({
      type: 'EXTRACT_PROGRESS',
      payload: { status: 'EXTRACTING', viewId, message: `Extrayendo vista ${viewId} del navegador...` }
    }));
    const scriptPath = path.resolve(process.cwd(), 'scratch/extract-single-view.ts');
    let tsxCli: string;
    try {
      tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
    } catch (_e) {
      ws.send(JSON.stringify({ type: 'RENDER_ERROR', error: 'tsx no está instalado' }));
      return;
    }
    execFile(
      process.execPath,
      [tsxCli, scriptPath, viewId, route, name, useSeparatePage ? pageName : ''],
      { shell: false, timeout: 5 * 60_000 },
      (err) => {
        if (err) {
          console.error(`Error extrayendo vista:`, err.message);
          ws.send(JSON.stringify({ type: 'RENDER_ERROR', error: `Error al extraer vista ${viewId}: ${err.message}` }));
        } else {
          console.log(`[✓] Vista ${viewId} extraída exitosamente.`);
        }
      }
    );
  }

  private saveDebugCapture(payload: unknown): void {
    try {
      const scratchDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scratch');
      fs.mkdirSync(scratchDir, { recursive: true });
      fs.writeFileSync(path.join(scratchDir, 'captured-last-payload.json'), JSON.stringify(payload));
    } catch (_saveErr) {}
  }

  broadcastToFigma(message: WSMessage<WSRenderPayload>): boolean {
    if (this.figmaSockets.size === 0) {
      console.warn(`[!] Advertencia: No hay ningún plugin de Figma conectado en este momento.`);
      return false;
    }

    const payload = JSON.stringify(message);
    for (const socket of this.figmaSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
    return true;
  }

  /** Solo a clientes autenticados (únicos que llegan a otherClients) */
  broadcastToClients(message: any): void {
    const payload = JSON.stringify(message);
    for (const socket of this.otherClients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  getConnectedPluginsCount(): number {
    return this.figmaSockets.size;
  }
}

// Si se ejecuta directamente desde terminal:
const isDirectRun = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.includes('ws-hub');
if (isDirectRun) {
  const hub = new FigmaWsHub();
  hub.start();
}
