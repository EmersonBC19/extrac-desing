/**
 * Entrega de renders a Figma desde el servidor MCP.
 *
 * El MCP arranca su propio hub, pero si el puerto ya está ocupado (el usuario tiene
 * `npm run start:hub` corriendo) ese hub no escucha y el plugin de Figma está conectado al otro.
 * En ese caso los renders se reenvían al hub existente como cliente local (sin header Origin:
 * el hub lo reconoce como proceso local de confianza).
 */
import WebSocket from 'ws';
/** Envía RENDER_NODES a un hub ya en marcha y responde si había plugins de Figma conectados */
export function relayToExternalHub(url, message, timeoutMs = 4000) {
    return new Promise(resolve => {
        let settled = false;
        let ackTimer = null;
        const done = (r) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (ackTimer)
                clearTimeout(ackTimer);
            try {
                ws.close();
            }
            catch (_e) { }
            resolve(r);
        };
        const ws = new WebSocket(url);
        const timer = setTimeout(() => done({ sent: false, plugins: 0, via: 'ninguno' }), timeoutMs);
        let sentPendingPlugins = null;
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP', client: 'code-to-figma-mcp' }));
            ws.send(JSON.stringify({ type: 'GET_STATUS' }));
        });
        ws.on('message', raw => {
            let msg;
            try {
                msg = JSON.parse(raw.toString());
            }
            catch (_e) {
                return;
            }
            if (sentPendingPlugins !== null && msg.type === 'RENDER_ERROR') {
                return done({
                    sent: false,
                    plugins: sentPendingPlugins,
                    via: 'hub-externo',
                    error: String(msg.error || 'El hub rechazó el render'),
                });
            }
            if (msg.type !== 'STATUS_RESPONSE')
                return;
            const plugins = Number(msg.payload?.figmaCount) || 0;
            if (!msg.payload?.figmaConnected)
                return done({ sent: false, plugins, via: 'hub-externo' });
            sentPendingPlugins = plugins;
            ws.send(JSON.stringify(message), () => {
                ackTimer = setTimeout(() => done({ sent: true, plugins, via: 'hub-externo' }), 80);
            });
        });
        ws.on('error', () => done({ sent: false, plugins: 0, via: 'ninguno' }));
    });
}
/** Entrega por el hub propio si escucha; si no, por el hub externo */
export async function sendToFigma(hub, message, externalUrl) {
    if (hub.isListening()) {
        const sent = hub.broadcastToFigma(message);
        return { sent, plugins: hub.getConnectedPluginsCount(), via: 'hub-propio' };
    }
    return relayToExternalHub(externalUrl, message);
}
//# sourceMappingURL=figma-relay.js.map