import { WebSocketServer, WebSocket } from 'ws';
const PORT = parseInt(process.env.WS_PORT || '8080', 10);
export class FigmaWsHub {
    wss = null;
    figmaSockets = new Set();
    otherClients = new Set();
    start(port = PORT) {
        this.wss = new WebSocketServer({ port });
        console.log(`\n======================================================`);
        console.log(`⚡ Figma WebSocket Hub en ejecución en ws://localhost:${port}`);
        console.log(`Esperando conexión del Plugin de Figma...`);
        console.log(`======================================================\n`);
        this.wss.on('connection', (ws) => {
            let isFigma = false;
            ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.type === 'REGISTER_CLIENT') {
                        if (msg.clientType === 'FIGMA_PLUGIN') {
                            isFigma = true;
                            this.figmaSockets.add(ws);
                            console.log(`[+] Plugin de Figma conectado con éxito. Total activos: ${this.figmaSockets.size}`);
                        }
                        else {
                            this.otherClients.add(ws);
                            console.log(`[+] Cliente externo conectado (${msg.clientType || 'CLI'}).`);
                        }
                    }
                    else if (msg.type === 'RENDER_NODES') {
                        console.log(`[->] Solicitud de RENDER recibida. Transmitiendo a ${this.figmaSockets.size} plugin(s) de Figma...`);
                        this.broadcastToFigma(msg);
                    }
                    else if (msg.type === 'RENDER_SUCCESS') {
                        console.log(`[✓] Render completado con éxito en Figma! (ID: ${msg.nodeId}, Nombre: ${msg.name})`);
                        // Retransmitir confirmación a TODOS los clientes CLI/MCP para que puedan continuar
                        this.broadcastToClients(msg);
                    }
                    else if (msg.type === 'RENDER_ERROR') {
                        console.error(`[✗] Error reportado por el Plugin de Figma:`, msg.error);
                        this.broadcastToClients(msg);
                    }
                }
                catch (err) {
                    console.error(`[!] Error procesando mensaje WebSocket:`, err.message);
                }
            });
            ws.on('close', () => {
                if (isFigma) {
                    this.figmaSockets.delete(ws);
                    console.log(`[-] Plugin de Figma desconectado. Restantes: ${this.figmaSockets.size}`);
                }
                else {
                    this.otherClients.delete(ws);
                }
            });
            ws.on('error', (err) => {
                console.error(`[!] Error en socket:`, err.message);
            });
        });
    }
    broadcastToFigma(message) {
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
    broadcastToClients(message) {
        const payload = JSON.stringify(message);
        for (const socket of this.otherClients) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(payload);
            }
        }
    }
    getConnectedPluginsCount() {
        return this.figmaSockets.size;
    }
}
// Si se ejecuta directamente desde terminal:
const isDirectRun = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.includes('ws-hub');
if (isDirectRun) {
    const hub = new FigmaWsHub();
    hub.start();
}
//# sourceMappingURL=ws-hub.js.map