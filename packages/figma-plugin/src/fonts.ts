/**
 * Fuentes: caché de fuentes disponibles, equivalencias de peso y carga segura (Inter como respaldo).
 */
import type { UINode } from './types';
import { errText, log } from './log';

// Cache de fuentes disponibles en el entorno Figma del usuario
export let availableFontsCache: Font[] | null = null;

export const fontLookupMap: Map<string, FontName[]> = new Map();

/** Olvidar la lista de fuentes: una fuente instalada después se usa en el siguiente render */
export function refreshFontCache(): void {
  availableFontsCache = null;
  fontLookupMap.clear();
  fontResolutionCache.clear();
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
}
export function getFontReport(): FontSubstitution[] {
  return Array.from(substitutions.values()).sort((a, b) => b.texts - a.texts);
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
  options: { track?: boolean } = {},
): Promise<FontName> {
  const cacheKey = fontFamily + '|' + fontWeight;
  let font = fontResolutionCache.get(cacheKey);
  if (!font) {
    font = await resolveFont(fontFamily, fontWeight);
    fontResolutionCache.set(cacheKey, font);
  }
  if (options.track) recordUse(fontFamily, font);
  return font;
}

async function resolveFont(fontFamily: string, fontWeight: number | string): Promise<FontName> {
  // Asegurar siempre Inter Regular en memoria primero para que figma.createText() nunca falle
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  } catch (_e) {}

  await initFontCache();

  const targetStyle = resolveFontWeight(fontWeight);
  const candidates = fontCandidates(fontFamily);

  // Variantes de ortografía del estilo tipográfico
  const styleVariants: string[] = [targetStyle];
  if (targetStyle === 'Semi Bold') styleVariants.push('Semibold', 'Semi-Bold', 'Demibold');
  else if (targetStyle === 'Extra Bold') styleVariants.push('Extrabold', 'Extra-Bold');
  if (!styleVariants.includes('Regular')) styleVariants.push('Regular');

  // Con el mapa de fuentes de Figma: la primera candidata que existe, con el estilo más cercano
  if (fontLookupMap.size > 0) {
    for (const cand of candidates) {
      const availableStyles = fontLookupMap.get(cand.toLowerCase());
      if (availableStyles && availableStyles.length > 0) {
        // 1. Coincidencia exacta con el estilo / peso deseado
        for (const wantStyle of styleVariants) {
          const match = availableStyles.find(s => s.style.toLowerCase() === wantStyle.toLowerCase());
          if (match) {
            try {
              await figma.loadFontAsync(match);
              return match;
            } catch (_e) {}
          }
        }
        // 2. Si no está ese estilo, Regular o el primero disponible
        const regularMatch = availableStyles.find(s => s.style.toLowerCase() === 'regular') || availableStyles[0];
        try {
          await figma.loadFontAsync(regularMatch);
          return regularMatch;
        } catch (_e) {}
      }
    }
  }

  // Fallbacks universales garantizados
  for (const st of [targetStyle, 'Regular']) {
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
