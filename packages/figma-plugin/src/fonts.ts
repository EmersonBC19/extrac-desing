/**
 * Fuentes: caché de fuentes disponibles, equivalencias de peso y carga segura (Inter como respaldo).
 */
import type { UINode } from './types';
import { errText, log } from './log';

// Cache de fuentes disponibles en el entorno Figma del usuario
export let availableFontsCache: Font[] | null = null;

export const fontLookupMap: Map<string, FontName[]> = new Map();

/** Olvidar la lista de fuentes: una fuente instalada (o reparada) después se usa en el siguiente render */
export function refreshFontCache(): void {
  availableFontsCache = null;
  fontLookupMap.clear();
  fontResolutionCache.clear();
  renderProbeCache.clear();
}

// ── Fuentes que Figma lista y "carga" pero no puede dibujar ────────────────────────────────
// Visto en Figma real con SF Pro instalada en Windows: listAvailableFontsAsync la ofrece y
// loadFontAsync no falla, pero el texto se queda en 0×15 px (el tamaño de un texto vacío) y no se
// pinta: desaparecían todos los textos de apple.com. Por eso cada fuente elegida se prueba una vez
// con un texto temporal antes de usarla.
const fkey = (f: FontName) => f.family + '|' + f.style;
const renderProbeCache = new Map<string, boolean>();
const unrenderableFonts = new Set<string>();
/** Inter viene con Figma: siempre dibuja y es el respaldo final, no se prueba */
const isBundledFallback = (f: FontName) => f.family === 'Inter';

/** ¿Figma maqueta texto con esta fuente (ya cargada)? */
export function fontRenders(font: FontName): boolean {
  if (isBundledFallback(font)) return true;
  const key = fkey(font);
  const cached = renderProbeCache.get(key);
  if (cached !== undefined) return cached;
  let ok = true;
  let probe: TextNode | null = null;
  try {
    probe = figma.createText();
    probe.fontName = font;
    probe.fontSize = 24;
    probe.characters = 'Hxg';
    probe.textAutoResize = 'WIDTH_AND_HEIGHT';
    // Una fuente que funciona da algo de ancho y un alto cercano al cuerpo (24 px);
    // la rota deja el tamaño de un texto vacío (0 × ~15)
    ok = probe.width >= 1 && probe.height >= 18;
  } catch (_e) {
    ok = false;
  } finally {
    try {
      probe?.remove();
    } catch (_e) {}
  }
  if (!ok) markFontUnrenderable(font);
  else renderProbeCache.set(key, true);
  return ok;
}

/** Descarta una fuente para el resto del render (y olvida las resoluciones que la elegían) */
export function markFontUnrenderable(font: FontName): void {
  const key = fkey(font);
  renderProbeCache.set(key, false);
  unrenderableFonts.add(`${font.family} ${font.style}`);
  for (const [k, v] of fontResolutionCache) if (fkey(v) === key) fontResolutionCache.delete(k);
}

/** Fuentes instaladas que Figma no pudo dibujar en este render ("Familia Estilo") */
export function getUnrenderableFonts(): string[] {
  return Array.from(unrenderableFonts);
}

export async function initFontCache(): Promise<void> {
  if (availableFontsCache && fontLookupMap.size > 0) return;
  try {
    if (typeof figma.listAvailableFontsAsync === 'function') {
      availableFontsCache = await figma.listAvailableFontsAsync();
      fontLookupMap.clear();
      for (const f of availableFontsCache) {
        const famLower = f.fontName.family.toLowerCase();
        if (!fontLookupMap.has(famLower)) {
          fontLookupMap.set(famLower, []);
        }
        fontLookupMap.get(famLower)!.push(f.fontName);
      }
    }
  } catch (err) {
    log.warn('No se pudo obtener la lista de fuentes disponibles', { error: errText(err) });
  }
}

// Normalizador seguro de fuentes tipográficas para Figma con preservación de peso y soporte Apple/Windows/Web
export function resolveFontWeight(weight: number | string): string {
  const num = typeof weight === 'string' ? parseInt(weight, 10) : weight;
  if (isNaN(num)) {
    const lower = String(weight).toLowerCase();
    if (lower.includes('black') || lower.includes('900')) return 'Black';
    if ((lower.includes('extra') && lower.includes('bold')) || lower.includes('800')) return 'Extra Bold';
    if (lower.includes('bold') || lower.includes('700')) return 'Bold';
    if (lower.includes('semibold') || lower.includes('semi-bold') || lower.includes('600')) return 'Semi Bold';
    if (lower.includes('medium') || lower.includes('500')) return 'Medium';
    if (lower.includes('light') || lower.includes('300')) return 'Light';
    if (lower.includes('thin') || lower.includes('100')) return 'Thin';
    return 'Regular';
  }
  if (num >= 900) return 'Black';
  if (num >= 800) return 'Extra Bold';
  if (num >= 700) return 'Bold';
  if (num >= 600) return 'Semi Bold';
  if (num >= 500) return 'Medium';
  if (num >= 400) return 'Regular';
  if (num >= 300) return 'Light';
  return 'Regular';
}

