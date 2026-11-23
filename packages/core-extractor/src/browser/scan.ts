/**
 * Agente del escaneo del sitio: corre en cada página de la ventana de escaneo (sin el inspector).
 * Espera a que la página se estabilice, la recorre con scroll (cargas diferidas y animaciones de
 * entrada, como prepareForExtraction de la extensión) y extrae el documento completo.
 */
import { collectSiteRoutes, parseSitemap, type RouteCollection } from './site-routes';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Espera a que la página deje de cambiar: documento cargado, sin mutaciones del DOM ni recursos
 * nuevos durante `quietMs`. Tope `maxMs` (las páginas con sondeos o anuncios nunca se calman).
 */
export async function waitForStable(quietMs = 700, maxMs = 10_000): Promise<{ stable: boolean; waitedMs: number }> {
  const t0 = Date.now();
  if (document.readyState !== 'complete') {
    await new Promise<void>(r => {
      const done = () => r();
      window.addEventListener('load', done, { once: true });
      setTimeout(done, maxMs);
    });
  }
  let last = Date.now();
  const touch = () => (last = Date.now());
  const mo = new MutationObserver(touch);
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  let resources = performance.getEntriesByType('resource').length;
  try {
    while (Date.now() - t0 < maxMs) {
      await sleep(100);
      const now = performance.getEntriesByType('resource').length;
      if (now !== resources) {
        resources = now;
        touch();
      }
      if (Date.now() - last >= quietMs) return { stable: true, waitedMs: Date.now() - t0 };
    }
    return { stable: false, waitedMs: Date.now() - t0 };
  } finally {
    mo.disconnect();
  }
}

/** Recorre la página con scroll (pasos de ~0,8 pantallas) y espera las imágenes; vuelve arriba */
export async function prescrollPage(maxSteps = 260, stepDelayMs = 220): Promise<void> {
  document.querySelectorAll('img').forEach(img => {
    if (img.loading === 'lazy') img.loading = 'eager';
  });
  const step = Math.max(200, window.innerHeight * 0.8);
  const total = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const steps = Math.min(maxSteps, Math.ceil(total / step));
  for (let i = 0; i < steps; i++) {
    window.scrollTo({ left: 0, top: i * step, behavior: 'instant' as ScrollBehavior });
    await sleep(stepDelayMs);
  }
  window.scrollTo({ left: 0, top: 0, behavior: 'instant' as ScrollBehavior });
  await sleep(350);
  const pending = Array.from(document.images).filter(img => !img.complete);
  if (pending.length) {
    await Promise.race([
      Promise.all(
        pending.map(
          img =>
            new Promise(r => {
              img.addEventListener('load', r, { once: true });
              img.addEventListener('error', r, { once: true });
            }),
        ),
      ),
      sleep(3000),
    ]);
  }
}

/** Rutas del sitio desde los enlaces de la página y su sitemap.xml (si existe y responde rápido) */
export async function collectRoutesFromPage(withSitemap = true): Promise<RouteCollection> {
  const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
    href: (a as HTMLAnchorElement).href,
    text: (a.textContent || '').trim(),
  }));
  if (withSitemap) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(new URL('/sitemap.xml', location.href).href, {
        signal: ctrl.signal,
        credentials: 'include',
      });
      clearTimeout(timer);
      if (res.ok && /xml/.test(res.headers.get('content-type') || '')) {
        for (const loc of parseSitemap(await res.text())) links.push({ href: loc, text: '' });
      }
    } catch (_e) {
      /* sin sitemap: solo los enlaces de la página */
    }
  }
  return collectSiteRoutes(links, location.href);
}

export interface ScannedPage {
  url: string;
  title: string;
  rootNode: any;
  tokens: any;
  stable: boolean;
}

/** Una página del escaneo: estabilizar, recorrer y extraer el documento completo */
export async function scanCurrentPage(options: { prescroll?: boolean } = {}): Promise<ScannedPage> {
  const { stable } = await waitForStable();
  if (options.prescroll !== false) await prescrollPage();
  const root = document.body || document.documentElement;
  if (typeof window.__codeToFigmaExtract !== 'function') throw new Error('Extractor no cargado');
  const res = await window.__codeToFigmaExtract(root);
  if (!res) throw new Error('No se pudo extraer la página');
  return { url: location.href, title: document.title, rootNode: res.rootNode, tokens: res.tokens, stable };
}
