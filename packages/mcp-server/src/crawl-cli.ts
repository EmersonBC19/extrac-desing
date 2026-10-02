import { SiteCrawler } from '@code-to-figma/core-extractor';
import { WebSocket } from 'ws';
import type { WSMessage, WSRenderPayload } from '@code-to-figma/contracts';

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
    includeDesignSystem: true,
    contentSelector: 'body'
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
    } else if (arg === '--no-ds') {
      options.includeDesignSystem = false;
    }
  }

  return options;
}

// ══════════════════════════════════════════════════════════════════
// Utilidades de logging con formato profesional
// ══════════════════════════════════════════════════════════════════

function logModuleStart(moduleName: string, moduleIndex: number, totalModules: number) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📦 MÓDULO [${moduleIndex + 1}/${totalModules}]: ${moduleName.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);
}

function logViewStart(viewName: string, viewIndex: number, totalViews: number, variant: string) {
  const badge = variant === 'BASE' ? '🖥️' : variant === 'TAB' ? '📑' : variant === 'MODAL' ? '🗂️' : '📄';
  console.log(`  ${badge} Vista [${viewIndex + 1}/${totalViews}]: "${viewName}" (${variant})`);
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

  console.log(`\n╔${'═'.repeat(58)}╗`);
  console.log(`║  🌐 Code-to-Figma · Generador Profesional de Mockups      ║`);
  console.log(`╠${'═'.repeat(58)}╣`);
  console.log(`║  URL Base: ${options.url.padEnd(46)}║`);
  console.log(`║  Viewport: ${options.width}×${options.height}px${''.padEnd(36)}║`);
  console.log(`║  Modo: ${options.routes.length > 0 ? 'Rutas manuales' : 'Auto-detección profunda'}${''.padEnd(33)}║`);
  console.log(`║  Design System: ${options.includeDesignSystem ? 'Sí' : 'No'}${''.padEnd(39)}║`);
  console.log(`║  Tabs: ${options.exploreTabs ? 'Sí' : 'No'} │ Modales: ${options.exploreModals ? 'Sí' : 'No'}${''.padEnd(29)}║`);
  console.log(`╚${'═'.repeat(58)}╝\n`);

  // ── 1. Conectar con el WebSocket Hub ──
  const ws = new WebSocket('ws://localhost:8080');

  // Cola de promesas para esperar confirmación de Figma
  let renderResolve: ((value: { id: string; name: string }) => void) | null = null;

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP' }));
      resolve();
    });
    ws.on('error', (err) => {
      console.error('❌ No se pudo conectar a ws://localhost:8080. ¿El Hub está corriendo?');
      reject(err);
    });
  });

  // Escuchar respuestas del plugin de Figma
  ws.on('message', (data) => {
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
  async function sendAndWait(payload: WSRenderPayload, timeoutMs: number = 8000): Promise<{ id: string; name: string } | null> {
    const msg: WSMessage<WSRenderPayload> = { type: 'RENDER_NODES', payload };
    ws.send(JSON.stringify(msg));

    logRenderWait();
    const start = Date.now();

    return new Promise<{ id: string; name: string } | null>((resolve) => {
      renderResolve = (result) => {
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
  const NAV_ORIGIN_X = options.includeDesignSystem ? 1900 : 0;

  // ── 3. Fase de recolección: crawl + agrupación por módulo ──
  console.log('🔍 Fase 1: Recolectando todas las pantallas del sistema...\n');

  let dsScreen: QueuedScreen | null = null as QueuedScreen | null;

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
      includeDesignSystem: options.includeDesignSystem,
      onScreen: async (screen) => {
        const mod = screen.group || 'General';
        const isDS = screen.variantType === 'DESIGN_SYSTEM' || screen.routeKey === '_DESIGN_SYSTEM_';

        if (isDS) {
          dsScreen = { screen, module: 'Design System' };
          return;
        }

        if (!moduleQueues.has(mod)) {
          moduleQueues.set(mod, []);
        }
        moduleQueues.get(mod)!.push({ screen, module: mod });
      }
    });

    // ── 4. Resumen de lo recolectado ──
    const totalScreens = Array.from(moduleQueues.values()).reduce((sum, q) => sum + q.length, 0) + (dsScreen ? 1 : 0);
    const moduleNames = Array.from(moduleQueues.keys());

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📊 Resumen de recolección:`);
    console.log(`   Total de pantallas: ${totalScreens}`);
    console.log(`   Módulos detectados: ${moduleNames.length}`);
    for (const [mod, queue] of moduleQueues) {
      const bases = queue.filter(q => q.screen.variantType === 'BASE').length;
      const tabs = queue.filter(q => q.screen.variantType === 'TAB').length;
      const modals = queue.filter(q => q.screen.variantType === 'MODAL').length;
      console.log(`     📦 ${mod}: ${queue.length} vistas (${bases} base, ${tabs} tabs, ${modals} modales)`);
    }
    console.log(`${'─'.repeat(60)}\n`);

    // ── 5. Fase de transmisión: enviar a Figma módulo por módulo ──
    console.log('🎨 Fase 2: Transmitiendo a Figma módulo por módulo...\n');

    let currentCanvasY = 0;
    const FRAME_GAP_X = options.gap || 80;
    const FRAME_GAP_Y = options.rowGap || 100;
    const MODULE_GAP_Y = 160;
    let globalScreenIndex = 0;

    // 5.1 Primero el Design System
    if (dsScreen) {
      console.log('🎨 Transmitiendo Design System & UI Kit...');
      await sendAndWait({
        rootNode: dsScreen.screen.rootNode,
        clearPage: false,
        targetCanvasPosition: { x: 0, y: 0 },
        groupName: 'Design System'
      }, 10000);
      globalScreenIndex++;
    }

    // 5.2 Luego cada módulo en orden
    const moduleList = Array.from(moduleQueues.entries());

    for (let mi = 0; mi < moduleList.length; mi++) {
      const [moduleName, screens] = moduleList[mi];
      if (screens.length === 0) continue;

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
          const order: Record<string, number> = { 'BASE': 0, 'TAB': 1, 'MODAL': 2 };
          return (order[a.screen.variantType || 'BASE'] || 0) - (order[b.screen.variantType || 'BASE'] || 0);
        });

        let colX = NAV_ORIGIN_X;

        for (let si = 0; si < sorted.length; si++) {
          const { screen } = sorted[si];
          globalScreenIndex++;

          logViewStart(screen.title, si, sorted.length, screen.variantType || 'BASE');

          // Section title solo para la primera pantalla de cada ruta
          const sectionTitle = si === 0
            ? `📌 ${moduleName.toUpperCase()} — ${screen.title.split(' / ').pop()?.toUpperCase() || ''}`
            : undefined;

          const payload: WSRenderPayload = {
            rootNode: screen.rootNode,
            clearPage: false,
            targetCanvasPosition: { x: colX, y: currentCanvasY },
            pageName: options.pages ? moduleName : undefined,
            groupName: moduleName,
            sectionTitle
          };

          await sendAndWait(payload, 10000);

          // Avanzar horizontalmente para la siguiente vista de la misma ruta (tabs y modales a la derecha)
          colX += options.width + FRAME_GAP_X;
        }

        // Cada ruta de navegación avanza una fila en vertical
        currentCanvasY += options.height + FRAME_GAP_Y;
      }

      // Separación adicional limpia entre módulos diferentes
      currentCanvasY += MODULE_GAP_Y;

      console.log(`  ✅ Módulo "${moduleName}" completado (${screens.length} frames)\n`);
    }

    console.log(`\n╔${'═'.repeat(58)}╗`);
    console.log(`║  🎉 ¡PROCESO COMPLETADO!                                  ║`);
    console.log(`║  ${totalScreens} pantallas exportadas a Figma${''.padEnd(29)}║`);
    console.log(`║  ${moduleList.length} módulos procesados${''.padEnd(36)}║`);
    console.log(`╚${'═'.repeat(58)}╝\n`);

  } catch (err: any) {
    console.error('\n❌ Error durante el crawling:', err.message);
  } finally {
    try {
      await crawler.close().catch(() => {});
      ws.close();
    } catch (_e) {}
    process.exit(0);
  }
}

main().catch(console.error);
