import { chromium, type Browser, type Page } from 'playwright';
import type { UINode } from '@code-to-figma/contracts';
import { getBrowserExtractorScript } from './browser-script.js';

export interface ExtractOptions {
  url?: string;
  htmlContent?: string;
  selector?: string;
  viewport?: { width: number; height: number };
  waitForSelector?: string;
  timeout?: number;
}

export interface ExtractedBundle {
  rootNode: UINode;
  tokens?: Record<string, unknown>;
}

/** Convierte imágenes <img src="*.svg"> de la página en <svg> inline antes de extraer */
export async function inlineSvgImages(page: Page): Promise<void> {
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
        } catch (_e) {}
      }
    }
  });
}

export class BrowserExtractor {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
    }
  }

  async extractBundleFromUrl(options: ExtractOptions): Promise<ExtractedBundle> {
    await this.init();
    if (!this.browser) throw new Error('No se pudo inicializar Chromium');

    const context = await this.browser.newContext({
      viewport: options.viewport || { width: 1280, height: 800 },
    });

    const page: Page = await context.newPage();

    try {
      if (options.url) {
        await page.goto(options.url, {
          waitUntil: 'networkidle',
          timeout: options.timeout || 30000,
        });
      } else if (options.htmlContent) {
        await page.setContent(options.htmlContent, {
          waitUntil: 'load',
        });
      } else {
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
      await inlineSvgImages(page);

      // Inyectar y ejecutar extractor
      const targetSelector = options.selector || 'body';
      const extracted = await page.evaluate(
        async ({ scriptCode, sel }) => {
          // Inyectar el extractor (el mismo de la extensión) y extraer el elemento
          if (!(window as any).__codeToFigmaExtract) (0, eval)(scriptCode); // mismo extractor que la extensión
          const targetEl = document.querySelector(sel);
          if (!targetEl) throw new Error(`No se encontró el elemento con el selector: "${sel}"`);
          return await (window as any).__codeToFigmaExtract(targetEl);
        },
        { scriptCode: getBrowserExtractorScript(), sel: targetSelector },
      );

      if (!extracted || !extracted.rootNode) {
        throw new Error(`El selector "${targetSelector}" no produjo ningún nodo válido.`);
      }

      return {
        rootNode: extracted.rootNode as UINode,
        tokens: extracted.tokens,
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async extractFromUrl(options: ExtractOptions): Promise<UINode> {
    const { rootNode } = await this.extractBundleFromUrl(options);
    return rootNode;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
