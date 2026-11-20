import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, inject } from 'vitest';

/**
 * Un navegador por archivo de pruebas. bypassCSP: inyectar el extractor igual que la extensión
 * aunque la página tenga CSP estricta.
 */
export function useBrowser(viewport = { width: 1440, height: 900 }) {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });
  return {
    async page(path?: string): Promise<Page> {
      const context = await browser.newContext({ viewport, bypassCSP: true });
      const page = await context.newPage();
      if (path) await page.goto(fixture(path), { waitUntil: 'networkidle' });
      return page;
    },
    get browser() {
      return browser;
    },
  };
}

/** URL de una página fixture servida por el globalSetup */
export function fixture(path: string): string {
  return `${inject('fixturesUrl')}/${path.replace(/^\//, '')}`;
}
