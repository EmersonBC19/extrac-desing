import { SiteCrawler } from '@code-to-figma/core-extractor';
import { WebSocket } from 'ws';
import { consoleSink, createLogger, parseLogLevel } from '@code-to-figma/contracts';
import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';

const log = createLogger('crawl', { sinks: [consoleSink()], level: parseLogLevel(process.env.CTF_LOG_LEVEL) });
// El hub escucha solo en 127.0.0.1 ("localhost" puede resolverse a ::1 y fallar)
const HUB_URL = `ws://127.0.0.1:${Number(process.env.WS_PORT) || 8080}`;

// Parsear argumentos de terminal
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, any> = {
    url: 'http://localhost:3000',
    routes: [],
    gap: 80,
    rowGap: 120,
    width: 1440,
    height: 900,
    pages: false,
    max: 60,
    exploreTabs: true,
    exploreModals: true,
    contentSelector: 'body',
    clear: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--routes' && args[i + 1]) {
      options.routes = args[++i].split(',').map((r: string) => r.trim());
    } else if (arg === '--pages') {
      options.pages = true;
    } else if (arg === '--gap' && args[i + 1]) {
      options.gap = parseInt(args[++i], 10);
    } else if (arg === '--max' && args[i + 1]) {
      options.max = parseInt(args[++i], 10);
    } else if (arg === '--selector' && args[i + 1]) {
      options.contentSelector = args[++i];
    } else if (arg === '--auth' || arg === '--login') {
      options.auth = true;
    } else if (arg === '--no-tabs') {
      options.exploreTabs = false;
    } else if (arg === '--no-modals') {
      options.exploreModals = false;
    } else if (arg === '--no-clear' || arg === '--append') {
      options.clear = false;
    } else if (arg === '--clear') {
      options.clear = true;
    }
  }

  return options;
}

// ══════════════════════════════════════════════════════════════════
// Utilidades de logging con formato profesional
// ══════════════════════════════════════════════════════════════════

function logModuleStart(moduleName: string, moduleIndex: number, totalModules: number) {
  log.info(`\n${'═'.repeat(60)}`);
  log.info(`📦 MÓDULO [${moduleIndex + 1}/${totalModules}]: ${moduleName.toUpperCase()}`);
  log.info(`${'═'.repeat(60)}`);
}

function logViewStart(viewName: string, viewIndex: number, totalViews: number, variant: string) {
  const badge = variant === 'BASE' ? '🖥️' : variant === 'TAB' ? '📑' : variant === 'MODAL' ? '🗂️' : '📄';
  log.info(`  ${badge} Vista [${viewIndex + 1}/${totalViews}]: "${viewName}" (${variant})`);
}

function logRenderWait() {
  process.stdout.write(`     ⏳ Esperando confirmación de Figma...`);
}

function logRenderDone(name: string, timeMs: number) {
  process.stdout.write(` ✅ (${name}) [${timeMs}ms]\n`);
}

function logRenderTimeout() {
  process.stdout.write(` ⚠️ Timeout - continuando...\n`);
}

