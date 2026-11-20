/**
 * Entrega de renders a Figma desde el servidor MCP.
 *
 * El MCP arranca su propio hub, pero si el puerto ya está ocupado (el usuario tiene
 * `npm run start:hub` corriendo) ese hub no escucha y el plugin de Figma está conectado al otro.
 * En ese caso los renders se reenvían al hub existente como cliente local (sin header Origin:
 * el hub lo reconoce como proceso local de confianza).
 */
import WebSocket from 'ws';
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
export function relayToExternalHub(
  url: string,
  message: WSMessage<WSRenderPayload>,
  timeoutMs = 4000,
): Promise<RelayResult> {
  return new Promise(resolve => {
    let settled = false;
    const done = (r: RelayResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_e) {}
      resolve(r);
    };
    const ws = new WebSocket(url);
    const timer = setTimeout(() => done({ sent: false, plugins: 0, via: 'ninguno' }), timeoutMs);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP', client: 'code-to-figma-mcp' }));
      ws.send(JSON.stringify({ type: 'GET_STATUS' }));
    });
    ws.on('message', raw => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_e) {
        return;
      }
      if (msg.type !== 'STATUS_RESPONSE') return;
      const plugins = Number(msg.payload?.figmaCount) || 0;
      if (!msg.payload?.figmaConnected) return done({ sent: false, plugins, via: 'hub-externo' });
      ws.send(JSON.stringify(message), () => done({ sent: true, plugins, via: 'hub-externo' }));
    });
    ws.on('error', () => done({ sent: false, plugins: 0, via: 'ninguno' }));
  });
}

/** Entrega por el hub propio si escucha; si no, por el hub externo */
export async function sendToFigma(
  hub: FigmaWsHub,
  message: WSMessage<WSRenderPayload>,
  externalUrl: string,
): Promise<RelayResult> {
  if (hub.isListening()) {
    const sent = hub.broadcastToFigma(message);
    return { sent, plugins: hub.getConnectedPluginsCount(), via: 'hub-propio' };
  }
  return relayToExternalHub(externalUrl, message);
}
