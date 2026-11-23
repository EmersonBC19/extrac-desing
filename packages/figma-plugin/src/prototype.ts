/**
 * Prototipo de los estados: al pasar el ratón por la variante
 * State=Default, Figma cambia a State=Hover con Smart Animate, con la duración y la curva de la
 * transición CSS real. En el modo presentación, el componente se comporta como en la web.
 */

export interface CssTransition {
  durationMs: number;
  easing: string;
}

/** Sin transición CSS: lo habitual en interfaces */
export const DEFAULT_HOVER: CssTransition = { durationMs: 300, easing: 'ease-out' };

/** Curvas de CSS con nombre → cúbica de Bézier (la definición del estándar) */
const NAMED_BEZIER: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
};
const NAMED_FIGMA: Record<string, Easing['type']> = {
  'ease-in': 'EASE_IN',
  'ease-out': 'EASE_OUT',
  'ease-in-out': 'EASE_IN_AND_OUT',
  linear: 'LINEAR',
};

/**
 * Curva CSS → Easing de Figma. null = cambio instantáneo (steps(), step-start/end: CSS no
 * interpola entre los dos estados, así que tampoco lo hace Figma).
 */
export function cssEasingToFigma(css: string): Easing | null {
  const e = String(css || 'ease')
    .trim()
    .toLowerCase();
  if (/^steps?\b|^step-(start|end)$/.test(e)) return null;
  if (NAMED_FIGMA[e]) return { type: NAMED_FIGMA[e] };
  // linear(…) con puntos: Figma no lo tiene; lo más parecido es lineal
  if (e.startsWith('linear(')) return { type: 'LINEAR' };
  let bezier = NAMED_BEZIER[e];
  const m = e.match(/^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/);
  if (m) bezier = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number];
  if (bezier && bezier.every(v => isFinite(v))) {
    // Las x de una cúbica de tiempo van de 0 a 1 (CSS las rechaza fuera de ese rango)
    const [x1, y1, x2, y2] = bezier;
    return {
      type: 'CUSTOM_CUBIC_BEZIER',
      easingFunctionCubicBezier: {
        x1: Math.min(1, Math.max(0, x1)),
        y1,
        x2: Math.min(1, Math.max(0, x2)),
        y2,
      },
    };
  }
  return { type: 'EASE_OUT' };
}

/** Transición de Figma (duración en segundos) o null si el cambio es instantáneo */
export function smartAnimateFrom(t: CssTransition | null | undefined): Transition | null {
  const css = t && t.durationMs > 0 ? t : t ? null : DEFAULT_HOVER;
  if (!css) return null; // transition: 0s → instantáneo, como en la web
  const easing = cssEasingToFigma(css.easing);
  if (!easing) return null;
  const duration = Math.min(10, Math.max(0.01, Math.round(css.durationMs) / 1000));
  return { type: 'SMART_ANIMATE', easing, duration };
}

/** "Al pasar el ratón → cambiar a <destino>" (en variantes, Figma vuelve solo al salir) */
export function hoverReaction(destinationId: string, t: CssTransition | null | undefined): Reaction {
  return {
    trigger: { type: 'ON_HOVER' },
    actions: [
      {
        type: 'NODE',
        destinationId,
        navigation: 'CHANGE_TO',
        transition: smartAnimateFrom(t),
        resetVideoPosition: false,
      },
    ],
  };
}
