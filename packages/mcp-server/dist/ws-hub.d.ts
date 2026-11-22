import { type HubOutboundMessage, type Logger, type WSMessage, type WSRenderPayload } from '@code-to-figma/contracts';
export interface FigmaWsHubOptions {
    /** El servidor MCP pasa un logger a stderr: su stdout es el protocolo JSON-RPC */
    logger?: Logger;
}
export declare class FigmaWsHub {
    private wss;
    private figmaSockets;
    private otherClients;
    private pairing;
    private pairingLimiter;
    private pluginGeminiApiKey;
    private pluginGeminiModel;
    private pluginAiOptimization;
    private log;
    constructor(options?: FigmaWsHubOptions);
    private getCatalog;
    private send;
    start(port?: number): void;
    private onConnection;
    private handlers;
    private sendStatus;
    private onRegister;
    /**
     * Renderizar una vista del catálogo. Antes los datos del mensaje se interpolaban en un
     * comando de shell (inyección de comandos) y en rutas de archivo (path traversal).
     * Ahora: solo ids del catálogo, rutas de URL simples y execFile SIN shell.
     */
    private handleViewRender;
    private saveDebugCapture;
    broadcastToFigma(message: WSMessage<WSRenderPayload>): boolean;
    /** Eventos para los plugins de Figma (progreso de envíos por partes) */
    private broadcastToPlugins;
    /** Solo a clientes autenticados (únicos que llegan a otherClients) */
    broadcastToClients(message: HubOutboundMessage): void;
    getConnectedPluginsCount(): number;
    /** ¿Escuchando? (false si el puerto estaba ocupado) */
    isListening(): boolean;
}
//# sourceMappingURL=ws-hub.d.ts.map