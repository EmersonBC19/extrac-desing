import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const PORT = parseInt(process.env.WS_PORT || '8080', 10);

export class FigmaWsHub {
  private wss: WebSocketServer | null = null;
  private figmaSockets: Set<WebSocket> = new Set();
  private otherClients: Set<WebSocket> = new Set();
  private lastRenderPayload: WSMessage<WSRenderPayload> | null = null;

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
    this.wss = new WebSocketServer({ port });

    console.log(`\n======================================================`);
    console.log(`⚡ Figma WebSocket Hub en ejecución en ws://localhost:${port}`);
    console.log(`Esperando conexión del Plugin de Figma...`);
    console.log(`======================================================\n`);

    this.wss.on('connection', (ws) => {
      let isFigma = false;

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as any;

          if (msg.type === 'REGISTER_CLIENT' || msg.type === 'REGISTER') {
            const isFigmaPlugin = msg.clientType === 'FIGMA_PLUGIN' || 
                                  msg.role === 'plugin' || 
                                  (typeof msg.client === 'string' && msg.client.toLowerCase().includes('figma'));
            if (isFigmaPlugin) {
              isFigma = true;
              this.figmaSockets.add(ws);
              console.log(`[+] Plugin de Figma conectado con éxito. Total activos: ${this.figmaSockets.size}`);
              
              // Enviar catálogo de vistas al plugin automáticamente
              const catalog = this.getCatalog();
              ws.send(JSON.stringify({
                type: 'VIEWS_CATALOG',
                payload: { views: catalog }
              }));

              if (this.lastRenderPayload) {
                console.log(`[->] Reenviando último diseño en caché al plugin de Figma recién conectado...`);
                ws.send(JSON.stringify(this.lastRenderPayload));
              }
            } else {
              this.otherClients.add(ws);
              console.log(`[+] Cliente externo conectado (${msg.clientType || msg.client || 'CLI'}).`);
            }
          } else if (msg.type === 'GET_VIEWS_CATALOG') {
            const catalog = this.getCatalog();
            ws.send(JSON.stringify({
              type: 'VIEWS_CATALOG',
              payload: { views: catalog }
            }));
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
            const { viewId, pageName, useSeparatePage } = msg.payload || {};
            console.log(`[->] Solicitud de renderizar vista: "${viewId}" (Página: ${pageName || 'Actual'})...`);
            
            const viewsDir = path.resolve(process.cwd(), 'scratch/views');
            const targetFile = path.join(viewsDir, `${viewId}.json`);
            const fallbackDash = path.resolve(process.cwd(), 'scratch/dashboard_tree.json');
            
            let fileToLoad = fs.existsSync(targetFile) ? targetFile : (viewId === 'dashboard' && fs.existsSync(fallbackDash) ? fallbackDash : null);

            if (fileToLoad) {
              const rootNode = JSON.parse(fs.readFileSync(fileToLoad, 'utf-8'));
              const renderMsg: WSMessage<WSRenderPayload> = {
                type: 'RENDER_NODES',
                payload: {
                  rootNode,
                  pageName: useSeparatePage ? pageName : undefined,
                  clearPage: false
                }
              };
              this.lastRenderPayload = renderMsg;
              this.broadcastToFigma(renderMsg);
            } else {
              // Si no está en caché, notificar progreso e intentar extraer
              console.log(`[!] La vista "${viewId}" no está en caché local. Iniciando extracción automática...`);
              ws.send(JSON.stringify({
                type: 'EXTRACT_PROGRESS',
                payload: { status: 'EXTRACTING', viewId, message: `Extrayendo vista ${viewId} del navegador...` }
              }));
              try {
                const { exec } = await import('child_process');
                const scriptPath = path.resolve(process.cwd(), 'scratch/extract-single-view.ts');
                const cmd = `npx tsx "${scriptPath}" "${viewId}" "${msg.payload?.route || '/administration/dashboard'}" "${msg.payload?.name || viewId}" "${useSeparatePage ? (pageName || viewId) : ''}"`;
                exec(cmd, (err, stdout, stderr) => {
                  if (err) {
                    console.error(`Error extrayendo vista:`, err.message);
                    ws.send(JSON.stringify({
                      type: 'RENDER_ERROR',
                      error: `Error al extraer vista ${viewId}: ${err.message}`
                    }));
                  } else {
                    console.log(`[✓] Vista ${viewId} extraída exitosamente.`);
                  }
                });
              } catch (extErr: any) {
                console.error(`Error extrayendo vista:`, extErr.message);
                ws.send(JSON.stringify({
                  type: 'RENDER_ERROR',
                  error: `Error al extraer vista ${viewId}: ${extErr.message}`
                }));
              }
            }
          } else if (msg.type === 'RENDER_NODES') {
            this.lastRenderPayload = msg as WSMessage<WSRenderPayload>;
            // Guardar el último payload para diagnóstico (scratch/captured-last-payload.json)
            try {
              const scratchDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scratch');
              fs.mkdirSync(scratchDir, { recursive: true });
              fs.writeFileSync(path.join(scratchDir, 'captured-last-payload.json'), JSON.stringify(msg.payload));
            } catch (_saveErr) {}
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
        if (isFigma) {
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
