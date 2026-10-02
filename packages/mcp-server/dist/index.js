import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { BrowserExtractor, SiteCrawler } from '@code-to-figma/core-extractor';
import { FigmaWsHub } from './ws-hub.js';
// Iniciar WebSocket Hub embebido si no está corriendo externamente
const hub = new FigmaWsHub();
try {
    hub.start(8080);
}
catch (_e) {
    // Si ya estaba iniciado el puerto, continúa
}
const extractor = new BrowserExtractor();
const server = new Server({
    name: 'code-to-figma-mcp',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
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
                            description: 'Código HTML completo o fragmento, incluyendo clases de Tailwind o estilos CSS en línea.'
                        },
                        selector: {
                            type: 'string',
                            description: 'Selector CSS del elemento que se desea extraer (por defecto "body > *" o "body").'
                        }
                    },
                    required: ['html']
                }
            },
            {
                name: 'render_url_to_figma',
                description: 'Navega a una URL local o remota (ej. http://localhost:3000), extrae el componente seleccionado del DOM en vivo y lo envía a Figma.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'La URL a inspeccionar (ej: http://localhost:3000/dashboard).'
                        },
                        selector: {
                            type: 'string',
                            description: 'Selector CSS del componente a extraer (ej: "#modal-confirm", ".user-profile-card").'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'inspect_ui_node',
                description: 'Extrae y devuelve el árbol de datos UINode (JSON) de una URL o código HTML sin enviarlo a Figma, para inspección o validación.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', description: 'URL a inspeccionar.' },
                        html: { type: 'string', description: 'Código HTML a inspeccionar.' },
                        selector: { type: 'string', description: 'Selector CSS.' }
                    }
                }
            },
            {
                name: 'crawl_site_to_figma',
                description: 'Recorre múltiples rutas o pestañas de navegación de una aplicación web y las dibuja todas en Figma organizadas horizontalmente o en páginas independientes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        baseUrl: {
                            type: 'string',
                            description: 'URL base del proyecto (ej: http://localhost:4200 o http://localhost:3000).'
                        },
                        routes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Lista opcional de rutas específicas (ej: ["/dashboard", "/clientes", "/transferencias"]). Si se omite, auto-detecta las pestañas/enlaces.'
                        },
                        pages: {
                            type: 'boolean',
                            description: 'Si es true, crea cada pantalla en una página separada de Figma. Si es false (defecto), las alinea horizontalmente en el mismo lienzo.'
                        },
                        gap: {
                            type: 'number',
                            description: 'Espacio en píxeles entre pantallas en el lienzo horizontal (por defecto 160).'
                        }
                    },
                    required: ['baseUrl']
                }
            }
        ]
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
            const uiNode = await extractor.extractFromUrl({
                htmlContent: fullHtml,
                selector
            });
            const sent = hub.broadcastToFigma({
                type: 'RENDER_NODES',
                payload: {
                    rootNode: uiNode,
                    clearPage: false
                }
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            componentName: uiNode.name,
                            nodeType: uiNode.type,
                            connectedPlugins: hub.getConnectedPluginsCount(),
                            sentToFigma: sent,
                            message: sent
                                ? `¡Componente "${uiNode.name}" renderizado y transmitido a Figma con éxito!`
                                : `Componente procesado, pero no se detectó ningún plugin de Figma conectado en ws://localhost:8080. Abre el plugin en Figma para recibirlo.`
                        }, null, 2)
                    }
                ]
            };
        }
        if (name === 'render_url_to_figma') {
            const url = String(args?.url || '');
            const selector = args?.selector ? String(args.selector) : 'body';
            const uiNode = await extractor.extractFromUrl({
                url,
                selector
            });
            const sent = hub.broadcastToFigma({
                type: 'RENDER_NODES',
                payload: {
                    rootNode: uiNode,
                    clearPage: false
                }
            });
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
                                : `Elemento extraído con éxito, pero ningún plugin de Figma está escuchando en ws://localhost:8080.`
                        }, null, 2)
                    }
                ]
            };
        }
        if (name === 'inspect_ui_node') {
            const url = args?.url ? String(args.url) : undefined;
            const htmlContent = args?.html ? String(args.html) : undefined;
            const selector = args?.selector ? String(args.selector) : 'body';
            const uiNode = await extractor.extractFromUrl({
                url,
                htmlContent,
                selector
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(uiNode, null, 2)
                    }
                ]
            };
        }
        if (name === 'crawl_site_to_figma') {
            const baseUrl = String(args?.baseUrl || '');
            const routes = Array.isArray(args?.routes) ? args.routes.map(String) : undefined;
            const pages = Boolean(args?.pages);
            const gap = typeof args?.gap === 'number' ? args.gap : 160;
            const crawler = new SiteCrawler();
            const width = 1440;
            let count = 0;
            const screens = await crawler.crawl({
                baseUrl,
                routes,
                viewport: { width, height: 900 },
                onScreen: async (screen, index) => {
                    count++;
                    const posX = index * (width + gap);
                    hub.broadcastToFigma({
                        type: 'RENDER_NODES',
                        payload: {
                            rootNode: screen.rootNode,
                            clearPage: false,
                            targetCanvasPosition: pages ? undefined : { x: posX, y: 0 },
                            pageName: pages ? screen.title : undefined
                        }
                    });
                    await new Promise(r => setTimeout(r, 600));
                }
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
                            message: `Se han exportado ${screens.length} pantallas a Figma con éxito.`
                        }, null, 2)
                    }
                ]
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
                    text: `Error ejecutando ${name}: ${err.message}`
                }
            ]
        };
    }
});
// Arrancar transporte estándar STDIO
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Servidor MCP code-to-figma conectado vía STDIO');
}
run().catch((err) => {
    console.error('Fallo iniciando servidor MCP:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map