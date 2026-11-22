/**
 * Detección DOM: carruseles, imágenes de fondo, contenido oculto, pseudo-elementos, canvas.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
import type { VpRect } from './types';

export const CLIPPING_OVERFLOW = /^(hidden|clip|auto|scroll)$/;

/**
 * ¿El elemento no genera caja? Con `display: contents` (y los <slot>, que lo son por defecto) el
 * navegador coloca sus hijos como si fueran del padre: no tiene tamaño (getBoundingClientRect da 0×0
 * en la esquina de la ventana), ni fondo, ni recorte. Tratarlo como un frame lo dejaba en Figma de
 * 1 px, fuera de su sitio y recortando a sus hijos (las tarjetas de un visor desaparecían).
 */
export function isBoxless(el: Element): boolean {
  return window.getComputedStyle(el).display === 'contents';
}

/** Hijos que generan caja: cada hijo sin caja se sustituye por los suyos (recursivo) */
export function boxChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(el.children)) {
    if (isBoxless(c)) out.push(...boxChildren(c));
    else out.push(c);
  }
  return out;
}

/**
 * ¿El elemento es una slide de carrusel/galería fuera del viewport?
 * Lo es si algún ancestro (que no sea html/body) recorta o hace scroll en X,
 * y no está absurdamente lejos (carruseles "infinitos" con cientos de clones).
 */
export function isCarouselSlide(el: Element, rect: DOMRect, vpW: number) {
  if (Math.abs(rect.left) > vpW * 25) return false;
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const cs = window.getComputedStyle(p);
    if (CLIPPING_OVERFLOW.test(cs.overflowX)) return true;
    if (cs.position === 'fixed') return false; // menús off-canvas, no carruseles
    p = p.parentElement;
  }
  return false;
}

/** ¿Los hijos de este contenedor se salen horizontalmente de él? (pista/track de carrusel) */
export function isCarouselTrack(el: Element, rect: DOMRect, children: ArrayLike<Element> & Iterable<Element>) {
  if (children.length < 2) return false;
  let outside = 0;
  for (const ch of children) {
    const r = ch.getBoundingClientRect();
    if (r.width <= 0) continue;
    if (r.right <= rect.left + 2 || r.left >= rect.right - 2) outside++;
  }
  if (outside === 0) return false;
  // El propio track o un ancestro cercano debe recortar
  let p: Element | null = el;
  for (let i = 0; p && i < 6; i++, p = p.parentElement) {
    if (CLIPPING_OVERFLOW.test(window.getComputedStyle(p).overflowX)) return true;
  }
  return false;
}

