import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';
export declare class FigmaWsHub {
    private wss;
    private figmaSockets;
    private otherClients;
    start(port?: number): void;
    broadcastToFigma(message: WSMessage<WSRenderPayload>): boolean;
    broadcastToClients(message: any): void;
    getConnectedPluginsCount(): number;
}
//# sourceMappingURL=ws-hub.d.ts.map