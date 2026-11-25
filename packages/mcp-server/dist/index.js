import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { BrowserExtractor, SiteCrawler } from '@code-to-figma/core-extractor';
import { FigmaWsHub } from './ws-hub.js';
import { sendToFigma } from './figma-relay.js';
import { consoleSink, createLogger, parseLogLevel } from '@code-to-figma/contracts';
// Todo el registro va a stderr: stdout es el canal JSON-RPC del protocolo MCP
// (antes el banner y los avisos del hub embebido salían por stdout y corrompían el protocolo)
const log = createLogger('mcp', { sinks: [consoleSink('stderr')], level: parseLogLevel(process.env.CTF_LOG_LEVEL) });
// Hub embebido. Si el puerto ya está ocupado (npm run start:hub corriendo), los renders se
// reenvían a ese hub (ver figma-relay.ts).
const HUB_PORT = parseInt(process.env.WS_PORT || '8080', 10);
const HUB_URL = `ws://127.0.0.1:${HUB_PORT}`;
const hub = new FigmaWsHub({ logger: log.child('hub') });
hub.start(HUB_PORT);
const extractor = new BrowserExtractor();
const server = new Server({
    name: 'code-to-figma-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Registrar catálogo de herramientas MCP
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'render_html_to_figma',
                description: 'Renderiza un fragmento de HTML/Tailwind/CSS en Chromium, extrae su geometría computada y lo plasma en el lienzo de Figma con Auto Layout nativo.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        html: {
                            type: 'string',
                            description: 'Código HTML completo o fragmento, incluyendo clases de Tailwind o estilos CSS en línea.',
                        },
                        selector: {
                            type: 'string',
                            description: 'Selector CSS del elemento que se desea extraer (por defecto "body > *" o "body").',
                        },
                        createAsComponent: { type: 'boolean', description: 'Crear raíz como Componente nativo de Figma.' },
                        board: { type: 'boolean', description: 'Generar tablero Design System completo.' },
                        includeTokens: {
                            type: 'boolean',
                            description: 'Incluir variables CSS (:root) como tokens (por defecto true).',
                        },
                        viewport: {
                            type: 'object',
                            properties: { width: { type: 'number' }, height: { type: 'number' } },
                            description: 'Dimensiones opcionales de viewport para extraer.',
                        },
                    },
                    required: ['html'],
                },
            },
            {
                name: 'render_url_to_figma',
                description: 'Navega a una URL local o remota (ej. http://localhost:3000), extrae el componente seleccionado del DOM en vivo y lo envía a Figma.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'La URL a inspeccionar (ej: http://localhost:3000/dashboard).',
                        },
                        selector: {
                            type: 'string',
                            description: 'Selector CSS del componente a extraer (ej: "#modal-confirm", ".user-profile-card").',
                        },
                        createAsComponent: { type: 'boolean', description: 'Crear raíz como Componente nativo de Figma.' },
                        board: { type: 'boolean', description: 'Generar tablero Design System completo.' },
                        includeTokens: {
                            type: 'boolean',
                            description: 'Incluir variables CSS (:root) como tokens (por defecto true).',
                        },
                        waitForSelector: { type: 'string', description: 'Selector opcional que esperar antes de extraer.' },
                        viewport: {
                            type: 'object',
                            properties: { width: { type: 'number' }, height: { type: 'number' } },
                            description: 'Dimensiones opcionales de viewport para extraer.',
                        },
                    },
                    required: ['url'],
                },
            },
            {
                name: 'inspect_ui_node',
                description: 'Extrae y devuelve el árbol de datos UINode (JSON) de una URL o código HTML sin enviarlo a Figma, para inspección o validación.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', description: 'URL a inspeccionar.' },
                        html: { type: 'string', description: 'Código HTML a inspeccionar.' },
                        selector: { type: 'string', description: 'Selector CSS.' },
                    },
                },
            },
            {
                name: 'crawl_site_to_figma',
                description: 'Recorre múltiples rutas o pestañas de navegación de una aplicación web y las dibuja todas en Figma organizadas horizontalmente o en páginas independientes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        baseUrl: {
                            type: 'string',
                            description: 'URL base del proyecto (ej: http://localhost:4200 o http://localhost:3000).',
                        },
                        routes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Lista opcional de rutas específicas (ej: ["/dashboard", "/clientes", "/transferencias"]). Si se omite, auto-detecta las pestañas/enlaces.',
                        },
                        pages: {
                            type: 'boolean',
                            description: 'Si es true, crea cada pantalla en una página separada de Figma. Si es false (defecto), las alinea horizontalmente en el mismo lienzo.',
                        },
                        gap: {
                            type: 'number',
                            description: 'Espacio en píxeles entre pantallas en el lienzo horizontal (por defecto 160).',
                        },
                        board: { type: 'boolean', description: 'Generar tablero Design System por pantalla.' },
                        viewport: {
                            type: 'object',
                            properties: { width: { type: 'number' }, height: { type: 'number' } },
                            description: 'Viewport opcional del crawler (por defecto 1440x900).',
                        },
                    },
                    required: ['baseUrl'],
                },
            },
        ],
    };
});
// Manejo de llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (name === 'render_html_to_figma') {
            const html = String(args?.html || '');
            const selector = args?.selector ? String(args.selector) : 'body';
            // Si no tiene <html> ni CDN de Tailwind y usa clases Tailwind, inyectar el script CDN de Tailwind
            let fullHtml = html;
            if (!html.includes('<html')) {
                fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; padding: 24px; background: transparent; }</style>
