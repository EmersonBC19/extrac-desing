// Escaneo del sitio: detección de rutas y extracción de una página en Chromium real
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { injectExtension, flatten } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1280, height: 800 });

describe('escaneo del sitio en la página', () => {
  it('rutas del sitio: mismo origen, sin enlaces peligrosos ni archivos, paginación agrupada', async () => {
    const page = await B.page('synthetic/scan/index.html');
    await injectExtension(page);
    const found = await page.evaluate(() => (window as any).__codeToFigmaScan.collectRoutes());
    const paths = found.routes.map((r: any) => r.path);
    expect(paths[0]).toMatch(/scan\/index\.html$/);
    expect(paths.some((p: string) => p.endsWith('precios.html'))).toBe(true);
    expect(paths.filter((p: string) => p.includes('blog/page'))).toHaveLength(1);
    expect(paths.some((p: string) => /logout|pdf|otro/.test(p))).toBe(false);
    expect(found.excluded.map((e: any) => e.path)).toEqual([expect.stringMatching(/logout$/)]);
  });

  it('una página que carga datos después: se espera a que se estabilice antes de extraer', async () => {
    const page = await B.page('synthetic/scan/lento.html');
    await injectExtension(page);
    const scanned = await page.evaluate(() => (window as any).__codeToFigmaScan.scanPage({ prescroll: false }));
    const texts = flatten(scanned.rootNode)
      .map((x: any) => x.node.textData?.characters)
      .filter(Boolean);
    expect(texts).toContain('Datos cargados');
    expect(texts).not.toContain('Cargando…');
    expect(scanned).toMatchObject({ title: 'Lento · Sitio de prueba', stable: true });
  }, 20_000);
});
