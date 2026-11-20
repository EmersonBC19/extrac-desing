/**
 * Detección DOM: carruseles, imágenes de fondo, contenido oculto, pseudo-elementos, canvas.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
import type { VpRect } from './types';

export const CLIPPING_OVERFLOW = /^(hidden|clip|auto|scroll)$/;

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
 * Patrón accesible "visually hidden" / "sr-only": elemento absoluto de ~1px recortado con
 * clip / clip-path. Existe en el DOM para lectores de pantalla pero no se pinta.
 */
export function isVisuallyHidden(cs: CSSStyleDeclaration, rect: DOMRect) {
  if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
  if (rect.width <= 2 && rect.height <= 2) return true;
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
