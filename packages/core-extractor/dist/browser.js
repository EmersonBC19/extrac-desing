import { chromium } from 'playwright';
import { browserDomExtractorScript } from './dom-to-node.js';
export class BrowserExtractor {
    browser = null;
    async init() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true
            });
        }
    }
    async extractFromUrl(options) {
        await this.init();
        if (!this.browser)
            throw new Error('No se pudo inicializar Chromium');
        const context = await this.browser.newContext({
            viewport: options.viewport || { width: 1280, height: 800 }
        });
        const page = await context.newPage();
        try {
            if (options.url) {
                await page.goto(options.url, {
                    waitUntil: 'networkidle',
                    timeout: options.timeout || 30000
                });
            }
            else if (options.htmlContent) {
                await page.setContent(options.htmlContent, {
                    waitUntil: 'load'
                });
            }
            else {
                throw new Error('Debe proveer una url o htmlContent para extraer');
            }
            // Esperar a que las fuentes web terminen de cargar
            await page.evaluate(async () => {
                if ('fonts' in document && document.fonts) {
                    await document.fonts.ready;
                }
            });
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
            }
            // ⚡ Inlinear todas las imágenes <img src="*.svg"> para capturarlas como vectores reales en Figma
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
            // Inyectar y ejecutar extractor
            const targetSelector = options.selector || 'body';
            const rootUINode = await page.evaluate(({ scriptCode, sel }) => {
                // Evaluar la función extractNodeTree en el contexto de la página
                const evalFn = new Function(`${scriptCode}; return extractNodeTree;`)();
                const targetEl = document.querySelector(sel);
                if (!targetEl)
                    throw new Error(`No se encontró el elemento con el selector: "${sel}"`);
                return evalFn(targetEl);
            }, { scriptCode: browserDomExtractorScript, sel: targetSelector });
            if (!rootUINode) {
                throw new Error(`El selector "${targetSelector}" no produjo ningún nodo válido.`);
            }
            return rootUINode;
        }
        finally {
            await page.close();
            await context.close();
        }
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
//# sourceMappingURL=browser.js.map