/** Extrae la URL de la primera capa url()/image-set() de un background-image CSS. */
export function extractBgUrl(bgStr: string | null | undefined) {
  if (!bgStr || bgStr === 'none' || (!bgStr.includes('url(') && !/image-set\(/i.test(bgStr))) return null;
  // image-set(url(a) 1x, url(b) 2x) → preferir la de mayor densidad
  if (/image-set\(/i.test(bgStr)) {
    const opts = [...bgStr.matchAll(/(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([\d.]+)x/gi)].map(m => ({
      url: m[1] || m[2],
      d: parseFloat(m[3]) || 1,
    }));
    if (opts.length) {
      opts.sort((a, b) => b.d - a.d);
      return opts[0].url;
    }
  }
  const m = bgStr.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
  if (!m || !m[2]) return null;
  const u = m[2];
  // Placeholders transparentes 1x1 de lazy-loaders
  if (/^data:image\/gif/i.test(u)) return null;
  return u;
}

/**
 * ¿Algo visible cuelga de este elemento diminuto? Un descendiente (hasta 3 niveles) o un
 * pseudo-elemento con caja propia, visible y opaco.
 */
function hasVisibleOverflow(element: Element): boolean {
  const visibleBox = (cs: CSSStyleDeclaration, w: number, h: number) =>
    w > 4 && h > 4 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
  for (const p of ['::before', '::after']) {
    const ps = window.getComputedStyle(element, p);
    if (ps.content && ps.content !== 'none' && ps.content !== 'normal') {
      if (visibleBox(ps, parseFloat(ps.width) || 0, parseFloat(ps.height) || 0)) return true;
    }
  }
  let level: Element[] = Array.from(element.children);
  for (let depth = 0; depth < 3 && level.length; depth++) {
    const next: Element[] = [];
    for (const c of level.slice(0, 40)) {
      const r = c.getBoundingClientRect();
      if (visibleBox(window.getComputedStyle(c), r.width, r.height)) return true;
      next.push(...Array.from(c.children));
    }
    level = next;
  }
  return false;
}

/**
 * Patrón accesible "visually hidden" / "sr-only": elemento absoluto de ~1px recortado con
 * clip / clip-path. Existe en el DOM para lectores de pantalla pero no se pinta.
 */
export function isVisuallyHidden(cs: CSSStyleDeclaration, rect: DOMRect, element?: Element) {
  if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
  if (rect.width <= 2 && rect.height <= 2) {
    // Un punto de anclaje de 0×0 (marcadores y hotspots sobre un visor: `left: 42%; top: 55%` con el
    // círculo como hijo absoluto o pseudo-elemento) no está oculto si lo que cuelga de él se ve.
    // El sr-only de verdad recorta (overflow hidden / clip): ese sigue fuera.
    const clips =
      CLIPPING_OVERFLOW.test(cs.overflowX) ||
      CLIPPING_OVERFLOW.test(cs.overflowY) ||
      /rect\(/.test(cs.clip || '') ||
      (!!cs.clipPath && cs.clipPath !== 'none');
    return clips || !element || !hasVisibleOverflow(element);
  }
  // "Saltar al contenido" y similares: escondidos fuera del documento hasta recibir foco
  const sy = cs.position === 'fixed' ? 0 : window.scrollY;
  const sx = cs.position === 'fixed' ? 0 : window.scrollX;
  if (rect.bottom + sy <= 0 || rect.right + sx <= 0) return true;
  const clip = cs.clip || '';
  const m = clip.match(/rect\(\s*([-\d.]+)px,?\s*([-\d.]+)px,?\s*([-\d.]+)px,?\s*([-\d.]+)px/);
  if (m) {
    const [top, right, bottom, left] = m.slice(1).map(parseFloat);
    if (right - left <= 1 || bottom - top <= 1) return true;
  }
  const cp = cs.clipPath || '';
  if (/inset\(\s*50%/.test(cp) || /99\.9%/.test(cp)) return true;
  return false;
}

// ── Texto enriquecido (técnica allInline de swarm-rebuild + saltos de línea reales) ──

/** ¿El pseudo-elemento se renderiza y lleva una imagen de fondo? */
export function pseudoHasImage(el: Element, pseudo: string) {
  try {
    const cs = window.getComputedStyle(el, pseudo);
    const c = cs.content;
    return !!(c && c !== 'none' && c !== 'normal' && cs.display !== 'none' && extractBgUrl(cs.backgroundImage));
  } catch (_) {
    return false;
  }
}

/** background-size / repeat CSS → scaleMode de Figma */
export function bgScaleMode(cs: CSSStyleDeclaration) {
  const size = (cs.backgroundSize || '').toLowerCase();
  if (size.includes('contain')) return 'FIT';
  if (size.includes('cover')) return 'FILL';
  const rep = (cs.backgroundRepeat || '').toLowerCase();
  if (rep && !rep.includes('no-repeat') && (size === 'auto' || /\d+px/.test(size))) return 'TILE';
  return 'FILL';
}

/** Rect del viewport (para recortar desde captura de pantalla si la descarga falla). */
export function vpRectOf(rect: DOMRect): VpRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** Lee píxeles de un canvas; null si está vacío (WebGL sin preserveDrawingBuffer) o "tainted". */
export function canvasPixels(el: HTMLCanvasElement) {
  try {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 12;
    const g = probe.getContext('2d')!; // un canvas nuevo siempre da contexto 2d
    g.drawImage(el, 0, 0, 12, 12);
    const d = g.getImageData(0, 0, 12, 12).data;
    let a = 0;
    for (let i = 3; i < d.length; i += 4) a += d[i];
    return a > 0 ? el.toDataURL('image/png') : null;
  } catch (_) {
    return null;
  }
}

/** ¿Algún ancestro (no la página) tiene su propio scroll desplazado? */
export function hasScrolledAncestor(el: Element): boolean {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    if (p.scrollTop > 0 || p.scrollLeft > 0) {
      const oy = window.getComputedStyle(p).overflowY;
      if (/(auto|scroll|hidden|overlay)/.test(oy)) return true;
    }
  }
  return false;
}

/**
 * Posición de un elemento sticky como si no estuviera pegado: se mide con `position: static`
 * en una lectura sincrónica y se restaura en el acto (el navegador no llega a pintar el cambio).
 */
export function naturalRectOfSticky(el: Element): DOMRect | null {
  const s = (el as HTMLElement).style;
  if (!s) return null;
  const value = s.getPropertyValue('position');
  const priority = s.getPropertyPriority('position');
  try {
    s.setProperty('position', 'static', 'important');
    return el.getBoundingClientRect();
  } catch (_e) {
    return null;
  } finally {
    if (value) s.setProperty('position', value, priority);
    else s.removeProperty('position');
  }
}