async function main() {
  const options = parseArgs();

  log.info(`\n╔${'═'.repeat(58)}╗`);
  log.info(`║  🌐 Code-to-Figma · Generador Profesional de Mockups      ║`);
  log.info(`╠${'═'.repeat(58)}╣`);
  log.info(`║  URL Base: ${options.url.padEnd(46)}║`);
  log.info(`║  Viewport: ${options.width}×${options.height}px${''.padEnd(36)}║`);
  log.info(`║  Modo: ${options.routes.length > 0 ? 'Rutas manuales' : 'Auto-detección profunda'}${''.padEnd(33)}║`);
  log.info(
    `║  Tabs: ${options.exploreTabs ? 'Sí' : 'No'} │ Modales: ${options.exploreModals ? 'Sí' : 'No'}${''.padEnd(29)}║`,
  );
  log.info(`╚${'═'.repeat(58)}╝\n`);

  // ── 1. Conectar con el WebSocket Hub ──
  const ws = new WebSocket(HUB_URL);

  // Cola de promesas para esperar confirmación de Figma
  let renderResolve: ((value: { id: string; name: string }) => void) | null = null;

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP' }));
      resolve();
    });
    ws.on('error', err => {
      log.error(`No se pudo conectar a ${HUB_URL}. ¿El Hub está corriendo? (npm run start:hub)`);
      reject(err);
    });
  });

  // Escuchar respuestas del plugin de Figma
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'RENDER_SUCCESS' && renderResolve) {
        renderResolve({ id: msg.nodeId || msg.payload?.nodeId || '?', name: msg.name || msg.payload?.name || '?' });
        renderResolve = null;
      }
    } catch (_e) {}
  });

  /**
   * Envía un frame a Figma y ESPERA a que el plugin confirme que terminó de renderizar.
   * Si no responde en `timeoutMs`, continúa de todas formas.
   */
  async function sendAndWait(
    payload: WSRenderPayload,
    timeoutMs: number = 8000,
  ): Promise<{ id: string; name: string } | null> {
    const msg: WSMessage<WSRenderPayload> = { type: 'RENDER_NODES', payload };
    ws.send(JSON.stringify(msg));

    logRenderWait();
    const start = Date.now();

    return new Promise<{ id: string; name: string } | null>(resolve => {
      renderResolve = result => {
        logRenderDone(result.name, Date.now() - start);
        resolve(result);
      };
      setTimeout(() => {
        if (renderResolve) {
          renderResolve = null;
          logRenderTimeout();
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  const crawler = new SiteCrawler();
  let exitCode = 0;

  // ── 2. Grid de distribución en canvas de Figma ──
  // Agrupar pantallas por módulo antes de enviarlas
  interface QueuedScreen {
    screen: {
      title: string;
      routeOrTab: string;
      rootNode: any;
      group?: string;
      routeKey?: string;
      variantType?: string;
    };
    module: string;
  }

  const moduleQueues: Map<string, QueuedScreen[]> = new Map();

  // ── 3. Fase de recolección: crawl + agrupación por módulo ──
  log.info('🔍 Fase 1: Recolectando todas las pantallas del sistema...\n');

  try {
    await crawler.crawl({
      baseUrl: options.url,
      routes: options.routes,
      auth: options.auth,
      contentSelector: options.contentSelector,
      viewport: { width: options.width, height: options.height },
      maxScreens: options.max,
      exploreTabs: options.exploreTabs,
      exploreModals: options.exploreModals,
      onScreen: async screen => {
        const mod = screen.group || 'General';
        if (!moduleQueues.has(mod)) {
          moduleQueues.set(mod, []);
        }
        moduleQueues.get(mod)!.push({ screen, module: mod });
      },
    });

    // ── 4. Resumen de lo recolectado ──
    const totalScreens = Array.from(moduleQueues.values()).reduce((sum, q) => sum + q.length, 0);
    const moduleNames = Array.from(moduleQueues.keys());

    log.info(`\n${'─'.repeat(60)}`);
    log.info(`📊 Resumen de recolección:`);
    log.info(`   Total de pantallas: ${totalScreens}`);
    log.info(`   Módulos detectados: ${moduleNames.length}`);
    for (const [mod, queue] of moduleQueues) {
      const bases = queue.filter(q => q.screen.variantType === 'BASE').length;
      const tabs = queue.filter(q => q.screen.variantType === 'TAB').length;
      const modals = queue.filter(q => q.screen.variantType === 'MODAL').length;
      log.info(`     📦 ${mod}: ${queue.length} vistas (${bases} base, ${tabs} tabs, ${modals} modales)`);
    }
    log.info(`${'─'.repeat(60)}\n`);

    // ── 5. Fase de transmisión: enviar a Figma módulo por módulo ──
    log.info('🎨 Fase 2: Transmitiendo a Figma módulo por módulo...\n');

    let currentCanvasY = 0;
    const FRAME_GAP_X = options.gap || 120;
    const FRAME_GAP_Y = options.rowGap || 140;
    const MODULE_GAP_Y = 240;
    let isFirstTransmission = true;

    // 5.1 Cada módulo en orden
    const moduleList = Array.from(moduleQueues.entries());

    for (let mi = 0; mi < moduleList.length; mi++) {
      const [moduleName, screens] = moduleList[mi];
      if (screens.length === 0) continue;

      // Si se exporta por páginas de Figma, reiniciar la coordenada Y en cada página
      if (options.pages) {
        currentCanvasY = 0;
      }

      logModuleStart(moduleName, mi, moduleList.length);

      // Agrupar por routeKey para sub-organización (base → tabs → modales)
      const byRoute = new Map<string, QueuedScreen[]>();
      for (const s of screens) {
        const rk = s.screen.routeKey || s.screen.routeOrTab || 'default';
        if (!byRoute.has(rk)) byRoute.set(rk, []);
        byRoute.get(rk)!.push(s);
      }

      for (const [_routeKey, routeScreens] of byRoute) {
        if (routeScreens.length === 0) continue;

        // Ordenar: BASE primero, luego TAB, luego MODAL
        const sorted = routeScreens.sort((a, b) => {
          const order: Record<string, number> = { BASE: 0, TAB: 1, MODAL: 2 };
          return (order[a.screen.variantType || 'BASE'] || 0) - (order[b.screen.variantType || 'BASE'] || 0);
        });

        let colX = 0;

        for (let si = 0; si < sorted.length; si++) {
          const { screen } = sorted[si];

          logViewStart(screen.title, si, sorted.length, screen.variantType || 'BASE');

          // Section title solo para la primera pantalla de cada ruta
          const sectionTitle =
            si === 0
              ? `📌 ${moduleName.toUpperCase()} — ${screen.title.split(' / ').pop()?.toUpperCase() || ''}`
              : undefined;

          const payload: WSRenderPayload = {
            rootNode: screen.rootNode,
            clearPage: options.clear && isFirstTransmission,
            targetCanvasPosition: { x: colX, y: currentCanvasY },
            pageName: options.pages ? moduleName : undefined,
            groupName: moduleName,
            sectionTitle,
          };

          if (isFirstTransmission) {
            isFirstTransmission = false;
          }

          await sendAndWait(payload, 10000);

          // Avanzar horizontalmente para la siguiente vista de la misma ruta (tabs y modales a la derecha)
          colX += options.width + FRAME_GAP_X;
        }

        // Cada ruta de navegación avanza una fila en vertical
        currentCanvasY += options.height + FRAME_GAP_Y;
      }

      // Separación adicional limpia entre módulos diferentes
      currentCanvasY += MODULE_GAP_Y;

      log.info(`  ✅ Módulo "${moduleName}" completado (${screens.length} frames)\n`);
    }

    log.info(`\n╔${'═'.repeat(58)}╗`);
    log.info(`║  🎉 ¡PROCESO COMPLETADO!                                  ║`);
    log.info(`║  ${totalScreens} pantallas exportadas a Figma${''.padEnd(29)}║`);
    log.info(`║  ${moduleList.length} módulos procesados${''.padEnd(36)}║`);
    log.info(`╚${'═'.repeat(58)}╝\n`);
  } catch (err: any) {
    log.error('Error durante el crawling', { error: err.message });
    exitCode = 1;
  } finally {
    try {
      await crawler.close().catch(() => {});
      ws.close();
    } catch (_e) {}
    process.exit(exitCode);
  }
}

main().catch(err => {
  log.error('Fallo del CLI', { error: String(err?.message || err) });
  process.exit(1);
});