</head>
<body>
  ${html}
</body>
</html>`;
            }
            const vpArg = args?.viewport;
            const viewport = vpArg && typeof vpArg.width === 'number' && typeof vpArg.height === 'number'
                ? { width: vpArg.width, height: vpArg.height }
                : undefined;
            const { rootNode: uiNode, tokens } = await extractor.extractBundleFromUrl({
                htmlContent: fullHtml,
                selector,
                viewport,
            });
            const includeTokens = args?.includeTokens !== false;
            const delivery = await sendToFigma(hub, {
                type: 'RENDER_NODES',
                payload: {
                    rootNode: uiNode,
                    ...(includeTokens && tokens ? { tokens } : {}),
                    ...(typeof args?.createAsComponent === 'boolean' ? { createAsComponent: args.createAsComponent } : {}),
                    ...(typeof args?.board === 'boolean' ? { board: args.board } : {}),
                    ...(viewport ? { viewport } : {}),
                    clearPage: false,
                },
            }, HUB_URL);
            if (delivery.error)
                throw new Error(delivery.error);
            const sent = delivery.sent;
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            componentName: uiNode.name,
                            nodeType: uiNode.type,
                            connectedPlugins: delivery.plugins,
                            sentToFigma: sent,
                            message: sent
                                ? `¡Componente "${uiNode.name}" renderizado y transmitido a Figma con éxito!`
                                : `Componente procesado, pero no se detectó ningún plugin de Figma conectado en ws://localhost:8080. Abre el plugin en Figma para recibirlo.`,
                        }, null, 2),
                    },
                ],
            };
        }
        if (name === 'render_url_to_figma') {
            const url = String(args?.url || '');
            const selector = args?.selector ? String(args.selector) : 'body';
            const vpArg = args?.viewport;
            const viewport = vpArg && typeof vpArg.width === 'number' && typeof vpArg.height === 'number'
                ? { width: vpArg.width, height: vpArg.height }
                : undefined;
            const waitForSelector = args?.waitForSelector ? String(args.waitForSelector) : undefined;
            const { rootNode: uiNode, tokens } = await extractor.extractBundleFromUrl({
                url,
                selector,
                viewport,
                waitForSelector,
            });
            const includeTokens = args?.includeTokens !== false;
            const delivery = await sendToFigma(hub, {
                type: 'RENDER_NODES',
                payload: {
                    rootNode: uiNode,
                    ...(includeTokens && tokens ? { tokens } : {}),
                    ...(typeof args?.createAsComponent === 'boolean' ? { createAsComponent: args.createAsComponent } : {}),
                    ...(typeof args?.board === 'boolean' ? { board: args.board } : {}),
                    ...(viewport ? { viewport } : {}),
                    source: { url },
                    clearPage: false,
                },
            }, HUB_URL);
            if (delivery.error)
                throw new Error(delivery.error);
            const sent = delivery.sent;
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            componentName: uiNode.name,
                            url,
                            selector,
                            sentToFigma: sent,
                            message: sent
                                ? `¡Elemento "${selector}" de ${url} extraído y enviado a Figma!`
                                : `Elemento extraído con éxito, pero ningún plugin de Figma está escuchando en ws://localhost:8080.`,
                        }, null, 2),
                    },
                ],
            };
        }
        if (name === 'inspect_ui_node') {
            const url = args?.url ? String(args.url) : undefined;
            const htmlContent = args?.html ? String(args.html) : undefined;
            const selector = args?.selector ? String(args.selector) : 'body';
            const uiNode = await extractor.extractFromUrl({
                url,
                htmlContent,
                selector,
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(uiNode, null, 2),
                    },
                ],
            };
        }
        if (name === 'crawl_site_to_figma') {
            const baseUrl = String(args?.baseUrl || '');
            const routes = Array.isArray(args?.routes) ? args.routes.map(String) : undefined;
            const pages = Boolean(args?.pages);
            const gap = typeof args?.gap === 'number' ? args.gap : 160;
            const crawler = new SiteCrawler();
            const vpArg = args?.viewport;
            const viewport = vpArg && typeof vpArg.width === 'number' && typeof vpArg.height === 'number'
                ? { width: vpArg.width, height: vpArg.height }
                : { width: 1440, height: 900 };
            const board = Boolean(args?.board);
            let cursorX = 0;
            const screens = await crawler.crawl({
                baseUrl,
                routes,
                viewport,
                logger: log.child('crawler'),
                onScreen: async (screen) => {
                    const measuredW = screen.rootNode.layout?.measuredWidth ??
                        (typeof screen.rootNode.layout?.width === 'number' ? screen.rootNode.layout.width : viewport.width);
                    const posX = cursorX;
                    cursorX += Math.max(100, Math.round(measuredW)) + gap;
                    const delivery = await sendToFigma(hub, {
                        type: 'RENDER_NODES',
                        payload: {
                            rootNode: screen.rootNode,
                            ...(screen.tokens ? { tokens: screen.tokens } : {}),
                            ...(board ? { board: true } : {}),
                            clearPage: false,
                            targetCanvasPosition: pages ? undefined : { x: posX, y: 0 },
                            pageName: pages ? screen.title : undefined,
                        },
                    }, HUB_URL);
                    if (delivery.error)
                        throw new Error(delivery.error);
                    await new Promise(r => setTimeout(r, 250));
                },
            });
            await crawler.close();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            totalScreens: screens.length,
                            screens: screens.map(s => ({ title: s.title, route: s.routeOrTab })),
                            message: `Se han exportado ${screens.length} pantallas a Figma con éxito.`,
                        }, null, 2),
                    },
                ],
            };
        }
        throw new Error(`Herramienta no implementada: ${name}`);
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Error ejecutando ${name}: ${err.message}`,
                },
            ],
        };
    }
});
// Arrancar transporte estándar STDIO
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info('Servidor MCP code-to-figma conectado vía STDIO');
}
run().catch(err => {
    log.error('Fallo iniciando servidor MCP', { error: String(err?.stack || err) });
    process.exit(1);
});
//# sourceMappingURL=index.js.map