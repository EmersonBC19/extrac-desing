/**
 * Rutas de un sitio para escanearlo desde la extensión, con la sesión del usuario.
 *
 * Con la sesión iniciada, abrir un enlace puede EJECUTAR algo (cerrar sesión, borrar, aprobar,
 * pagar…). Por eso hay una lista de exclusión amplia, las excluidas se muestran (no se ocultan) y
 * el usuario confirma la lista antes de empezar. Solo enlaces del mismo origen, nunca formularios.
 */

export interface SiteRoute {
  url: string;
  /** Ruta legible: "/precios", "/blog/{n}" */
  path: string;
  /** Texto del enlace (para la lista y el título en Figma) */
  label: string;
  /** Cuántas URLs del mismo patrón se agruparon en esta */
  grouped: number;
}

export interface ExcludedRoute {
  url: string;
  path: string;
  reason: string;
}

export interface RouteCollection {
  routes: SiteRoute[];
  excluded: ExcludedRoute[];
}

/** Enlaces que pueden tener efectos con la sesión iniciada (en la ruta o en los parámetros) */
const DANGEROUS =
  /(^|[/_.\-=?&])(log-?out|sign-?out|salir|cerrar-?sesion|desconectar|delete|eliminar|borrar|remove|destroy|drop|unsubscribe|darse-de-baja|approve|aprobar|reject|rechazar|confirm|confirmar|cancel|cancelar|anular|pay|pagar|checkout|purchase|comprar|transfer|transferir|reset|revoke|revocar|deactivate|desactivar|disable|deshabilitar|archive|archivar|publish|publicar|send|enviar|invite|invitar|admin\/.*\/(edit|delete))([/_.\-=?&]|$)/i;

/** Archivos y recursos que no son vistas */
const NOT_A_VIEW =
  /\.(pdf|zip|rar|7z|gz|tar|dmg|exe|msi|apk|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|csv|xlsx?|docx?|pptx?|json|xml|txt|rss|atom)$/i;

/** Segmento que cambia entre URLs del mismo tipo: números, ids largos, fechas, uuids */
function genericSegment(seg: string): string {
  if (/^\d+$/.test(seg)) return '{n}';
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(seg)) return '{fecha}';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return '{id}';
  if (/^[0-9a-z]{16,}$/i.test(seg) && /\d/.test(seg)) return '{id}';
  return seg;
}

/** Patrón de una URL: segmentos genéricos y parámetros sin valor ("/blog/{n}?page") */
export function routePattern(url: URL): string {
  const segs = url.pathname.split('/').filter(Boolean).map(genericSegment);
  const params = [...new Set([...url.searchParams.keys()])].sort();
  return '/' + segs.join('/') + (params.length ? '?' + params.join('&') : '');
}

/**
 * Lista de rutas a partir de los enlaces de la página (y opcionalmente del sitemap).
 * La página actual va primero; luego en el orden en que aparecen. Sin límite aquí: lo aplica quien
 * llama (la lista muestra todas y el usuario elige hasta el máximo).
 */
export function collectSiteRoutes(links: { href: string; text?: string }[], pageUrl: string): RouteCollection {
  const base = new URL(pageUrl);
  const routes: SiteRoute[] = [];
  const excluded: ExcludedRoute[] = [];
  const byPattern = new Map<string, SiteRoute>();
  const seenExcluded = new Set<string>();

  const add = (href: string, text: string, isCurrent = false) => {
    let u: URL;
    try {
      u = new URL(href, base);
    } catch (_e) {
      return;
    }
    if (!/^https?:$/.test(u.protocol) || u.origin !== base.origin) return; // otros sitios: no
    u.hash = '';
    const path = decodeURIComponent(u.pathname + u.search);
    if (NOT_A_VIEW.test(u.pathname)) return;
    if (DANGEROUS.test(path)) {
      if (!seenExcluded.has(path)) {
        seenExcluded.add(path);
        excluded.push({ url: u.href, path, reason: 'puede ejecutar una acción con tu sesión' });
      }
      return;
    }
    const pattern = routePattern(u);
    const existing = byPattern.get(pattern);
    if (existing) {
      if (existing.url !== u.href) existing.grouped++;
      if (!existing.label && text) existing.label = text;
      return;
    }
    const route: SiteRoute = {
      url: u.href,
      path: pattern.includes('{') ? pattern : path || '/',
      label: (text || '').replace(/\s+/g, ' ').trim().slice(0, 60) || (isCurrent ? 'Página actual' : ''),
      grouped: 1,
    };
    byPattern.set(pattern, route);
    routes.push(route);
  };

  add(pageUrl, '', true);
  for (const l of links) add(l.href, l.text || '');
  return { routes, excluded };
}

/** <loc> de un sitemap.xml (texto) */
export function parseSitemap(xml: string): string[] {
  return [...String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 2000);
}
