import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';
import type { FigmaWsHub } from './ws-hub.js';
export interface RelayResult {
    /** ¿Había al menos un plugin de Figma conectado para recibirlo? */
    sent: boolean;
    /** Plugins conectados (en el hub propio o en el externo) */
    plugins: number;
    via: 'hub-propio' | 'hub-externo' | 'ninguno';
}
/** Envía RENDER_NODES a un hub ya en marcha y responde si había plugins de Figma conectados */
export declare function relayToExternalHub(url: string, message: WSMessage<WSRenderPayload>, timeoutMs?: number): Promise<RelayResult>;
/** Entrega por el hub propio si escucha; si no, por el hub externo */
export declare function sendToFigma(hub: FigmaWsHub, message: WSMessage<WSRenderPayload>, externalUrl: string): Promise<RelayResult>;
//# sourceMappingURL=figma-relay.d.ts.map