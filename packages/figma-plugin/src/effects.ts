/**
 * Efectos CSS con equivalente en Figma (plan de mejoras, fase 5.4): sombras (box-shadow,
 * filter: drop-shadow, text-shadow), desenfoques (filter: blur, backdrop-filter) y modos de fusión.
 */
const BLEND_MODES = new Set([
  'MULTIPLY',
  'SCREEN',
  'OVERLAY',
  'DARKEN',
  'LIGHTEN',
  'COLOR_DODGE',
  'COLOR_BURN',
  'HARD_LIGHT',
  'SOFT_LIGHT',
  'DIFFERENCE',
  'EXCLUSION',
  'HUE',
  'SATURATION',
  'COLOR',
  'LUMINOSITY',
  'LINEAR_DODGE',
  'LINEAR_BURN',
]);

interface CssShadow {
  color: { r: number; g: number; b: number; a?: number };
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
}

const dropShadow = (s: CssShadow, withSpread: boolean): DropShadowEffect => ({
  type: 'DROP_SHADOW',
  color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== undefined ? s.color.a : 1 },
  offset: { x: s.offset.x, y: s.offset.y },
  radius: Math.max(0, s.radius),
  spread: withSpread ? s.spread || 0 : 0,
  visible: true,
  blendMode: 'NORMAL',
});

/** Efectos de un nodo a partir de sus estilos extraídos */
export function effectsFromStyles(styles: any, kind: 'FRAME' | 'TEXT'): Effect[] {
  const effects: Effect[] = [];
  if (!styles) return effects;
  if (kind === 'FRAME') {
    for (const s of styles.boxShadow || []) effects.push(dropShadow(s, true));
    for (const s of styles.dropShadows || []) effects.push(dropShadow(s, false));
    if (typeof styles.backdropBlur === 'number' && styles.backdropBlur > 0) {
      effects.push({ type: 'BACKGROUND_BLUR', radius: Math.max(1, styles.backdropBlur), visible: true } as Effect);
    }
  } else {
    // text-shadow: Figma no tiene spread para textos
    for (const s of styles.textShadow || []) effects.push(dropShadow(s, false));
  }
  if (typeof styles.layerBlur === 'number' && styles.layerBlur > 0) {
    effects.push({ type: 'LAYER_BLUR', radius: styles.layerBlur, visible: true } as Effect);
  }
  return effects;
}

/** Modo de fusión de Figma, si el CSS tenía uno distinto de normal */
export function blendModeFromStyles(styles: any): BlendMode | null {
  const m = styles && typeof styles.blendMode === 'string' ? styles.blendMode : '';
  return BLEND_MODES.has(m) ? (m as BlendMode) : null;
}
