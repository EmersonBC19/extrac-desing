import { chromium, type Browser, type Page } from 'playwright';
import { consoleSink, createLogger } from '@code-to-figma/contracts';
import type { Logger, UINode } from '@code-to-figma/contracts';
import { getBrowserExtractorScript } from './browser-script.js';
import { inlineSvgImages } from './browser.js';

export interface CrawlScreenResult {
  title: string;
  routeOrTab: string;
  rootNode: UINode;
  tokens?: Record<string, unknown>;
  group?: string;
  routeKey?: string;
  variantType?: 'BASE' | 'TAB' | 'MODAL';
}

export interface CrawlOptions {
  baseUrl: string;
  routes?: string[];
  tabSelector?: string;
  contentSelector?: string;
  viewport?: { width: number; height: number };
  maxScreens?: number;
  delayMs?: number;
  auth?: boolean;
  exploreTabs?: boolean;
  exploreModals?: boolean;
  onScreen?: (result: CrawlScreenResult, index: number, total: number) => Promise<void> | void;
  /** Destino de los mensajes de progreso. El servidor MCP pasa uno que escribe en stderr (stdout es su protocolo) */
  logger?: Logger;
}

interface TargetScreen {
  route: string;
  title: string;
  group: string;
}

export class SiteCrawler {
  private browser: Browser | null = null;

  async init(headless: boolean = true): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Espera activa y estabilización profunda de la página:
   * 1. Red en reposo (networkidle)
   * 2. Desaparición total de loaders, skeletons, spinners
   * 3. Presencia de contenido real en el DOM (tablas, cards, formularios, textos)
   * 4. Carga completa de fuentes tipográficas
   * 5. Finalización de transiciones y animaciones CSS
   */
  async waitForPageReady(page: Page, _timeoutMs = 8000): Promise<void> {
    // 1. Red en reposo (networkidle)
    try {
      await page.waitForLoadState('networkidle', { timeout: 3500 });
    } catch (_e) {}

    // 2. Desaparición de spinners y loaders conocidos
    try {
      await page.waitForSelector(
        '.spinner, mat-spinner, .loader, [role="progressbar"], .ngx-spinner, .loading, .mat-progress-spinner, .mat-mdc-progress-spinner, .sk-spinner',
        { state: 'detached', timeout: 3500 },
      );
    } catch (_e) {}

    // 3. Esperar que el contenido de la vista esté realmente poblado
    try {
      await page.waitForFunction(
        () => {
          // Verificar que no haya spinners o skeletons activos
          const hasSpinner = !!document.querySelector(
            '.spinner, mat-spinner, .loader, [role="progressbar"], .ngx-spinner, .loading, .mat-progress-spinner',
          );
          if (hasSpinner) return false;

          // Comprobar si hay elementos de contenido significativos
          const container =
            document.querySelector('main, router-outlet + *, app-root .content, .main-content, app-sidebar ~ *') ||
            document.body;
          const text = (container.textContent || '').trim();
          const interactiveOrContentEls = container.querySelectorAll(
            'table, mat-table, tr, td, .card, form, input, button, h1, h2, h3, h4, p, span, [class*="card"], [class*="item"]',
          );

          return interactiveOrContentEls.length >= 2 || text.length > 30;
        },
        { timeout: 5000 },
      );
    } catch (_e) {}

    // 4. Esperar fuentes tipográficas
    try {
      await page.evaluate(async () => {
        if ('fonts' in document && document.fonts) {
          await document.fonts.ready;
        }
      });
    } catch (_e) {}

    // 5. Breve pausa para asentar transiciones CSS
    await page.waitForTimeout(400);
  }