// ── Familias candidatas (fase 5.3) ────────────────────────────────────────────────────────
// La web declara una pila (font-family: "Circular", -apple-system, Helvetica, sans-serif) y el
// navegador usa la primera que tiene. Aquí se hace lo mismo con las fuentes que Figma conoce:
// se recorre la pila completa (antes solo la primera familia, y luego directo a Inter).

/** Familias genéricas de CSS → familias reales habituales, en orden de preferencia */
const GENERIC_FAMILIES: Record<string, string[]> = {
  'system-ui': ['SF Pro Text', 'SF Pro Display', 'SF Pro', 'Segoe UI', 'Roboto', 'Inter'],
  '-apple-system': ['SF Pro Text', 'SF Pro Display', 'SF Pro', 'Segoe UI', 'Inter'],
  blinkmacsystemfont: ['SF Pro Text', 'SF Pro Display', 'SF Pro', 'Segoe UI', 'Inter'],
  'ui-sans-serif': ['SF Pro Text', 'Segoe UI', 'Roboto', 'Inter'],
  'sans-serif': ['Inter', 'Helvetica Neue', 'Arial', 'Roboto'],
  serif: ['Georgia', 'Times New Roman', 'Noto Serif', 'Source Serif Pro'],
  'ui-serif': ['New York', 'Georgia', 'Times New Roman'],
  monospace: ['SF Mono', 'Menlo', 'Consolas', 'Roboto Mono', 'JetBrains Mono', 'Courier New'],
  'ui-monospace': ['SF Mono', 'Menlo', 'Consolas', 'Roboto Mono', 'Courier New'],
};

/** Equivalencias por defecto de familias comerciales/web que rara vez están instaladas */
export const DEFAULT_FONT_EQUIVALENTS: Record<string, string[]> = {
  'sf pro': ['SF Pro Display', 'SF Pro Text', 'Inter'],
  'sf pro display': ['SF Pro', 'Inter'],
  'sf pro text': ['SF Pro', 'Inter'],
  helvetica: ['Helvetica Neue', 'Arial'],
  'helvetica neue': ['Helvetica', 'Arial'],
  circular: ['Inter'],
  'circular std': ['Inter'],
  'proxima nova': ['Montserrat', 'Inter'],
  gotham: ['Montserrat', 'Inter'],
  avenir: ['Avenir Next', 'Nunito Sans', 'Inter'],
  'avenir next': ['Avenir', 'Nunito Sans', 'Inter'],
  'segoe ui': ['Inter', 'Roboto'],
};

