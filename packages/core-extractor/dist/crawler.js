import { chromium } from 'playwright';
import { browserDomExtractorScript } from './dom-to-node.js';
import { createDesignSystemFrame } from './design-system-extractor.js';
export class SiteCrawler {
    browser = null;
    async init(headless = true) {
        if (!this.browser) {
            this.browser = await chromium.launch({ headless });
        }
    }
    async close() {
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
    async waitForPageReady(page, timeoutMs = 8000) {
        // 1. Red en reposo (networkidle)
        try {
            await page.waitForLoadState('networkidle', { timeout: 3500 });
        }
        catch (_e) { }
        // 2. Desaparición de spinners y loaders conocidos
        try {
            await page.waitForSelector('.spinner, mat-spinner, .loader, [role="progressbar"], .ngx-spinner, .loading, .mat-progress-spinner, .mat-mdc-progress-spinner, .sk-spinner', { state: 'detached', timeout: 3500 });
        }
        catch (_e) { }
        // 3. Esperar que el contenido de la vista esté realmente poblado
        try {
            await page.waitForFunction(() => {
                // Verificar que no haya spinners o skeletons activos
                const hasSpinner = !!document.querySelector('.spinner, mat-spinner, .loader, [role="progressbar"], .ngx-spinner, .loading, .mat-progress-spinner');
                if (hasSpinner)
                    return false;
                // Comprobar si hay elementos de contenido significativos
                const container = document.querySelector('main, router-outlet + *, app-root .content, .main-content, app-sidebar ~ *') || document.body;
                const text = (container.textContent || '').trim();
                const interactiveOrContentEls = container.querySelectorAll('table, mat-table, tr, td, .card, form, input, button, h1, h2, h3, h4, p, span, [class*="card"], [class*="item"]');
                return interactiveOrContentEls.length >= 2 || text.length > 30;
            }, { timeout: 5000 });
        }
        catch (_e) { }
        // 4. Esperar fuentes tipográficas
        try {
            await page.evaluate(async () => {
                if ('fonts' in document && document.fonts) {
                    await document.fonts.ready;
                }
            });
        }
        catch (_e) { }
        // 5. Breve pausa para asentar transiciones CSS
        await page.waitForTimeout(400);
    }
    async crawl(options) {
        const isHeadless = !options.auth;
        await this.init(isHeadless);
        if (!this.browser)
            throw new Error('Chromium no inicializado');
        const viewport = options.viewport || { width: 1440, height: 900 };
        const contentSelector = options.contentSelector || 'body';
        const delay = options.delayMs || 1000;
        const maxScreens = options.maxScreens || 40;
        const context = await this.browser.newContext({ viewport });
        const page = await context.newPage();
        const results = [];
        try {
            console.log(`\n🔍 Navegando a la URL base: ${options.baseUrl}...`);
            await page.goto(options.baseUrl, { waitUntil: 'networkidle', timeout: 35000 }).catch(() => { });
            await page.waitForTimeout(delay);
            // Modo autenticación asistida
            if (options.auth) {
                console.log('\n=============================================================');
                console.log('🔐 [MODO LOGIN ASISTIDO]');
                console.log('Se ha abierto una ventana de navegador.');
                console.log('👉 Por favor, inicia sesión con tus credenciales de desarrollo.');
                console.log('Esperando a que entres al dashboard principal (máximo 2 min)...');
                console.log('=============================================================\n');
                try {
                    await page.waitForURL((url) => {
                        const path = url.pathname.toLowerCase();
                        return !path.endsWith('/login') && path !== '/' && path !== '';
                    }, { timeout: 120000 });
                    console.log(`✅ ¡Login detectado en ruta: ${page.url()}!`);
                    console.log('Esperando a que carguen los datos y menús...');
                    await page.waitForTimeout(2500);
                }
                catch (_authErr) {
                    console.warn('⚠️ No se detectó cambio de URL en 2 minutos. Continuando con la vista actual...');
                }
            }
            // 0. Transmitir el Artboard del Sistema de Diseño (Design Tokens & UI Kit)
            if (options.includeDesignSystem !== false) {
                console.log(`\n🎨 Generando Artboard Maestro: "Design System, Tokens & UI Kit"...`);
                const dsNode = createDesignSystemFrame();
                const dsResult = {
                    title: '🎨 Design System & UI Kit',
                    routeOrTab: '/design-system',
                    rootNode: dsNode,
                    group: 'Design System',
                    routeKey: '_DESIGN_SYSTEM_',
                    variantType: 'DESIGN_SYSTEM'
                };
                results.push(dsResult);
                if (options.onScreen) {
                    await options.onScreen(dsResult, 0, 1);
                }
            }
            const baseObj = new URL(options.baseUrl);
            let targets = [];
            if (options.routes && options.routes.length > 0) {
                targets = options.routes.map(r => ({
                    route: r,
                    title: r.replace(/[/_-]/g, ' ').trim(),
                    group: 'Personalizado'
                }));
            }
            else {
                console.log('🤖 Auto-detectando todas las secciones, submódulos y vistas del sistema...');
                const discoveredMap = new Map();
                // 1. Método Angular Ivy Runtime (window.ng) para extraer los módulos activos del usuario
                try {
                    const ngModules = await page.evaluate(() => {
                        try {
                            const ng = window.ng;
                            const sidebarEl = document.querySelector('app-sidebar');
                            if (ng && sidebarEl) {
                                const comp = ng.getComponent(sidebarEl);
                                if (comp && comp.modules && Array.isArray(comp.modules)) {
                                    const list = [];
                                    for (const m of comp.modules) {
                                        const grp = m.name || 'General';
                                        if (m.submodules && m.submodules.length > 0) {
                                            for (const s of m.submodules) {
                                                const r = s.module_route.startsWith('/')
                                                    ? s.module_route
                                                    : `/administration/${s.module_route}`;
                                                list.push({ route: r, title: s.name, group: grp });
                                            }
                                        }
                                        else {
                                            const r = m.module_route.startsWith('/')
                                                ? m.module_route
                                                : `/administration/${m.module_route}`;
                                            list.push({ route: r, title: m.name, group: grp });
                                        }
                                    }
                                    return list;
                                }
                            }
                        }
                        catch (_e) { }
                        return null;
                    });
                    if (ngModules && ngModules.length > 0) {
                        console.log(`✨ Detección Angular Runtime exitosa: ${ngModules.length} vistas identificadas.`);
                        for (const item of ngModules) {
                            discoveredMap.set(item.route, item);
                        }
                    }
                }
                catch (_e) { }
                // 2. Método DOM interactivo: desplegar cada acordeón y capturar enlaces
                try {
                    const rootLinks = await page.evaluate(() => {
                        const items = [];
                        const origin = window.location.origin;
                        document.querySelectorAll('nav.sidebar-nav > a.sidebar-item, aside a, nav a').forEach(a => {
                            const href = a.getAttribute('href') || a.getAttribute('routerLink') || a.getAttribute('ng-reflect-router-link');
                            const title = a.textContent?.trim() || 'Dashboard';
                            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                                try {
                                    const u = new URL(href, origin);
                                    if (u.origin === origin && !u.pathname.includes('logout') && u.pathname !== '/login') {
                                        items.push({ route: u.pathname, title, group: title });
                                    }
                                }
                                catch (_e) { }
                            }
                        });
                        return items;
                    });
                    for (const item of rootLinks) {
                        if (!discoveredMap.has(item.route))
                            discoveredMap.set(item.route, item);
                    }
                    const accordionHandles = await page.$$('nav.sidebar-nav > div.sidebar-item, aside [class*="item"]:not(a), nav [class*="item"]:not(a)');
                    for (const acc of accordionHandles) {
                        try {
                            const rawText = await acc.innerText();
                            const groupName = rawText.trim().split('\n')[0] || 'Módulo';
                            await acc.click();
                            await page.waitForTimeout(300);
                            const subItems = await page.evaluate((grp) => {
                                const items = [];
                                const origin = window.location.origin;
                                const subLinks = document.querySelectorAll('.sidebar-sublist a, .sidebar-subitem');
                                subLinks.forEach(el => {
                                    const href = el.getAttribute('href') || el.getAttribute('routerLink') || el.getAttribute('ng-reflect-router-link');
                                    const title = el.textContent?.trim() || 'Submódulo';
                                    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                                        try {
                                            const u = new URL(href, origin);
                                            if (u.origin === origin && !u.pathname.includes('logout') && u.pathname !== '/login') {
                                                items.push({ route: u.pathname, title, group: grp });
                                            }
                                        }
                                        catch (_e) { }
                                    }
                                });
                                return items;
                            }, groupName);
                            for (const item of subItems) {
                                if (!discoveredMap.has(item.route))
                                    discoveredMap.set(item.route, item);
                            }
                        }
                        catch (_e) { }
                    }
                }
                catch (_e) { }
                // 3. Catálogo oficial de Polaris Cloud para cobertura total
                const POLARIS_CATALOG = [
                    { route: '/administration/dashboard', title: 'Dashboard', group: 'Dashboard' },
                    { route: '/administration/users', title: 'Usuarios', group: 'Seguridad' },
                    { route: '/administration/roles', title: 'Roles', group: 'Seguridad' },
                    { route: '/administration/auditoria/descarga', title: 'Reporte de Descarga', group: 'Auditoría' },
                    { route: '/administration/auditoria/inventario', title: 'Reporte de Inventario', group: 'Auditoría' },
                    { route: '/administration/auditoria/terminales', title: 'Reporte de Terminales', group: 'Auditoría' },
                    { route: '/administration/auditoria/log', title: 'Reporte de Auditoría', group: 'Auditoría' },
                    { route: '/administration/auditoria/aplicaciones', title: 'Reporte de Aplicaciones', group: 'Auditoría' },
                    { route: '/administration/remote-download/groups', title: 'Grupos', group: 'Descarga Remota' },
                    { route: '/administration/remote-download/groups/new', title: 'Nuevo Grupo', group: 'Descarga Remota' },
                    { route: '/administration/remote-download/terminals', title: 'Terminales', group: 'Descarga Remota' },
                    { route: '/administration/remote-download/terminals/move', title: 'Mover Terminales', group: 'Descarga Remota' },
                    { route: '/administration/remote-download/applications', title: 'Carga de Aplicaciones', group: 'Descarga Remota' },
                    { route: '/administration/tcp', title: 'Configuración TCP', group: 'Descarga Remota' },
                    { route: '/administration/descarga-remota/geolocalizacion', title: 'Geolocalizar Terminales', group: 'Descarga Remota' },
                    { route: '/administration/email-providers', title: 'Proveedores de Correo', group: 'Configuración' },
                    { route: '/administration/change-password', title: 'Cambiar Contraseña', group: 'Configuración' },
                    { route: '/administration/mfa', title: 'MFA', group: 'Configuración' },
                    { route: '/administration/codigo-barras', title: 'Código de Barras', group: 'Código de Barras' }
                ];
                for (const item of POLARIS_CATALOG) {
                    if (!discoveredMap.has(item.route)) {
                        discoveredMap.set(item.route, item);
                    }
                }
                const dashboardKey = '/administration/dashboard';
                const orderedTargets = [];
                if (discoveredMap.has(dashboardKey)) {
                    orderedTargets.push(discoveredMap.get(dashboardKey));
                    discoveredMap.delete(dashboardKey);
                }
                orderedTargets.push(...Array.from(discoveredMap.values()));
                targets = orderedTargets.slice(0, maxScreens);
                console.log(`\n📌 Rutas del sistema preparadas para extracción (${targets.length}):`);
                targets.forEach((t, idx) => console.log(`   [${idx + 1}] [${t.group}] ${t.title} -> ${t.route}`));
            }
            // 4. Proceso de navegación, extracción de pantallas, sub-pestañas y modales
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                const fullUrl = target.route.startsWith('http')
                    ? target.route
                    : `${baseObj.origin}${target.route.startsWith('/') ? target.route : '/' + target.route}`;
                console.log(`\n[${i + 1}/${targets.length}] 📂 Extrayendo [${target.group}] -> "${target.title}" (${target.route})...`);
                try {
                    if (page.url() !== fullUrl) {
                        // Intento 1: Navegación SPA por clic en enlace de sidebar
                        const clicked = await page.evaluate((targetRoute) => {
                            try {
                                const clean = targetRoute.replace(/^\/administration\//, '');
                                const links = Array.from(document.querySelectorAll('a, [routerlink]'));
                                for (const link of links) {
                                    const href = link.getAttribute('href') || link.getAttribute('routerlink') || '';
                                    if (href.includes(targetRoute) || (clean.length > 2 && href.includes(clean))) {
                                        link.click();
                                        return true;
                                    }
                                }
                            }
                            catch (_e) { }
                            return false;
                        }, target.route);
                        if (!clicked) {
                            await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => { });
                        }
                    }
                    // Espera exhaustiva y estabilización de datos de la página
                    await this.waitForPageReady(page, 10000);
                    // Inlinear imágenes SVG
                    await page.evaluate(async () => {
                        const imgs = Array.from(document.querySelectorAll('img'));
                        for (const img of imgs) {
                            const src = img.getAttribute('src') || '';
                            if (src.toLowerCase().includes('.svg') || src.startsWith('data:image/svg+xml')) {
                                try {
                                    const resp = await fetch(img.src);
                                    const text = await resp.text();
                                    if (text.includes('<svg')) {
                                        const parser = new DOMParser();
                                        const doc = parser.parseFromString(text, 'image/svg+xml');
                                        const svg = doc.querySelector('svg');
                                        if (svg) {
                                            const rect = img.getBoundingClientRect();
                                            svg.setAttribute('width', String(Math.round(rect.width) || 200));
                                            svg.setAttribute('height', String(Math.round(rect.height) || 42));
                                            svg.setAttribute('data-icon', img.getAttribute('alt') || 'Logo');
                                            img.replaceWith(svg);
                                        }
                                    }
                                }
                                catch (_e) { }
                            }
                        }
                    });
                    const screenTitle = `${target.group} / ${target.title}`;
                    // Extraer la vista base de la pantalla
                    const uiNode = await page.evaluate(({ scriptCode, sel, screenName }) => {
                        const evalFn = new Function(`${scriptCode}; return extractNodeTree;`)();
                        const targetEl = document.querySelector(sel);
                        if (!targetEl)
                            return null;
                        const node = evalFn(targetEl);
                        if (node) {
                            node.name = 'Screen / ' + screenName;
                        }
                        return node;
                    }, { scriptCode: browserDomExtractorScript, sel: contentSelector, screenName: screenTitle });
                    if (uiNode) {
                        const screenResult = {
                            title: screenTitle,
                            routeOrTab: target.route,
                            rootNode: uiNode,
                            group: target.group,
                            routeKey: target.route,
                            variantType: 'BASE'
                        };
                        results.push(screenResult);
                        if (options.onScreen) {
                            await options.onScreen(screenResult, results.length - 1, targets.length);
                        }
                    }
                    // ⚡ A. Exploración interactiva de sub-pestañas internas (Tabs)
                    if (options.exploreTabs !== false) {
                        const subTabs = await page.$$('[role="tab"], .mat-mdc-tab, .mat-tab-label, .nav-tabs button, .nav-tabs a, button[role="tab"]');
                        if (subTabs.length > 1) {
                            console.log(`   🔎 Detectadas ${subTabs.length} pestañas interactivas en esta pantalla. Extrayendo vistas...`);
                            for (let t = 1; t < Math.min(subTabs.length, 5); t++) {
                                try {
                                    const tabHandle = subTabs[t];
                                    const tabText = (await tabHandle.innerText()).trim().split('\n')[0] || `Pestaña ${t + 1}`;
                                    await tabHandle.click();
                                    await this.waitForPageReady(page, 4500);
                                    const tabScreenTitle = `${target.group} / ${target.title} [Pestaña: ${tabText}]`;
                                    const tabNode = await page.evaluate(({ scriptCode, sel, screenName }) => {
                                        const evalFn = new Function(`${scriptCode}; return extractNodeTree;`)();
                                        const targetEl = document.querySelector(sel);
                                        if (!targetEl)
                                            return null;
                                        const node = evalFn(targetEl);
                                        if (node)
                                            node.name = 'Screen / ' + screenName;
                                        return node;
                                    }, { scriptCode: browserDomExtractorScript, sel: contentSelector, screenName: tabScreenTitle });
                                    if (tabNode) {
                                        const tabResult = {
                                            title: tabScreenTitle,
                                            routeOrTab: `${target.route}#tab-${t}`,
                                            rootNode: tabNode,
                                            group: target.group,
                                            routeKey: target.route,
                                            variantType: 'TAB'
                                        };
                                        results.push(tabResult);
                                        if (options.onScreen) {
                                            await options.onScreen(tabResult, results.length - 1, targets.length);
                                        }
                                    }
                                }
                                catch (_tabErr) { }
                            }
                        }
                    }
                    // ⚡ B. Exploración interactiva de Modales y Diálogos con fondo visible
                    if (options.exploreModals !== false) {
                        const candidateButtons = await page.$$('button:not([disabled]), a.btn, [role="button"]:not([disabled])');
                        const triggersToClick = [];
                        for (const btn of candidateButtons) {
                            try {
                                const text = (await btn.innerText()).trim().toLowerCase();
                                const cls = (await btn.getAttribute('class')) || '';
                                const aria = (await btn.getAttribute('aria-label')) || '';
                                const title = (await btn.getAttribute('title')) || '';
                                const combinedInfo = `${text} ${cls} ${aria} ${title}`.toLowerCase();
                                const isModalTrigger = combinedInfo.includes('nuevo') ||
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
                                const isDangerousOrNav = combinedInfo.includes('eliminar') ||
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
                            }
                            catch (_e) { }
                        }
                        if (triggersToClick.length > 0) {
                            console.log(`   🗂️ Detectados ${triggersToClick.length} disparadores de diálogo/modal. Mapeando vistas modales con fondo...`);
                            for (let m = 0; m < Math.min(triggersToClick.length, 5); m++) {
                                try {
                                    const trigger = triggersToClick[m];
                                    await trigger.handle.click();
                                    try {
                                        await page.waitForSelector('.cdk-overlay-pane, [role="dialog"], .modal.show, .modal-dialog, .dialog-container, .mat-mdc-dialog-container', { timeout: 3500 });
                                    }
                                    catch (_e) { }
                                    await page.waitForTimeout(600);
                                    const hasDialog = await page.$('.cdk-overlay-pane, [role="dialog"], .modal.show, .modal-dialog, .dialog-container, .mat-mdc-dialog-container');
                                    if (hasDialog) {
                                        const modalTitle = await page.evaluate(() => {
                                            const h = document.querySelector('.cdk-overlay-pane h1, .cdk-overlay-pane h2, .cdk-overlay-pane h3, [role="dialog"] h1, [role="dialog"] h2, .modal-title, .dialog-title, .title');
                                            return h?.textContent?.trim() || null;
                                        }) || trigger.label;
                                        console.log(`      ✨ [Modal Capturado con Fondo] "${modalTitle}"`);
                                        const modalScreenTitle = `${target.group} / ${target.title} [Modal: ${modalTitle}]`;
                                        // Extrae el árbol completo con el fondo oscurecido y el diálogo encima
                                        const modalNode = await page.evaluate(({ scriptCode, sel, screenName }) => {
                                            const evalFn = new Function(`${scriptCode}; return extractNodeTree;`)();
                                            const targetEl = document.querySelector(sel);
                                            if (!targetEl)
                                                return null;
                                            const node = evalFn(targetEl);
                                            if (node)
                                                node.name = 'Screen / ' + screenName;
                                            return node;
                                        }, { scriptCode: browserDomExtractorScript, sel: contentSelector, screenName: modalScreenTitle });
                                        if (modalNode) {
                                            const modalResult = {
                                                title: modalScreenTitle,
                                                routeOrTab: `${target.route}#modal-${m + 1}`,
                                                rootNode: modalNode,
                                                group: target.group,
                                                routeKey: target.route,
                                                variantType: 'MODAL'
                                            };
                                            results.push(modalResult);
                                            if (options.onScreen) {
                                                await options.onScreen(modalResult, results.length - 1, targets.length);
                                            }
                                        }
                                        // Cerrar el modal para volver al estado limpio
                                        await page.keyboard.press('Escape');
                                        await page.waitForTimeout(300);
                                        const closeBtn = await page.$('.btn-close, .modal-close, button:has-text("Cancelar"), button:has-text("Cerrar"), [aria-label="Close"], .close');
                                        if (closeBtn) {
                                            try {
                                                await closeBtn.click();
                                            }
                                            catch (_e) { }
                                            await page.waitForTimeout(300);
                                        }
                                    }
                                }
                                catch (_modalErr) {
                                    await page.keyboard.press('Escape').catch(() => { });
                                }
                            }
                        }
                    }
                }
                catch (routeErr) {
                    console.warn(`[!] Advertencia extrayendo ruta "${target.route}":`, routeErr.message);
                }
            }
        }
        finally {
            try {
                await page.close().catch(() => { });
                await context.close().catch(() => { });
            }
            catch (_e) { }
        }
        return results;
    }
}
//# sourceMappingURL=crawler.js.map