  async crawl(options: CrawlOptions): Promise<CrawlScreenResult[]> {
    const isHeadless = !options.auth;
    await this.init(isHeadless);
    if (!this.browser) throw new Error('Chromium no inicializado');

    const viewport = options.viewport || { width: 1440, height: 900 };
    const contentSelector = options.contentSelector || 'body';
    const delay = options.delayMs || 1000;
    const maxScreens = options.maxScreens || 40;
    const log = options.logger || createLogger('crawler', { sinks: [consoleSink()] });

    const context = await this.browser.newContext({ viewport });
    const page = await context.newPage();
    const results: CrawlScreenResult[] = [];

    try {
      log.info(`\n🔍 Navegando a la URL base: ${options.baseUrl}...`);
      await page.goto(options.baseUrl, { waitUntil: 'networkidle', timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(delay);

      // Modo autenticación asistida
      if (options.auth) {
        log.info('\n=============================================================');
        log.info('🔐 [MODO LOGIN ASISTIDO]');
        log.info('Se ha abierto una ventana de navegador.');
        log.info('👉 Por favor, inicia sesión con tus credenciales de desarrollo.');
        log.info('Esperando a que entres al dashboard principal (máximo 2 min)...');
        log.info('=============================================================\n');

        try {
          await page.waitForURL(
            url => {
              const path = url.pathname.toLowerCase();
              return !path.endsWith('/login') && path !== '/' && path !== '';
            },
            { timeout: 120000 },
          );
          log.info(`✅ ¡Login detectado en ruta: ${page.url()}!`);
          log.info('Esperando a que carguen los datos y menús...');
          await page.waitForTimeout(2500);
        } catch (_authErr) {
          log.warn('⚠️ No se detectó cambio de URL en 2 minutos. Continuando con la vista actual...');
        }
      }

      const baseObj = new URL(options.baseUrl);
      let targets: TargetScreen[] = [];

      if (options.routes && options.routes.length > 0) {
        targets = options.routes.map(r => ({
          route: r,
          title: r.replace(/[/_-]/g, ' ').trim(),
          group: 'Personalizado',
        }));
      } else {
        log.info('🤖 Auto-detectando todas las secciones, submódulos y vistas del sistema...');
        const discoveredMap = new Map<string, TargetScreen>();

        // 1. Método Angular Ivy Runtime (window.ng) para extraer los módulos activos del usuario
        try {
          const ngModules = await page.evaluate(() => {
            try {
              const ng = (window as any).ng;
              const sidebarEl = document.querySelector('app-sidebar');
              if (ng && sidebarEl) {
                const comp = ng.getComponent(sidebarEl);
                if (comp && comp.modules && Array.isArray(comp.modules)) {
                  const list: { route: string; title: string; group: string }[] = [];
                  for (const m of comp.modules) {
                    const grp = m.name || 'General';
                    if (m.submodules && m.submodules.length > 0) {
                      for (const s of m.submodules) {
                        const r = s.module_route.startsWith('/') ? s.module_route : `/administration/${s.module_route}`;
                        list.push({ route: r, title: s.name, group: grp });
                      }
                    } else {
                      const r = m.module_route.startsWith('/') ? m.module_route : `/administration/${m.module_route}`;
                      list.push({ route: r, title: m.name, group: grp });
                    }
                  }
                  return list;
                }
              }
            } catch (_e) {}
            return null;
          });

          if (ngModules && ngModules.length > 0) {
            log.info(`✨ Detección Angular Runtime exitosa: ${ngModules.length} vistas identificadas.`);
            for (const item of ngModules) {
              discoveredMap.set(item.route, item);
            }
          }
        } catch (_e) {}

        // 2. Método DOM interactivo: desplegar cada acordeón y capturar enlaces
        try {
          const rootLinks = await page.evaluate(() => {
            const items: { route: string; title: string; group: string }[] = [];
            const origin = window.location.origin;
            document.querySelectorAll('nav.sidebar-nav > a.sidebar-item, aside a, nav a').forEach(a => {
              const href =
                a.getAttribute('href') || a.getAttribute('routerLink') || a.getAttribute('ng-reflect-router-link');
              const title = a.textContent?.trim() || 'Dashboard';
              if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                  const u = new URL(href, origin);
                  if (u.origin === origin && !u.pathname.includes('logout') && u.pathname !== '/login') {
                    items.push({ route: u.pathname, title, group: title });
                  }
                } catch (_e) {}
              }
            });
            return items;
          });

          for (const item of rootLinks) {
            if (!discoveredMap.has(item.route)) discoveredMap.set(item.route, item);
          }

          const accordionHandles = await page.$$(
            'nav.sidebar-nav > div.sidebar-item, aside [class*="item"]:not(a), nav [class*="item"]:not(a)',
          );
          for (const acc of accordionHandles) {
            try {
              const rawText = await acc.innerText();
              const groupName = rawText.trim().split('\n')[0] || 'Módulo';
              await acc.click();
              await page.waitForTimeout(300);

              const subItems = await page.evaluate(grp => {
                const items: { route: string; title: string; group: string }[] = [];
                const origin = window.location.origin;
                const subLinks = document.querySelectorAll('.sidebar-sublist a, .sidebar-subitem');
                subLinks.forEach(el => {
                  const href =
                    el.getAttribute('href') ||
                    el.getAttribute('routerLink') ||
                    el.getAttribute('ng-reflect-router-link');
                  const title = el.textContent?.trim() || 'Submódulo';
                  if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                    try {
                      const u = new URL(href, origin);
                      if (u.origin === origin && !u.pathname.includes('logout') && u.pathname !== '/login') {
                        items.push({ route: u.pathname, title, group: grp });
                      }
                    } catch (_e) {}
                  }
                });
                return items;
              }, groupName);

              for (const item of subItems) {
                if (!discoveredMap.has(item.route)) discoveredMap.set(item.route, item);
              }
            } catch (_e) {}
          }
        } catch (_e) {}

        // 3. Fallback genérico: cualquier enlace interno seguro de la página actual (sin catálogo fijo)
        try {
          const genericLinks = await page.evaluate(() => {
            const items: { route: string; title: string; group: string }[] = [];
            const origin = window.location.origin;
            const dangerous =
              /(^|[/_.\-=?&])(log-?out|sign-?out|salir|cerrar-?sesion|delete|eliminar|remove|destroy|unsubscribe|pay|pagar|checkout|purchase|transfer|reset|revoke)([/_.\-=?&]|$)/i;
            const nonView = /\.(pdf|zip|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|csv|xlsx?|json|xml)$/i;
            document.querySelectorAll('a[href]').forEach(a => {
              const href = a.getAttribute('href') || '';
              if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
              try {
                const u = new URL(href, origin);
                const full = decodeURIComponent(u.pathname + u.search);
                if (u.origin !== origin || nonView.test(u.pathname) || dangerous.test(full)) return;
                const label = (a.textContent || '').replace(/\s+/g, ' ').trim() || u.pathname || 'Vista';
                items.push({ route: full || '/', title: label.slice(0, 60), group: 'Navegación' });
              } catch (_e) {}
            });
            return items;
          });
          for (const item of genericLinks) {
            if (!discoveredMap.has(item.route)) discoveredMap.set(item.route, item);
          }
        } catch (_e) {}

        const initialRoute = decodeURIComponent(baseObj.pathname + baseObj.search) || '/';
        if (discoveredMap.size === 0) {
          discoveredMap.set(initialRoute, { route: initialRoute, title: 'Inicio', group: 'Principal' });
        }

        const orderedTargets: TargetScreen[] = [];
        if (discoveredMap.has(initialRoute)) {
          orderedTargets.push(discoveredMap.get(initialRoute)!);
          discoveredMap.delete(initialRoute);
        }
        orderedTargets.push(...Array.from(discoveredMap.values()));

        targets = orderedTargets.slice(0, maxScreens);
        log.info(`\n📌 Rutas del sistema preparadas para extracción (${targets.length}):`);
        targets.forEach((t, idx) => log.info(`   [${idx + 1}] [${t.group}] ${t.title} -> ${t.route}`));
      }

      // 4. Proceso de navegación, extracción de pantallas, sub-pestañas y modales
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const fullUrl = target.route.startsWith('http')
          ? target.route
          : `${baseObj.origin}${target.route.startsWith('/') ? target.route : '/' + target.route}`;

        log.info(
          `\n[${i + 1}/${targets.length}] 📂 Extrayendo [${target.group}] -> "${target.title}" (${target.route})...`,
        );

        try {
          if (page.url() !== fullUrl) {
            // Intento 1: Navegación SPA por clic en enlace de sidebar
            const clicked = await page.evaluate(targetRoute => {
              try {
                const clean = targetRoute.replace(/^\/administration\//, '').replace(/^\//, '');

                // Desplegar acordeones de menú si están contraídos
                const accordions = Array.from(
                  document.querySelectorAll('aside [class*="item"], nav [class*="item"], .sidebar-item'),
                );
                for (const acc of accordions) {
                  const sub = acc.nextElementSibling || acc.querySelector('.sidebar-sublist');
                  if (sub && window.getComputedStyle(sub).display === 'none') {
                    (acc as HTMLElement).click();
                  }
                }

                const links = Array.from(
                  document.querySelectorAll(
                    'a, [routerlink], [ng-reflect-router-link], [role="menuitem"], .sidebar-subitem, .sidebar-item',
                  ),
                );
                for (const link of links) {
                  const href =
                    link.getAttribute('href') ||
                    link.getAttribute('routerlink') ||
                    link.getAttribute('ng-reflect-router-link') ||
                    '';
                  if (href.includes(targetRoute) || (clean.length > 2 && href.includes(clean))) {
                    (link as HTMLElement).click();
                    return true;
                  }
                }
              } catch (_e) {}
              return false;
            }, target.route);

            if (!clicked) {
              await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
            }
          }

          // Espera exhaustiva y estabilización de datos de la página
          await this.waitForPageReady(page, 10000);

          // Inlinear imágenes SVG
          await inlineSvgImages(page);

          const screenTitle = `${target.group} / ${target.title}`;

          // Extraer la vista base de la pantalla
          const extractedBase = await page.evaluate(
            async ({ scriptCode, sel, screenName }) => {
              if (!(window as any).__codeToFigmaExtract) (0, eval)(scriptCode); // mismo extractor que la extensión
              const targetEl = document.querySelector(sel);
              if (!targetEl) return null;
              const res = await (window as any).__codeToFigmaExtract(targetEl);
              if (res?.rootNode) {
                res.rootNode.name = 'Screen / ' + screenName;
              }
              return res;
            },
            { scriptCode: getBrowserExtractorScript(), sel: contentSelector, screenName: screenTitle },
          );
          const uiNode = extractedBase?.rootNode;

          function countTreeNodes(n: any): number {
            let c = 1;
            if (n && n.children) {
              for (const ch of n.children) c += countTreeNodes(ch);
            }
            return c;
          }

          if (uiNode) {
            const count = countTreeNodes(uiNode);
            log.info(`   📊 Vista base extraída: "${screenTitle}" (${count} elementos, URL: ${page.url()})`);

            const screenResult: CrawlScreenResult = {
              title: screenTitle,
              routeOrTab: target.route,
              rootNode: uiNode as UINode,
              tokens: extractedBase?.tokens,
              group: target.group,
              routeKey: target.route,
              variantType: 'BASE',
            };

            results.push(screenResult);

            if (options.onScreen) {
              await options.onScreen(screenResult, results.length - 1, targets.length);
            }
          }

          // ⚡ A. Exploración interactiva de sub-pestañas internas (Tabs)
          if (options.exploreTabs !== false) {
            const subTabs = await page.$$(
              '[role="tab"], .mat-mdc-tab, .mat-tab-label, .nav-tabs button, .nav-tabs a, button[role="tab"]',
            );
            if (subTabs.length > 1) {
              log.info(
                `   🔎 Detectadas ${subTabs.length} pestañas interactivas en esta pantalla. Extrayendo vistas...`,
              );
              for (let t = 1; t < Math.min(subTabs.length, 5); t++) {
                try {
                  const tabHandle = subTabs[t];
                  const tabText = (await tabHandle.innerText()).trim().split('\n')[0] || `Pestaña ${t + 1}`;
                  await tabHandle.click();
                  await this.waitForPageReady(page, 4500);

                  const tabScreenTitle = `${target.group} / ${target.title} [Pestaña: ${tabText}]`;
                  const tabExtracted = await page.evaluate(
                    async ({ scriptCode, sel, screenName }) => {
                      if (!(window as any).__codeToFigmaExtract) (0, eval)(scriptCode); // mismo extractor que la extensión
                      const targetEl = document.querySelector(sel);
                      if (!targetEl) return null;
                      const res = await (window as any).__codeToFigmaExtract(targetEl);
                      if (res?.rootNode) res.rootNode.name = 'Screen / ' + screenName;
                      return res;
                    },
                    { scriptCode: getBrowserExtractorScript(), sel: contentSelector, screenName: tabScreenTitle },
                  );
                  const tabNode = tabExtracted?.rootNode;

                  if (tabNode) {
                    const count = countTreeNodes(tabNode);
                    log.info(`      📑 Pestaña extraída: "${tabScreenTitle}" (${count} elementos)`);
                    const tabResult: CrawlScreenResult = {
                      title: tabScreenTitle,
                      routeOrTab: `${target.route}#tab-${t}`,
                      rootNode: tabNode as UINode,
                      group: target.group,
                      routeKey: target.route,
                      variantType: 'TAB',
                    };
                    results.push(tabResult);
                    if (options.onScreen) {
                      await options.onScreen(tabResult, results.length - 1, targets.length);
                    }
                  }
                } catch (_tabErr) {}
              }
            }
          }

          // ⚡ B. Exploración interactiva de Modales y Diálogos con fondo visible
          if (options.exploreModals !== false) {
            const candidateButtons = await page.$$('button:not([disabled]), a.btn, [role="button"]:not([disabled])');
            const triggersToClick: { handle: any; label: string }[] = [];

            for (const btn of candidateButtons) {
              try {
                const text = (await btn.innerText()).trim().toLowerCase();
                const cls = (await btn.getAttribute('class')) || '';
                const aria = (await btn.getAttribute('aria-label')) || '';
                const title = (await btn.getAttribute('title')) || '';

                const combinedInfo = `${text} ${cls} ${aria} ${title}`.toLowerCase();

                const isModalTrigger =
                  combinedInfo.includes('nuevo') ||
                  combinedInfo.includes('nueva') ||
                  combinedInfo.includes('crear') ||
                  combinedInfo.includes('agregar') ||
                  combinedInfo.includes('añadir') ||
                  combinedInfo.includes('filtro') ||
                  combinedInfo.includes('opciones') ||
                  combinedInfo.includes('asignar') ||
                  combinedInfo.includes('configurar') ||
                  combinedInfo.includes('subir') ||
                  combinedInfo.includes('importar') ||
                  combinedInfo.includes('mover') ||
                  combinedInfo.includes('detalle') ||
                  combinedInfo.includes('modal') ||
                  combinedInfo.includes('dialog');

                const isDangerousOrNav =
                  combinedInfo.includes('eliminar') ||
                  combinedInfo.includes('borrar') ||
                  combinedInfo.includes('delete') ||
                  combinedInfo.includes('logout') ||
                  combinedInfo.includes('salir') ||
                  combinedInfo.includes('cerrar sesión') ||
                  combinedInfo.includes('cancelar');

                if (isModalTrigger && !isDangerousOrNav) {
                  const label = (await btn.innerText()).trim() || aria || title || 'Acción';
                  triggersToClick.push({ handle: btn, label: label.slice(0, 30) });
                }
              } catch (_e) {}
            }

            if (triggersToClick.length > 0) {
              log.info(
                `   🗂️ Detectados ${triggersToClick.length} disparadores de diálogo/modal. Mapeando vistas modales con fondo...`,
              );
              for (let m = 0; m < Math.min(triggersToClick.length, 5); m++) {
                try {
                  const trigger = triggersToClick[m];
                  await trigger.handle.click();
                  try {
                    await page.waitForSelector(
                      '.cdk-overlay-pane, [role="dialog"], .modal.show, .modal-dialog, .dialog-container, .mat-mdc-dialog-container',
                      { timeout: 3500 },
                    );
                  } catch (_e) {}
                  await page.waitForTimeout(600);

                  const hasDialog = await page.$(
                    '.cdk-overlay-pane, [role="dialog"], .modal.show, .modal-dialog, .dialog-container, .mat-mdc-dialog-container',
                  );
                  if (hasDialog) {
                    const modalTitle =
                      (await page.evaluate(() => {
                        const h = document.querySelector(
                          '.cdk-overlay-pane h1, .cdk-overlay-pane h2, .cdk-overlay-pane h3, [role="dialog"] h1, [role="dialog"] h2, .modal-title, .dialog-title, .title',
                        );
                        return h?.textContent?.trim() || null;
                      })) || trigger.label;

                    log.info(`      ✨ [Modal Capturado con Fondo] "${modalTitle}"`);
                    const modalScreenTitle = `${target.group} / ${target.title} [Modal: ${modalTitle}]`;

                    // Extrae el árbol completo con el fondo oscurecido y el diálogo encima
                    const modalExtracted = await page.evaluate(
                      async ({ scriptCode, sel, screenName }) => {
                        if (!(window as any).__codeToFigmaExtract) (0, eval)(scriptCode); // mismo extractor que la extensión
                        const targetEl = document.querySelector(sel);
                        if (!targetEl) return null;
                        const res = await (window as any).__codeToFigmaExtract(targetEl);
                        if (res?.rootNode) res.rootNode.name = 'Screen / ' + screenName;
                        return res;
                      },
                      { scriptCode: getBrowserExtractorScript(), sel: contentSelector, screenName: modalScreenTitle },
                    );
                    const modalNode = modalExtracted?.rootNode;

                    if (modalNode) {
                      const count = countTreeNodes(modalNode);
                      log.info(`      🗂️ Modal extraído: "${modalScreenTitle}" (${count} elementos)`);
                      const modalResult: CrawlScreenResult = {
                        title: modalScreenTitle,
                        routeOrTab: `${target.route}#modal-${m + 1}`,
                        rootNode: modalNode as UINode,
                        group: target.group,
                        routeKey: target.route,
                        variantType: 'MODAL',
                      };
                      results.push(modalResult);
                      if (options.onScreen) {
                        await options.onScreen(modalResult, results.length - 1, targets.length);
                      }
                    }

                    // Cerrar el modal para volver al estado limpio
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(300);
                    const closeBtn = await page.$(
                      '.btn-close, .modal-close, button:has-text("Cancelar"), button:has-text("Cerrar"), [aria-label="Close"], .close',
                    );
                    if (closeBtn) {
                      try {
                        await closeBtn.click();
                      } catch (_e) {}
                      await page.waitForTimeout(300);
                    }
                  }
                } catch (_modalErr) {
                  await page.keyboard.press('Escape').catch(() => {});
                }
              }
            }
          }
        } catch (routeErr: any) {
          log.warn(`Advertencia extrayendo ruta "${target.route}"`, { error: routeErr.message });
        }
      }
    } finally {
      try {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      } catch (_e) {}
    }

    return results;
  }
}