const cleanFamily = (f: string) => f.replace(/['"]/g, '').trim();
export const isGenericFamily = (f: string) => Object.prototype.hasOwnProperty.call(GENERIC_FAMILIES, f.toLowerCase());

/** Equivalencias definidas por el usuario en los ajustes del plugin (familia web → familia Figma) */
let userFontMap: Record<string, string> = {};
export function setUserFontMap(map: unknown): void {
  userFontMap = {};
  if (map && typeof map === 'object') {
    for (const [from, to] of Object.entries(map as Record<string, unknown>)) {
      if (typeof to === 'string' && to.trim()) userFontMap[cleanFamily(from).toLowerCase()] = cleanFamily(to);
    }
  }
  fontResolutionCache.clear();
}

/** Orden en que se prueban las familias para una pila CSS (sin repetir) */
export function fontCandidates(
  fontFamily: string | undefined,
  userMap: Record<string, string> = userFontMap,
): string[] {
  const stack = String(fontFamily || 'Inter')
    .split(',')
    .map(cleanFamily)
    .filter(Boolean);
  const out: string[] = [];
  const add = (f: string) => {
    if (f && !out.some(x => x.toLowerCase() === f.toLowerCase())) out.push(f);
  };
  for (const fam of stack) {
    const key = fam.toLowerCase();
    if (userMap[key]) add(userMap[key]); // lo que el usuario eligió va primero
    if (isGenericFamily(fam)) GENERIC_FAMILIES[key].forEach(add);
    else add(fam);
    // Su equivalencia más parecida, antes de pasar a la siguiente familia de la pila
    (DEFAULT_FONT_EQUIVALENTS[key] || []).forEach(add);
  }
  ['Inter', 'Roboto', 'Arial'].forEach(add);
  return out;
}

// ── Reporte de sustituciones ──────────────────────────────────────────────────────────────
export interface FontSubstitution {
  requested: string;
  used: string;
  texts: number;
}
const substitutions = new Map<string, FontSubstitution>();
export function resetFontReport(): void {
  substitutions.clear();
  unrenderableFonts.clear();
}
export function getFontReport(): FontSubstitution[] {
  return Array.from(substitutions.values()).sort((a, b) => b.texts - a.texts);
}

/** Contar en el reporte la fuente con la que quedó finalmente un texto */
export function trackFontUse(fontFamily: string | undefined, used: FontName): void {
  recordUse(fontFamily, used);
}

function recordUse(fontFamily: string | undefined, used: FontName) {
  const stack = String(fontFamily || '')
    .split(',')
    .map(cleanFamily)
    .filter(Boolean);
  const requested = stack.find(f => !isGenericFamily(f)) || stack[0];
  if (!requested || requested.toLowerCase() === used.family.toLowerCase()) return;
  const key = requested.toLowerCase() + '→' + used.family.toLowerCase();
  const entry = substitutions.get(key) || { requested, used: used.family, texts: 0 };
  entry.texts++;
  substitutions.set(key, entry);
}

/** Resoluciones ya hechas (familia|peso → fuente): una página grande pide la misma miles de veces */
const fontResolutionCache = new Map<string, FontName>();

/**
 * Carga la fuente más fiel disponible en Figma para una pila CSS y un peso.
 * track: contar el uso en el reporte de sustituciones (solo al dibujar textos, no al precargar).
 */
export async function loadFontSafely(
  fontFamily: string,
  fontWeight: number | string,
  options: { track?: boolean; italic?: boolean } = {},
): Promise<FontName> {
  const italic = Boolean(options.italic);
  const cacheKey = `${fontFamily}|${fontWeight}${italic ? '|I' : ''}`;
  let font = fontResolutionCache.get(cacheKey);
  if (!font) {
    font = await resolveFont(fontFamily, fontWeight, italic);
    fontResolutionCache.set(cacheKey, font);
  }
  if (options.track) recordUse(fontFamily, font);
  return font;
}

async function resolveFont(fontFamily: string, fontWeight: number | string, italic = false): Promise<FontName> {
  // Asegurar siempre Inter Regular en memoria primero para que figma.createText() nunca falle
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  } catch (_e) {}

  await initFontCache();

  const targetStyle = resolveFontWeight(fontWeight);
  const candidates = fontCandidates(fontFamily);

  // Variantes de ortografía del estilo tipográfico
  const baseVariants: string[] = [targetStyle];
  if (targetStyle === 'Semi Bold') baseVariants.push('Semibold', 'Semi-Bold', 'Demibold');
  else if (targetStyle === 'Extra Bold') baseVariants.push('Extrabold', 'Extra-Bold');
  const styleVariants: string[] = italic
    ? [
        ...baseVariants.flatMap(st =>
          st === 'Regular' ? ['Italic', 'Oblique'] : [`${st} Italic`, `${st}Italic`, `${st} Oblique`],
        ),
        'Italic',
        'Oblique',
        ...baseVariants,
      ]
    : [...baseVariants];
  if (!styleVariants.includes('Regular')) styleVariants.push('Regular');

  /** Cargada y capaz de dibujar (las que Figma no maqueta se saltan: ver fontRenders) */
  const usable = async (f: FontName): Promise<boolean> => {
    if (renderProbeCache.get(fkey(f)) === false) return false;
    try {
      await figma.loadFontAsync(f);
    } catch (_e) {
      return false;
    }
    return fontRenders(f);
  };

  // Con el mapa de fuentes de Figma: la primera candidata que existe y dibuja, con el estilo más cercano
  if (fontLookupMap.size > 0) {
    for (const cand of candidates) {
      const availableStyles = fontLookupMap.get(cand.toLowerCase());
      if (availableStyles && availableStyles.length > 0) {
        // 1. Coincidencia exacta con el estilo / peso deseado
        for (const wantStyle of styleVariants) {
          const match = availableStyles.find(s => s.style.toLowerCase() === wantStyle.toLowerCase());
          if (match && (await usable(match))) return match;
        }
        // 2. Si no está ese estilo, Regular o el primero disponible
        const regularMatch = availableStyles.find(s => s.style.toLowerCase() === 'regular') || availableStyles[0];
        if (await usable(regularMatch)) return regularMatch;
      }
    }
  }

  // Fallbacks universales garantizados
  const interFallback = italic
    ? [targetStyle === 'Regular' ? 'Italic' : `${targetStyle} Italic`, 'Italic', targetStyle, 'Regular']
    : [targetStyle, 'Regular'];
  for (const st of interFallback) {
    try {
      const f: FontName = { family: 'Inter', style: st };
      await figma.loadFontAsync(f);
      return f;
    } catch (_e) {}
  }

  return { family: 'Inter', style: 'Regular' };
}

// Optimización: Pre-calentamiento / carga por lote de todas las fuentes del árbol en paralelo
export async function prewarmFonts(node: UINode): Promise<void> {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  } catch (_e) {}

  await initFontCache();

  const fontsToLoad = new Set<string>();
  function traverse(n: UINode) {
    if (n.type === 'TEXT' && n.textData) {
      const fam = n.textData.fontStack || n.textData.fontFamily || 'Inter';
      const weight = n.textData.fontWeight || 400;
      fontsToLoad.add(`${fam}:::${weight}`);
    }
    if (n.children) {
      for (const child of n.children) traverse(child);
    }
  }
  traverse(node);

  await Promise.all(
    Array.from(fontsToLoad).map(async key => {
      const [family, weight] = key.split(':::');
      await loadFontSafely(family, weight);
    }),
  );
}
