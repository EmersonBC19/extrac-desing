/**
 * Capturas de pantalla de regiones fuera de la vista (plan de mejoras, fase 5.2).
 *
 * Lo que el DOM no puede entregar (video, WebGL, iframes, imágenes protegidas) se recorta de una
 * captura de la pestaña, y la pestaña solo captura lo visible. Antes, lo que quedaba fuera de la
 * pantalla al extraer una página larga se perdía. Ahora se recorre la página por franjas:
 *  - primero lo visible, sin mover nada;
 *  - después, franja por franja: scroll, captura, siguiente. Chrome permite 2 capturas por
 *    segundo (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND): se respeta un intervalo mínimo;
 *  - mientras tanto se ocultan los elementos fixed/sticky (headers, banners de cookies) para que
 *    no tapen lo capturado; al terminar todo vuelve a su sitio, incluido el scroll.
 */
import type { VpRect } from './types';

export type CaptureFn = (rects: VpRect[]) => Promise<Array<string | null>>;

export interface CaptureOptions {
  /** Intervalo mínimo entre capturas (ms) */
  minIntervalMs?: number;
  /** Máximo de franjas fuera de la vista (acota el tiempo en páginas enormes) */
  maxBands?: number;
  /** Espera tras cada scroll para que el navegador pinte (ms) */
  settleMs?: number;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

const intersects = (a: VpRect, b: VpRect) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** Oculta los fixed/sticky que no contienen ninguna de las regiones; devuelve cómo restaurarlos */
function hideFloatingElements(keep: VpRect[]): () => void {
  const hidden: Array<[HTMLElement, string, string]> = [];
  for (const el of Array.from(document.body ? document.body.querySelectorAll<HTMLElement>('*') : [])) {
    const pos = getComputedStyle(el).position;
    if (pos !== 'fixed' && pos !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    if (keep.some(k => intersects(rect, k))) continue;
    hidden.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
    el.style.setProperty('visibility', 'hidden', 'important');
  }
  return () => {
    for (const [el, value, priority] of hidden) {
      if (value) el.style.setProperty('visibility', value, priority);
      else el.style.removeProperty('visibility');
    }
  };
}

/**
 * Captura cada región (coordenadas de la vista en el momento de la extracción).
 * Devuelve un dataURL por región, o null si no se pudo.
 */
export async function captureRegionsAcrossPage(
  rects: VpRect[],
  capture: CaptureFn,
  options: CaptureOptions = {},
): Promise<Array<string | null>> {
  const { minIntervalMs = 600, maxBands = 20, settleMs = 120 } = options;
  const out: Array<string | null> = rects.map(() => null);
  if (!rects.length) return out;

  const vh = window.innerHeight;
  const startX = window.scrollX;
  const startY = window.scrollY;
  let lastShot = 0;
  const shoot = async (idx: number[], shifted: VpRect[]) => {
    const wait = lastShot + minIntervalMs - Date.now();
    if (lastShot && wait > 0) await sleep(wait);
    lastShot = Date.now();
    const crops = (await capture(shifted)) || [];
    idx.forEach((i, k) => {
      out[i] = crops[k] || null;
    });
  };

  // 1) Lo visible ahora: una captura, sin mover la página
  const visible: number[] = [];
  const offscreen: number[] = [];
  rects.forEach((r, i) => (r.top < vh && r.top + r.height > 0 ? visible : offscreen).push(i));
  if (visible.length)
    await shoot(
      visible,
      visible.map(i => rects[i]),
    );
  if (!offscreen.length) return out;

  // 2) Lo de fuera: franja por franja, en orden de arriba a abajo
  const docTop = (i: number) => rects[i].top + startY;
  const pending = offscreen.slice().sort((a, b) => docTop(a) - docTop(b));
  const restoreFloating = hideFloatingElements(offscreen.map(i => rects[i]));
  try {
    let bands = 0;
    while (pending.length && bands < maxBands) {
      bands++;
      const target = Math.max(0, docTop(pending[0]) - 16);
      window.scrollTo({ left: startX, top: target, behavior: 'instant' as ScrollBehavior });
      await nextFrame();
      await sleep(settleMs);
      const y = window.scrollY; // puede quedar antes del objetivo al final de la página
      const band = pending.filter(i => docTop(i) >= y - 1 && docTop(i) < y + vh);
      if (!band.length) break; // no se pudo llegar (la página cambió de alto): no insistir
      await shoot(
        band,
        band.map(i => ({ ...rects[i], top: docTop(i) - y })),
      );
      for (const i of band) pending.splice(pending.indexOf(i), 1);
    }
  } finally {
    restoreFloating();
    window.scrollTo({ left: startX, top: startY, behavior: 'instant' as ScrollBehavior });
    await nextFrame();
  }
  return out;
}
