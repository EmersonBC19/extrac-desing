import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';
export declare class FigmaWsHub {
    private wss;
    private figmaSockets;
    private otherClients;
    private lastRenderPayload;
    private pairing;
    private pairingLimiter;
    private getCatalog;
    start(port?: number): void;
    /**
     * Renderizar una vista del catálogo. Antes los datos del mensaje se interpolaban en un
     * comando de shell (inyección de comandos) y en rutas de archivo (path traversal).
     * Ahora: solo ids del catálogo, rutas de URL simples y execFile SIN shell.
     */
    private handleViewRender;
    private saveDebugCapture;
    broadcastToFigma(message: WSMessage<WSRenderPayload>): boolean;
    /** Solo a clientes autenticados (únicos que llegan a otherClients) */
    broadcastToClients(message: any): void;
    getConnectedPluginsCount(): number;
}
//# sourceMappingURL=ws-hub.d.ts.map