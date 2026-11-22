/**
 * Conversión recursiva de un elemento del DOM a UINode.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
import {
  CLIPPING_OVERFLOW,
  isCarouselSlide,
  isCarouselTrack,
  extractBgUrl,
  isVisuallyHidden,
  pseudoHasImage,
  bgScaleMode,
  vpRectOf,
  canvasPixels,
  hasScrolledAncestor,
  naturalRectOfSticky,
  isBoxless,
  boxChildren,
} from './dom-helpers';
import { isInlineTextRoot, buildRichText } from './text';
import { fitAutoLayoutToGeometry, pseudoPosition } from './geometry';
import { alignTableCell, splitTextAroundFloats } from './float-text';
import type { ExtractCounter, RawLayout, RawNode, Rgba } from './types';

// `element` es any: el extractor lee propiedades de muchos subtipos (img, video, input, select, slot…)
// según tagName; tiparlo exigiría reescribir cada rama con guardas.
export function extractNodeTree(
  element: any,
  counter: ExtractCounter = { id: 0 },
  parentRect: DOMRect | null = null,
  parentLayout: RawLayout | null = null,
): RawNode | null {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

  const tagName = element.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'template', 'link', 'meta', 'title', 'head'].includes(tagName)) {
    return null;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  // Texto solo para lectores de pantalla (.sr-only / .visuallyhidden): no es visible, no va a Figma
  if (parentRect !== null && isVisuallyHidden(style, rect, element)) return null;
  const vpW = window.innerWidth || 1440;
  const vpH = window.innerHeight || 900;
  const isRoot = parentRect === null;
  const isWholePage =
    isRoot && (element === document.body || element === document.documentElement || tagName === 'body');

  // Descartar elementos colapsados
  const isZeroClipped =
    rect.height <= 0.5 &&
    (style.overflow === 'hidden' || style.overflowY === 'hidden') &&
    (style.maxHeight === '0px' || style.height === '0px');
  if (isZeroClipped) return null;

  // Filtrado de elementos fuera de pantalla.
  // Excepción: slides de carruseles / galerías (dentro de un contenedor que recorta o hace scroll
  // horizontal). Se conservan para que en Figma estén todas las slides, recortadas como en la web.
  const margin = element.children.length === 0 ? 150 : 300;
  const isOffscreenX = rect.left >= vpW + margin || rect.right <= -margin;
  if (parentRect !== null && isOffscreenX) {
    if (!isCarouselSlide(element, rect, vpW)) return null;
    counter.hasCarouselSlides = true; // el frame raíz debe recortar como lo hace la web
  }
  if (element.children.length === 0) {
    // Elemento vacío colapsado (ej. <p> sin contenido con alto 0): no ocupa espacio en la web
    const hasText = !!(element.textContent && element.textContent.trim());
    const isReplaced = /^(img|picture|svg|video|canvas|iframe|input|textarea|select|hr)$/.test(tagName);
    const hasPseudo = ['::before', '::after'].some(p => {
      const c = window.getComputedStyle(element, p).content;
      return c && c !== 'none' && c !== 'normal';
    });
    if (!hasText && !isReplaced && !hasPseudo && (rect.width <= 0.5 || rect.height <= 0.5)) return null;
  }

  const currentId = 'node_' + ++counter.id;
  const relX = parentRect ? Math.round(rect.left - parentRect.left) : 0;
  let relY = parentRect ? Math.round(rect.top - parentRect.top) : 0;
  // Headers/banners fijos: el navegador los pinta respecto a la PANTALLA. Si se extrae con la página
  // desplazada, quedarían a mitad del documento. Se colocan donde estarían con la página arriba.
  if (parentRect && style.position === 'fixed' && window.scrollY > 0) {
    const parentEl = element.parentElement;
    const parentFixed = parentEl && window.getComputedStyle(parentEl).position === 'fixed';
    const parentDocTop = parentRect.top + window.scrollY;
    if (!parentFixed) relY = Math.round(rect.top - parentDocTop);
  }
  // Sticky "pegado" por el scroll de la PÁGINA (fase 5.7): la exportación muestra el documento desde
  // arriba, así que va en su posición natural. Si lo pega el scroll de un contenedor interno, ese
  // desplazamiento se conserva en la exportación y lo fiel es dejarlo donde se ve.
  if (parentRect && style.position === 'sticky' && window.scrollY > 0 && !hasScrolledAncestor(element)) {
    const natural = naturalRectOfSticky(element);
    if (natural) relY = Math.round(natural.top - parentRect.top);
  }

  // ── Helper para dividir valores CSS respetando paréntesis ──
  function splitCssList(str: string) {
    if (!str) return [];
    const parts = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  // ── Helper para Corner Radius (Border Radius) individual o uniforme ──
  function parseCornerRadius(elStyle: CSSStyleDeclaration): number | [number, number, number, number] {
    const rtl = Math.round(parseFloat(elStyle.borderTopLeftRadius) || 0);
    const rtr = Math.round(parseFloat(elStyle.borderTopRightRadius) || 0);
    const rbr = Math.round(parseFloat(elStyle.borderBottomRightRadius) || 0);
    const rbl = Math.round(parseFloat(elStyle.borderBottomLeftRadius) || 0);
    return rtl === rtr && rtr === rbr && rbr === rbl ? rtl : [rtl, rtr, rbr, rbl];
  }

  /**
   * Nombre local de una clase de CSS Modules. postcss-modules (Vite) genera `_local_hash_línea`
   * (_head_pgjsj_6 → head) o `_local_hash`; webpack/Next `Archivo_local__hash` (Header_title__a1B2c → title).
   */
  function localClassName(c: string): string {
    let m = c.match(/^_([A-Za-z][\w-]*?)_[a-z0-9]{5}(?:_\d+)?$/);
    if (m) return m[1];
    m = c.match(/^[A-Z][A-Za-z0-9]*_([A-Za-z][\w-]*?)__[A-Za-z0-9_-]{5}$/);
    if (m) return m[1];
    return c;
  }

  function hasAnyRadius(cr: number | [number, number, number, number] | undefined): boolean {
    if (cr === undefined) return false;
    if (typeof cr === 'number') return cr > 0;
    return Array.isArray(cr) && cr.some(v => v > 0);
  }

  // ── Helper para Transformación de Texto (uppercase, lowercase, capitalize) ──
  function transformText(str: string, tt: string | undefined): string {
    if (!str || !tt) return str;
    if (tt === 'uppercase') return str.toUpperCase();
    if (tt === 'lowercase') return str.toLowerCase();
    if (tt === 'capitalize') {
      // Inicio de palabra según Unicode (\b solo entiende ASCII: "acción" daba "AcciÓN");
      // el apóstrofo no abre palabra ("don't" → "Don't")
      return str.replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_m, pre, ch) => pre + ch.toUpperCase());
    }
    return str;
  }

  // ── Helper para Detección y Renderizado de Fuentes de Iconos (Material, FA, Lucide, PUA) ──
  function isIconFont(fontFamily: string, text: string, className?: string): boolean {
    const ff = (fontFamily || '').toLowerCase();
    const cls = (className || '').toLowerCase();
    if (
      /material[ -]icons|material[ -]symbols|font[ -]?awesome|dashicons|remixicon|lucide|tabler|bootstrap-icons|glyphicons/i.test(
        ff,
      ) ||
      /\b(material-icons|material-symbols|fa|fas|far|fal|fad|bi|tabler-icon|lucide)\b/i.test(cls)
    ) {
      return true;
    }
    const trimmed = (text || '').trim();
    if (
      trimmed.length > 0 &&
      trimmed.length <= 4 &&
      /^[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]+$/u.test(trimmed)
    ) {
      return true;
    }
    return false;
  }

  function renderIconFontToDataUrl(text: string, elStyle: CSSStyleDeclaration, w: number, h: number): string | null {
    try {
      const c = document.createElement('canvas');
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 2));
      const cw = Math.max(16, Math.round(w));
      const ch = Math.max(16, Math.round(h));
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.scale(dpr, dpr);
      ctx.font = `${elStyle.fontStyle || 'normal'} ${elStyle.fontWeight || '400'} ${elStyle.fontSize || '16px'} ${elStyle.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = elStyle.color || '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cw / 2, ch / 2);
      return c.toDataURL('image/png');
    } catch (_e) {
      return null;
    }
  }

  // ── 1. Color Parser Robusto ──
  let _sharedCanvas: HTMLCanvasElement | null = null;
  let _sharedCtx: CanvasRenderingContext2D | null = null;
  function parseColor(str: string | null | undefined, fallbackColor: string | null = null): Rgba | null {
    if (!str || str === 'transparent' || str === 'inherit' || str === 'initial') return null;
    str = str.trim();
    if (str.toLowerCase() === 'currentcolor') {
      return fallbackColor ? parseColor(fallbackColor) : null;
    }
    if (str.startsWith('rgb')) {
      const open = str.indexOf('(');
      const close = str.lastIndexOf(')');
      if (open > -1 && close > open) {
        const parts = str
          .slice(open + 1, close)
          .split(/[, /]+/)
          .map(s => s.trim())
          .filter(Boolean);
        if (parts.length >= 3) {
          const r = Math.max(0, Math.min(255, parseFloat(parts[0]))) / 255;
          const g = Math.max(0, Math.min(255, parseFloat(parts[1]))) / 255;
          const b = Math.max(0, Math.min(255, parseFloat(parts[2]))) / 255;
          let a = 1;
          if (parts.length >= 4) {
            a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
          }
          return { r, g, b, a: Math.max(0, Math.min(1, a)) };
        }
      }
    }
    if (str.startsWith('#')) {
      let h = str.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      else if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
      if (h.length === 6) {
        return {
          r: parseInt(h.slice(0, 2), 16) / 255,
          g: parseInt(h.slice(2, 4), 16) / 255,
          b: parseInt(h.slice(4, 6), 16) / 255,
          a: 1,
        };
      }
      if (h.length === 8) {
        return {
          r: parseInt(h.slice(0, 2), 16) / 255,
          g: parseInt(h.slice(2, 4), 16) / 255,
          b: parseInt(h.slice(4, 6), 16) / 255,
          a: parseInt(h.slice(6, 8), 16) / 255,
        };
      }
    }
    try {
      if (!_sharedCanvas) {
        _sharedCanvas = document.createElement('canvas');
        _sharedCanvas.width = 1;
        _sharedCanvas.height = 1;
        _sharedCtx = _sharedCanvas.getContext('2d', { willReadFrequently: true });
      }
      if (_sharedCtx) {
        // Un color inválido no cambia fillStyle (se quedaría el anterior): comprobar con dos centinelas
        _sharedCtx.fillStyle = '#000000';
        _sharedCtx.fillStyle = str;
        const asBlack = _sharedCtx.fillStyle;
        _sharedCtx.fillStyle = '#ffffff';
        _sharedCtx.fillStyle = str;
        if (_sharedCtx.fillStyle !== asBlack) return null;
        _sharedCtx.clearRect(0, 0, 1, 1);
        _sharedCtx.fillRect(0, 0, 1, 1);
        const d = _sharedCtx.getImageData(0, 0, 1, 1).data;
        if (d[3] === 0) return null;
        return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 };
      }
    } catch (_e) {}
    return null;
  }

  // ── 2. Degradados (lineal, radial y cónico) ──
  // Se guardan los parámetros CSS (ángulo/esquina, forma, tamaño, `at`, paradas): el plugin
  // calcula la geometría con el tamaño real del nodo (figma-plugin/src/gradient-geometry.ts).
  // background-image puede tener varias capas: se usa la de más arriba que sea un degradado.
  const COLOR_RE = /^(rgba?\([^)]*\)|hsla?\([^)]*\)|(?:oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}\b|[a-z]+)/i;

  function parseCssLen(tok: string) {
    const m = String(tok || '').match(/^(-?[\d.]+)(%|px)?$/i);
    if (!m) return null;
    return { v: parseFloat(m[1]), u: (m[2] === '%' ? '%' : 'px') as '%' | 'px' };
  }

  /** "at left 30%", "at center", "at 20px bottom" → { x, y } */
  function parseCssPosition(str: string) {
    const KW: Record<string, ['x' | 'y', number]> = {
      left: ['x', 0],
      right: ['x', 100],
      top: ['y', 0],
      bottom: ['y', 100],
    };
    const toks = str.trim().split(/\s+/).filter(Boolean);
    const out: { x?: { v: number; u: '%' | 'px' }; y?: { v: number; u: '%' | 'px' } } = {};
    const free: { v: number; u: '%' | 'px' }[] = [];
    for (const t of toks) {
      const k = t.toLowerCase();
      if (KW[k]) out[KW[k][0]] = { v: KW[k][1], u: '%' };
      else if (k === 'center') free.push({ v: 50, u: '%' });
      else {
        const l = parseCssLen(t);
        if (l) free.push(l);
      }
    }
    if (!out.x && free.length) out.x = free.shift();
    if (!out.y && free.length) out.y = free.shift();
    if (!out.x) out.x = { v: 50, u: '%' };
    if (!out.y) out.y = { v: 50, u: '%' };
    return out;
  }

  /** Paradas: "rgb(…) 10%", "red 10% 20%" (doble), "blue 24px", "red 90deg" (cónico) */
  function parseStops(parts: string[], angular: boolean) {
    const stops: { color: Rgba; position?: number; px?: number }[] = [];
    for (const part of parts) {
      const cm = part.trim().match(COLOR_RE);
      if (!cm) continue; // pista de interpolación sin color: se ignora
      const color = parseColor(cm[0]);
      if (!color) continue;
      const rest = part.trim().slice(cm[0].length).trim();
      const positions = rest ? rest.split(/\s+/) : [];
      const toStop = (p: string) => {
        const m = p.match(/^(-?[\d.]+)(%|px|deg|turn)?$/i);
        if (!m) return { color };
        const v = parseFloat(m[1]);
        const u = (m[2] || '').toLowerCase();
        if (u === '%') return { color, position: v / 100 };
        if (u === 'deg') return { color, position: v / 360 };
        if (u === 'turn') return { color, position: v };
        if (angular) return { color };
        return { color, px: v };
      };
      if (!positions.length) stops.push({ color });
      else positions.slice(0, 2).forEach(p => stops.push(toStop(p)));
    }
    return stops;
  }

  function parseGradientLayer(layer: string) {
    const m = layer.match(/^\s*(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)\s*$/i);
    if (!m) return null;
    const kind = m[2].toLowerCase();
    const parts = splitCssList(m[3]);
    if (!parts.length) return null;
    const first = parts[0].trim();
    const firstIsColorStop = COLOR_RE.test(first) && !!parseColor((first.match(COLOR_RE) || [''])[0]);

    if (kind === 'linear') {
      let angle: number | undefined = 180;
      let toCorner: string | undefined;
      let stopParts = parts;
      if (!firstIsColorStop) {
        stopParts = parts.slice(1);
        const t = first.toLowerCase();
        const deg = t.match(/^(-?[\d.]+)(deg|turn|rad|grad)$/);
        if (deg) {
          const v = parseFloat(deg[1]);
          angle =
            deg[2] === 'turn' ? v * 360 : deg[2] === 'rad' ? (v * 180) / Math.PI : deg[2] === 'grad' ? v * 0.9 : v;
        } else if (/^to\s/.test(t)) {
          const dirs = t.slice(3).trim();
          const SIDES: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270 };
          if (SIDES[dirs] !== undefined) angle = SIDES[dirs];
          else {
            toCorner = dirs;
            angle = undefined;
          }
        }
      }
      const stops = parseStops(stopParts, false);
      return stops.length >= 2 ? { type: 'GRADIENT_LINEAR', angle, toCorner, stops } : null;
    }

    if (kind === 'radial') {
      let shape: 'circle' | 'ellipse' | undefined;
      let size: string | { v: number; u: '%' | 'px' }[] | undefined;
      let at: ReturnType<typeof parseCssPosition> | undefined;
      let stopParts = parts;
      if (!firstIsColorStop) {
        stopParts = parts.slice(1);
        const [shapeSize, pos] = first.split(/\bat\b/i);
        if (pos !== undefined) at = parseCssPosition(pos);
        const lens: { v: number; u: '%' | 'px' }[] = [];
        for (const t of shapeSize.trim().split(/\s+/).filter(Boolean)) {
          const k = t.toLowerCase();
          if (k === 'circle' || k === 'ellipse') shape = k;
          else if (/^(closest|farthest)-(side|corner)$/.test(k)) size = k;
          else {
            const l = parseCssLen(t);
            if (l) lens.push(l);
          }
        }
        if (lens.length) size = lens;
      }
      const stops = parseStops(stopParts, false);
      return stops.length >= 2 ? { type: 'GRADIENT_RADIAL', shape, size, at, stops } : null;
    }

    // Cónico → GRADIENT_ANGULAR de Figma
    let from = 0;
    let at: ReturnType<typeof parseCssPosition> | undefined;
    let stopParts = parts;
    if (!firstIsColorStop) {
      stopParts = parts.slice(1);
      const fm = first.match(/from\s+(-?[\d.]+)(deg|turn)?/i);
      if (fm) from = parseFloat(fm[1]) * (fm[2] && fm[2].toLowerCase() === 'turn' ? 360 : 1);
      const am = first.split(/\bat\b/i);
      if (am.length > 1) at = parseCssPosition(am[1]);
    }
    const stops = parseStops(stopParts, true);
    return stops.length >= 2 ? { type: 'GRADIENT_ANGULAR', from, at, stops } : null;
  }

  function parseAllGradients(bgStr: string): any[] {
    if (!bgStr || !bgStr.includes('gradient')) return [];
    const list: any[] = [];
    for (const layer of splitCssList(bgStr)) {
      const g = parseGradientLayer(layer);
      if (g) list.push(g);
    }
    return list;
  }

  function parseGradient(bgStr: string): any {
    return parseAllGradients(bgStr)[0] || null;
  }

  // ── Helper para Fondos de Patrón / Cuadrícula (Grid & Dot Patterns) ──
  // Se analiza CAPA POR CAPA. Una capa es patrón si es un trazo fino con corte duro que se repite:
  //  - linear/radial-gradient con tesela en px (background-size) y "color 1px, transparent 1px"
  //    (o la línea al final: "transparent 39px, color 39px");
  //  - repeating-linear-gradient(…, color 0 1px, transparent 1px 40px): el periodo sale de las paradas.
  // Las capas de patrón se dibujan juntas en un mosaico; el resto (viñetas, brillos, degradados
  // normales) NO se tocan y siguen como degradados editables. Antes bastaba una capa de viñeta junto a
  // la cuadrícula para descartar todo el patrón, y la cuadrícula quedaba como degradados estirados.
  function generateGridPatternTile(bgImg: string, bgSize: string): { tile: string; layers: number[] } | null {
    if (!bgImg || bgImg === 'none') return null;
    const layers = splitCssList(bgImg).map(l => l.trim());
    const sizes = splitCssList(bgSize || 'auto').map(s => s.trim());
    const sizeOf = (i: number) => sizes[i % Math.max(1, sizes.length)] || 'auto';
    const pxPair = (sz: string) => {
      const m = sz.match(/^(\d+(?:\.\d+)?)px(?:\s+(\d+(?:\.\d+)?)px)?$/);
      if (!m) return null;
      const w = parseFloat(m[1]);
      const h = m[2] ? parseFloat(m[2]) : w;
      return w >= 4 && w <= 256 && h >= 4 && h <= 256 ? { w, h } : null;
    };
    const TRANSPARENT = '(?:transparent|rgba\\([^)]*,\\s*0\\))';
    const STOP_START = new RegExp('(\\d+(?:\\.\\d+)?)px\\s*,\\s*' + TRANSPARENT, 'i'); // color Npx, transparent
    const STOP_END = new RegExp(TRANSPARENT + '\\s+(\\d+(?:\\.\\d+)?)px\\s*,\\s*rgba?\\(', 'i'); // transparent Npx, color
    const COLOR = /(rgba?\([^)]+\)|#[a-f0-9]{3,8})/gi;
    const visibleColor = (layer: string) =>
      (layer.match(COLOR) || []).find(c => !/rgba\([^)]*,\s*0\)$/i.test(c)) || null;
    /** Dirección del degradado → orientación de la línea dibujada */
    const lineOf = (layer: string): 'VLINE' | 'HLINE' | null => {
      const first = (layer.match(/^[^(]*\(\s*([^,]+),/) || [])[1]?.trim().toLowerCase() || '';
      const isDir = first.startsWith('to ') || /^-?\d+(\.\d+)?(deg|turn|rad|grad)$/.test(first);
      if (!isDir) return 'HLINE'; // sin dirección = to bottom
      if (/^to (right|left)$/.test(first) || /^(90|270|-90)deg$/.test(first)) return 'VLINE';
      if (/^to (bottom|top)$/.test(first) || /^(0|180|360)deg$/.test(first)) return 'HLINE';
      return null;
    };
    const thick = (v: number) => Math.min(4, Math.max(1, v));

    // pos: 'start' (al inicio de cada celda) o 'end' (al final). pw/ph: periodo en cada eje (0 = continuo)
    interface Mark {
      kind: 'VLINE' | 'HLINE' | 'DOT';
      t: number;
      pos: 'start' | 'end';
      color: string;
      pw: number;
      ph: number;
      idx: number;
    }
    const marks: Mark[] = [];
    layers.forEach((layer, idx) => {
      const color = visibleColor(layer);
      if (!color || /url\(/i.test(layer)) return;
      if (/^repeating-linear-gradient\(/i.test(layer)) {
        const kind = lineOf(layer);
        const stopsPx = [...layer.matchAll(/(\d+(?:\.\d+)?)px/g)].map(m => parseFloat(m[1]));
        const period = stopsPx.length ? Math.max(...stopsPx) : 0;
        const st = layer.match(STOP_START);
        if (!kind || !st || !(period >= 4 && period <= 256)) return;
        const t = thick(parseFloat(st[1]));
        marks.push({ kind, t, pos: 'start', color, pw: kind === 'VLINE' ? period : 0, ph: kind === 'HLINE' ? period : 0, idx });
        return;
      }
      const size = pxPair(sizeOf(idx));
      if (!size) return;
      const isLin = /^linear-gradient\(/i.test(layer);
      const isRad = /^(repeating-)?radial-gradient\(/i.test(layer);
      if (!isLin && !isRad) return;
      const st = layer.match(STOP_START);
      const en = isLin && !st ? layer.match(STOP_END) : null;
      if (!st && !en) return;
      if (isRad) {
        if (!st) return;
        marks.push({ kind: 'DOT', t: thick(parseFloat(st[1])), pos: 'start', color, pw: size.w, ph: size.h, idx });
        return;
      }
      const kind = lineOf(layer);
      if (!kind) return;
      const cell = kind === 'VLINE' ? size.w : size.h;
      const t = st ? thick(parseFloat(st[1])) : thick(cell - parseFloat(en![1]));
      marks.push({ kind, t, pos: st ? 'start' : 'end', color, pw: size.w, ph: size.h, idx });
    });
    if (!marks.length) return null;

    // Tesela común: el mayor periodo de cada eje; las capas que no encajan en él siguen como degradado
    let W = Math.max(0, ...marks.map(m => m.pw));
    let H = Math.max(0, ...marks.map(m => m.ph));
    if (!W) W = H || 8;
    if (!H) H = W || 8;
    const fits = (period: number, total: number) => !period || Math.abs(total / period - Math.round(total / period)) < 0.01;
    const used = marks.filter(m => fits(m.pw, W) && fits(m.ph, H));
    if (!used.length) return null;

    try {
      const c = document.createElement('canvas');
      c.width = Math.round(W);
      c.height = Math.round(H);
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      for (const m of used) {
        ctx.fillStyle = m.color;
        if (m.kind === 'VLINE') {
          const p = m.pw || W;
          for (let x = 0; x < W - 0.01; x += p) ctx.fillRect(m.pos === 'start' ? x : x + p - m.t, 0, m.t, H);
        } else if (m.kind === 'HLINE') {
          const p = m.ph || H;
          for (let y = 0; y < H - 0.01; y += p) ctx.fillRect(0, m.pos === 'start' ? y : y + p - m.t, W, m.t);
        } else {
          for (let x = 0; x < W - 0.01; x += m.pw)
            for (let y = 0; y < H - 0.01; y += m.ph) {
              ctx.beginPath();
              ctx.arc(x + m.pw / 2, y + m.ph / 2, m.t, 0, Math.PI * 2);
              ctx.fill();
            }
        }
      }
      return { tile: c.toDataURL('image/png'), layers: used.map(m => m.idx) };
    } catch (_e) {
      return null;
    }
  }

  /** Degradados de las capas que NO son patrón (los del patrón van en el mosaico) */
  function gradientsExcept(bgStr: string, skip: number[]): any[] {
    if (!bgStr || bgStr === 'none') return [];
    const out: any[] = [];
    splitCssList(bgStr).forEach((layer, i) => {
      if (skip.includes(i)) return;
      const g = parseGradientLayer(layer);
      if (g) out.push(g);
    });
    return out;
  }

  // ── 3. Box Shadow Parser ──
  function parseBoxShadow(shadowStr: string) {
    if (!shadowStr || shadowStr === 'none') return [];
    const shadows = [];
    const parts = splitCssList(shadowStr);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const isInset = /\binset\b/i.test(trimmed);
      const colorMatch = trimmed.match(/(rgba?\([^)]+\)|#[a-f0-9]+)/i);
      const color = colorMatch ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 0.15 };
      const cleanLength = trimmed
        .replace(/(rgba?\([^)]+\)|#[a-f0-9]+)/i, '')
        .replace(/\binset\b/gi, '')
        .trim();
      const lengths = cleanLength.split(/\s+/).map(l => parseFloat(l) || 0);
      if (lengths.length >= 2 && color) {
        shadows.push({
          color,
          offset: { x: lengths[0], y: lengths[1] },
          radius: lengths[2] || 0,
          spread: lengths[3] || 0,
          inset: isInset || undefined,
        });
      }
    }
    return shadows;
  }

  // ── 3.2 Efectos CSS (fase 5.4) ──
  // Los que Figma tiene de forma nativa se traducen (desenfoque, sombras de filter, opacidad,
  // modos de fusión, text-shadow). Los que no (rotaciones, filtros de color, clip-path con formas,
  // máscaras, degradados repetidos) se marcan para rasterizar el elemento con una captura.
  const BLEND_MODES: Record<string, string> = {
    multiply: 'MULTIPLY',
    screen: 'SCREEN',
    overlay: 'OVERLAY',
    darken: 'DARKEN',
    lighten: 'LIGHTEN',
    'color-dodge': 'COLOR_DODGE',
    'color-burn': 'COLOR_BURN',
    'hard-light': 'HARD_LIGHT',
    'soft-light': 'SOFT_LIGHT',
    difference: 'DIFFERENCE',
    exclusion: 'EXCLUSION',
    hue: 'HUE',
    saturation: 'SATURATION',
    color: 'COLOR',
    luminosity: 'LUMINOSITY',
    'plus-lighter': 'LINEAR_DODGE',
    'plus-darker': 'LINEAR_BURN',
  };

  /** Sombra "color x y blur" (formato de getComputedStyle: el color va primero) */
  function parseShadowParts(str: string, withSpread: boolean) {
    const out: { color: Rgba; offset: { x: number; y: number }; radius: number; spread: number }[] = [];
    for (const part of splitCssList(str)) {
      const t = part.trim();
      if (!t || t === 'none') continue;
      const cm = t.match(/(rgba?\([^)]+\)|#[a-f0-9]{3,8}\b)/i);
      const color = cm ? parseColor(cm[1]) : { r: 0, g: 0, b: 0, a: 0.5 };
      if (!color || color.a === 0) continue;
      const lens = t
        .replace(cm ? cm[1] : '', '')
        .trim()
        .split(/\s+/)
        .map(l => parseFloat(l))
        .filter(v => !isNaN(v));
      if (lens.length < 2) continue;
      out.push({
        color,
        offset: { x: lens[0], y: lens[1] },
        radius: Math.max(0, lens[2] || 0),
        spread: withSpread ? lens[3] || 0 : 0,
      });
    }
    return out;
  }

  /** filter: lo traducible a Figma y, si hay algo más, el motivo para rasterizar */
  function parseCssFilter(filter: string) {
    const res: {
      layerBlur?: number;
      dropShadows: ReturnType<typeof parseShadowParts>;
      opacity: number;
      raster?: string;
    } = {
      dropShadows: [],
      opacity: 1,
    };
    if (!filter || filter === 'none') return res;
    const IDENTITY: Record<string, number> = {
      grayscale: 0,
      sepia: 0,
      invert: 0,
      brightness: 1,
      contrast: 1,
      saturate: 1,
      'hue-rotate': 0,
    };
    const re = /([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(filter))) {
      const name = m[1].toLowerCase();
      const arg = m[2].trim();
      if (name === 'blur') {
        const v = parseFloat(arg);
        if (v > 0) res.layerBlur = v;
      } else if (name === 'drop-shadow') {
        res.dropShadows.push(...parseShadowParts(arg, false));
      } else if (name === 'opacity') {
        const v = arg.endsWith('%') ? parseFloat(arg) / 100 : parseFloat(arg);
        if (!isNaN(v)) res.opacity *= Math.max(0, Math.min(1, v));
      } else if (name in IDENTITY) {
        const v = arg.endsWith('%') ? parseFloat(arg) / 100 : name === 'hue-rotate' ? parseFloat(arg) : parseFloat(arg);
        if (!isNaN(v) && Math.abs(v - IDENTITY[name]) > 0.01) res.raster = `filter: ${name}`;
      } else {
        res.raster = `filter: ${name}`; // url(#svg-filter) u otros
      }
    }
    return res;
  }

  /** ¿La transformación rota, inclina o voltea? (traslación y escala ya vienen en el rect medido) */
  function transformNeedsRaster(style: CSSStyleDeclaration): string | null {
    const rotate = (style as any).rotate;
    if (rotate && rotate !== 'none' && parseFloat(rotate) !== 0) return 'rotate';
    const t = style.transform;
    if (!t || t === 'none') return null;
    const inner = t.slice(t.indexOf('(') + 1, t.lastIndexOf(')'));
    const nums = inner.split(',').map(v => parseFloat(v));
    let a: number, b: number, c: number, d: number;
    if (t.startsWith('matrix3d(') && nums.length === 16) {
      // Columnas: [a b . p1 | c d . p2 | . . . p3 | tx ty tz 1]
      if (Math.abs(nums[2]) > 1e-4 || Math.abs(nums[6]) > 1e-4) return 'transform 3D';
      if (Math.abs(nums[3]) > 1e-4 || Math.abs(nums[7]) > 1e-4 || Math.abs(nums[11]) > 1e-4) return 'transform 3D';
      [a, b, c, d] = [nums[0], nums[1], nums[4], nums[5]];
    } else if (t.startsWith('matrix(') && nums.length === 6) {
      [a, b, c, d] = nums;
    } else return null;
    if (Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3) return 'transform: rotación/inclinación';
    if (a < 0 || d < 0) return 'transform: volteado';
    return null;
  }

  function effectsNeedingRaster(style: CSSStyleDeclaration, filterInfo: ReturnType<typeof parseCssFilter>) {
    if (filterInfo.raster) return filterInfo.raster;
    const tr = transformNeedsRaster(style);
    if (tr) return tr;
    const clip = style.clipPath;
    if (clip && clip !== 'none' && !/^inset\(/.test(clip)) return 'clip-path';
    const mask = (style as any).maskImage || (style as any).webkitMaskImage;
    if (mask && mask !== 'none') return 'mask';
    if (/repeating-(linear|radial|conic)-gradient/.test(style.backgroundImage || '')) return 'degradado repetido';
    return null;
  }

  /** Efectos de un texto: text-shadow y modo de fusión */
  function textEffects(style: CSSStyleDeclaration) {
    const out: Record<string, unknown> = {};
    const ts = parseShadowParts(style.textShadow, false);
    if (ts.length) out.textShadow = ts;
    const blend = BLEND_MODES[style.mixBlendMode];
    if (blend) out.blendMode = blend;
    return out;
  }

  // ── 3.5 Pseudo-element (::before / ::after) Extractor ──
  function extractPseudoElement(
    element: Element,
    pseudo: string,
    parentRect: DOMRect,
    parentLayout: RawLayout | null,
    counter: ExtractCounter,
  ) {
    try {
      const style = window.getComputedStyle(element, pseudo);
      const content = style.content;
      const hasContent = content && content !== 'none' && content !== 'normal' && content !== '""' && content !== "''";
      if (style.display === 'none') return null;
      // content: none/normal → el navegador no genera el pseudo-elemento: no hay nada que copiar
      if (!content || content === 'none' || content === 'normal') return null;
      const bg = parseColor(style.backgroundColor);
      let w = parseFloat(style.width) || 0;
      let h = parseFloat(style.height) || 0;
      const bgUrl = extractBgUrl(style.backgroundImage);
      const decoGrads = parseAllGradients(style.backgroundImage);
      const hasBgGrad = decoGrads.length > 0;

      // Bordes en el pseudo-elemento (ej. líneas separadoras, puntos, indicadores verticales como border-left: 2px dotted #10b981)
      const topBW = parseFloat(style.borderTopWidth) || 0;
      const rightBW = parseFloat(style.borderRightWidth) || 0;
      const bottomBW = parseFloat(style.borderBottomWidth) || 0;
      const leftBW = parseFloat(style.borderLeftWidth) || 0;
      const maxBW = Math.max(topBW, rightBW, bottomBW, leftBW);
      const hasBorder = maxBW > 0;

      if (w <= 0 && (leftBW > 0 || rightBW > 0)) w = Math.max(leftBW, rightBW);
      if (h <= 0 && (topBW > 0 || bottomBW > 0)) h = Math.max(topBW, bottomBW);
      if (h <= 0 && parentRect && (leftBW > 0 || rightBW > 0)) h = Math.round(parentRect.height);
      if (w <= 0 && parentRect && (topBW > 0 || bottomBW > 0)) w = Math.round(parentRect.width);

      // Pseudo-elemento con imagen de fondo (iconos, logos, decoraciones)
      const isRendered = content && content !== 'none' && content !== 'normal';
      if (bgUrl && isRendered && w > 0 && h > 0) {
        const isAbs = style.position === 'absolute' || style.position === 'fixed';
        const pNode: any = {
          id: 'pseudo_' + ++counter.id,
          name: pseudo === '::before' ? 'Image / Before' : 'Image / After',
          type: 'FRAME',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: Math.round(w),
            height: Math.round(h),
            positioning: isAbs ? 'ABSOLUTE' : 'AUTO',
            ...(isAbs ? pseudoPosition(element, style, w, h) || {} : {}),
          },
          styles: {
            fills: bg && bg.a > 0.01 ? [bg] : [],
            cornerRadius: parseCornerRadius(style),
            imageScaleMode: bgScaleMode(style),
          },
          children: [],
        };
        pNode._pendingBgImageSrc = bgUrl;
        return pNode;
      }

      if (!hasContent) {
        // Sin texto, solo se ve si pinta algo (fondo, degradado o borde) y tiene área:
        // un pseudo transparente o de alto/ancho 0 no existe visualmente en la web
        if ((!bg || bg.a <= 0.05) && !hasBgGrad && !hasBorder) return null;
        if (w <= 0 || h <= 0) return null;
      }

      const rawText = (content || '').replace(/^['"]|['"]$/g, '').trim();
      const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
      const isPosAbs = style.position === 'absolute' || style.position === 'fixed';

      if (rawText.length > 0) {
        if (isIconFont(style.fontFamily, rawText) && w > 0 && h > 0) {
          const iconImg = renderIconFontToDataUrl(rawText, style, w, h);
          const iconNode: any = {
            id: 'pseudo_' + ++counter.id,
            name: 'Icon / ' + (pseudo === '::before' ? 'Before' : 'After'),
            type: 'FRAME',
            layout: {
              mode: 'NONE',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: Math.round(w),
              height: Math.round(h),
              positioning: isPosAbs ? 'ABSOLUTE' : 'AUTO',
              ...(isPosAbs ? pseudoPosition(element, style, w, h) || {} : {}),
            },
            styles: {
              fills: [],
              cornerRadius: parseCornerRadius(style),
            },
            children: [],
          };
          if (iconImg) iconNode.imageData = iconImg;
          else {
            iconNode._needsShot = true;
            iconNode._vpRect = vpRectOf(parentRect);
          }
          return iconNode;
        }

        return {
          id: 'pseudo_' + ++counter.id,
          name: pseudo === '::before' ? 'Pseudo / Before' : 'Pseudo / After',
          type: 'TEXT',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: 'HUG',
            height: 'HUG',
            positioning: isPosAbs ? 'ABSOLUTE' : 'AUTO',
          },
          styles: { fills: [tc] },
          textData: {
            characters: rawText,
            fontSize: Math.round(parseFloat(style.fontSize) || 14),
            fontWeight: style.fontWeight || 400,
            fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter',
            fontStack: style.fontFamily || undefined,
          },
        };
      } else if (w > 0 && h > 0 && ((bg && bg.a > 0.05) || hasBgGrad || hasBorder)) {
        const gridTile = generateGridPatternTile(style.backgroundImage, style.backgroundSize);
        if (gridTile) {
          return {
            id: 'pseudo_' + ++counter.id,
            name: pseudo === '::before' ? 'Grid / Before' : 'Grid / After',
            type: 'FRAME',
            layout: {
              mode: 'NONE',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: Math.max(1, Math.round(w)),
              height: Math.max(1, Math.round(h)),
              positioning: isPosAbs ? 'ABSOLUTE' : 'AUTO',
              ...(isPosAbs ? pseudoPosition(element, style, w, h) || {} : {}),
            },
            styles: {
              // color de fondo debajo, mosaico en medio y el resto de capas (viñetas) encima
              fills: [
                ...(bg && bg.a > 0.01 ? [bg] : []),
                ...gradientsExcept(style.backgroundImage, gridTile.layers),
              ],
              imageScaleMode: 'TILE',
              cornerRadius: parseCornerRadius(style),
            },
            imageData: gridTile.tile,
            children: [],
          };
        }
        const decoFills = decoGrads.length > 0 ? decoGrads : (bg && bg.a > 0.01 ? [bg] : []);
        const decoStrokes: any[] = [];
        let borderSides: any = undefined;
        if (hasBorder) {
          const borderColorStr =
            (leftBW > 0 ? style.borderLeftColor : '') ||
            (topBW > 0 ? style.borderTopColor : '') ||
            (bottomBW > 0 ? style.borderBottomColor : '') ||
            (rightBW > 0 ? style.borderRightColor : '') ||
            style.borderColor ||
            style.color;
          const strokeColor = parseColor(borderColorStr, style.color) || { r: 0.1, g: 0.8, b: 0.5, a: 1 };
          const sideStyles = [
            topBW > 0 ? style.borderTopStyle : '',
            rightBW > 0 ? style.borderRightStyle : '',
            bottomBW > 0 ? style.borderBottomStyle : '',
            leftBW > 0 ? style.borderLeftStyle : '',
            style.borderStyle,
          ].filter(s => s && s !== 'none');
          const bStyle = sideStyles.find(s => s === 'dashed' || s === 'dotted') || sideStyles[0] || 'solid';
          const strokeDashStyle = bStyle === 'dashed' ? 'DASHED' : bStyle === 'dotted' ? 'DOTTED' : 'SOLID';
          decoStrokes.push({ ...strokeColor, width: maxBW || 1, align: 'INSIDE', style: strokeDashStyle });
          if (topBW !== rightBW || topBW !== bottomBW || topBW !== leftBW) {
            borderSides = {
              top: Math.round(topBW),
              right: Math.round(rightBW),
              bottom: Math.round(bottomBW),
              left: Math.round(leftBW),
            };
          }
        }
        return {
          id: 'pseudo_' + ++counter.id,
          name: pseudo === '::before' ? 'Decorator / Before' : 'Decorator / After',
          type: 'FRAME',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: Math.max(1, Math.round(w)),
            height: Math.max(1, Math.round(h)),
            positioning: isPosAbs ? 'ABSOLUTE' : 'AUTO',
            ...(isPosAbs ? pseudoPosition(element, style, Math.max(1, w), Math.max(1, h)) || {} : {}),
          },
          styles: {
            fills: decoFills,
            strokes: decoStrokes,
            borderSides,
            cornerRadius: parseCornerRadius(style),
          },
          children: [],
        };
      }
    } catch (_e) {}
    return null;
  }

  // ── 4. Clasificador Semántico de Capas ──
  function getSemanticName(el: Element, tag: string, st: CSSStyleDeclaration, r: DOMRect) {
    const customName = el.getAttribute('data-component-name') || el.getAttribute('data-testid');
    if (customName) return customName;

    // Detectar icono o SVG
    if (tag === 'svg') {
      const label = el.getAttribute('aria-label') || el.getAttribute('data-icon');
      if (label) return 'Icon / ' + label;
      const p = el.parentElement;
      if (p) {
        const pIcon =
          p.getAttribute('name') || p.getAttribute('icon') || p.getAttribute('data-icon') || p.getAttribute('fontIcon');
        if (pIcon) return 'Icon / ' + pIcon.replace(/^hero|^mat-/, '');
        const pClass = p.className || '';
        if (typeof pClass === 'string') {
          if (pClass.includes('return') || pClass.includes('back')) return 'Icon / ArrowLeft';
          if (pClass.includes('eye') || pClass.includes('password')) return 'Icon / Eye';
          if (pClass.includes('close')) return 'Icon / Close';
          if (pClass.includes('lock')) return 'Icon / Lock';
        }
      }
      return 'Icon / Svg';
    }

    // Detectar botones
    const isBtn =
      tag === 'button' ||
      el.getAttribute('role') === 'button' ||
      (el.className && typeof el.className === 'string' && el.className.includes('btn'));
    if (isBtn) {
      const btnText = el.textContent?.trim() || el.getAttribute('aria-label') || '';
      const isIconBtn = r.width <= 48 && r.height <= 48 && el.querySelector('svg, i, ng-icon');
      const bg = parseColor(st.backgroundColor);
      const isPrimary = bg && bg.a > 0.5 && (bg.r < 0.3 || bg.b > 0.4);
      const variant = isIconBtn ? 'Icon' : isPrimary ? 'Primary' : 'Secondary';
      return 'Button / ' + variant + (btnText ? ' (' + btnText.slice(0, 16) + ')' : '');
    }

    // Detectar inputs
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type || 'text';
      let labelText = '';
      const parentWrap = el.closest('.mb-4, .form-group, .input-group, div');
      if (parentWrap) {
        const lbl = parentWrap.querySelector('label');
        if (lbl) labelText = lbl.textContent?.trim() || '';
      }
      const typeLabel = type === 'password' ? 'Password' : type === 'email' ? 'Email' : 'Text';
      return 'Input / ' + typeLabel + (labelText ? ' (' + labelText.slice(0, 15) + ')' : '');
    }

    if (tag === 'select') return 'Select / Dropdown';
    if (tag === 'textarea') return 'Input / Textarea';
    if (tag === 'label') return 'Label / ' + (el.textContent?.trim().slice(0, 15) || 'Text');

    // Detectar contenedores directos de formulario (Input Group)
    const childrenList = Array.from(el.children) as any[];
    const hasDirectLabel = childrenList.some(c => c.tagName.toLowerCase() === 'label');
    const hasDirectInput = childrenList.some(
      c =>
        ['input', 'select', 'textarea'].includes(c.tagName.toLowerCase()) || c.querySelector('input, select, textarea'),
    );
    if (hasDirectLabel && hasDirectInput && childrenList.length <= 4) {
      const lbl = el.querySelector('label')?.textContent?.trim();
      return 'Input Group' + (lbl ? ' (' + lbl.slice(0, 15) + ')' : '');
    }

    if (tag === 'body') return document.title ? document.title.replace(/[-|].*$/, '').trim() : 'Screen / View';

    // Detectar Headings
    if (tag === 'h1') return 'Heading 1 / ' + (el.textContent?.trim().slice(0, 15) || '');
    if (tag === 'h2') return 'Heading 2 / ' + (el.textContent?.trim().slice(0, 15) || '');
    if (tag === 'h3') return 'Heading 3 / ' + (el.textContent?.trim().slice(0, 15) || '');
    if (tag === 'h4') return 'Heading 4 / ' + (el.textContent?.trim().slice(0, 15) || '');
    if (tag === 'p') return 'Text / Paragraph';
    if (tag === 'a') return 'Link / ' + (el.textContent?.trim().slice(0, 15) || 'Anchor');

    // Detectar Cards
    const isCard =
      (el.className && typeof el.className === 'string' && el.className.includes('card')) || tag === 'article';
    if (isCard) return 'Card / Container';

    // Detectar Navigation / Sidebar / Header
    if (tag === 'nav' || el.getAttribute('role') === 'navigation') return 'Navigation / Bar';
    if (tag === 'aside' || (el.className && typeof el.className === 'string' && el.className.includes('sidebar')))
      return 'Sidebar';
    if (tag === 'header' || (el.className && typeof el.className === 'string' && el.className.includes('header')))
      return 'Header / Navbar';
    if (tag === 'form') return 'Form / Container';

    // Limpiar clases utilitarias de Tailwind / Angular y hashes de frameworks para no usarlas de nombre.
    // (Antes se partía con /\\s+/ —barra invertida literal— y se usaba la cadena de clases entera.)
    const rawClass = typeof el.className === 'string' ? el.className.trim() : '';
    if (rawClass) {
      const cleanClasses = rawClass
        .split(/\s+/)
        .filter(c => {
          if (
            /^(mb-|mt-|ml-|mr-|p-|px-|py-|w-|h-|flex|grid|block|inline|relative|absolute|text-|bg-|border-|rounded-|ng-|mat-|cursor-|transition-|duration-|hover:|focus:)/.test(
              c,
            )
          )
            return false;
          // Clases de alcance generadas: svelte-1x2y3z, astro-ABC123, css-1q2w3e (emotion), sc-aXZVg, jsx-123
          return !/^(svelte|astro|css|sc|jsx|emotion)-[A-Za-z0-9]+$/.test(c);
        })
        .map(localClassName)
        .filter(Boolean);
      if (cleanClasses.length > 0) {
        const c0 = cleanClasses[0];
        return c0.charAt(0).toUpperCase() + c0.slice(1);
      }
    }

    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }

  // ── 5. SVG Handling ──
  if (tagName === 'svg') {
    const svgClone = element.cloneNode(true);
    const cc = parseColor(style.color) || { r: 0.2, g: 0.25, b: 0.35, a: 1 };
    const ccHex =
      '#' +
      Math.round(cc.r * 255)
        .toString(16)
        .padStart(2, '0') +
      Math.round(cc.g * 255)
        .toString(16)
        .padStart(2, '0') +
      Math.round(cc.b * 255)
        .toString(16)
        .padStart(2, '0');

    const svgCompStyle = window.getComputedStyle(element);
    const svgHasStroke =
      (svgCompStyle.stroke && svgCompStyle.stroke !== 'none') || element.getAttribute('stroke') !== null;

    const origVectors = element.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse, text');
    const cloneVectors = svgClone.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse, text');
    for (let vi = 0; vi < origVectors.length; vi++) {
      const ov = origVectors[vi];
      const cv = cloneVectors[vi];
      if (!cv) continue;
      const vs = window.getComputedStyle(ov);

      // Rectángulo de bounding box transparente/invisible (común en Lucide / Tabler: <path d="M0 0h24v24H0z" fill="none">)
      const dAttr = ov.getAttribute('d') || '';
      if (
        dAttr.includes('0 0h24v24H0z') ||
        dAttr.includes('0 0h24v24') ||
        (vs.fill === 'none' && vs.stroke === 'none')
      ) {
        cv.setAttribute('fill', 'none');
        cv.setAttribute('stroke', 'none');
        continue;
      }

      const vStroke = vs.stroke;
      const hasStroke = (vStroke && vStroke !== 'none') || svgHasStroke;

      const vFill = vs.fill;
      const explicitFill = ov.getAttribute('fill') || '';
      const explicitStroke = ov.getAttribute('stroke') || '';
      // url(#id), url("#id") o url("https://pagina/#id") → id
      const urlRef = (v: string | null | undefined) =>
        (String(v || '').match(/url\(\s*["']?[^#"')]*#([^)"']+)["']?\s*\)/) || [])[1] || null;
      const fillRef = urlRef(explicitFill) || urlRef(vFill);
      const strokeRef = urlRef(explicitStroke) || urlRef(vStroke);

      /** Copia el <linearGradient>/<radialGradient>/<pattern> referenciado a los <defs> del clon */
      const inlineDef = (id: string | null): boolean => {
        if (!id) return false;
        const defEl = document.getElementById(id);
        if (!defEl) return false;
        let defs = svgClone.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svgClone.insertBefore(defs, svgClone.firstChild);
        }
        if (!svgClone.querySelector('#' + CSS.escape(id))) defs.appendChild(defEl.cloneNode(true));
        return true;
      };

      /**
       * Color sólido + su opacidad. Solo fill-opacity / stroke-opacity: añadir también `opacity`
       * multiplicaba la transparencia (α²) y la del trazo apagaba también el relleno.
       */
      const setPaint = (attr: 'fill' | 'stroke', c: { r: number; g: number; b: number; a: number }, cssOpacity: string) => {
        const hex = (v: number) =>
          Math.round(v * 255)
            .toString(16)
            .padStart(2, '0');
        cv.setAttribute(attr, '#' + hex(c.r) + hex(c.g) + hex(c.b));
        const alpha = (c.a !== undefined ? c.a : 1) * (parseFloat(cssOpacity) >= 0 ? parseFloat(cssOpacity) : 1);
        if (alpha < 1) cv.setAttribute(attr + '-opacity', String(Math.round(alpha * 1000) / 1000));
        else cv.removeAttribute(attr + '-opacity');
      };

      // ── Relleno ──
      if (fillRef && inlineDef(fillRef)) {
        cv.setAttribute('fill', `url(#${fillRef})`);
      } else if (vFill && vFill !== 'none' && vFill !== 'transparent') {
        // Icono de contorno (con trazo y sin fill propio): el negro por defecto de SVG no se rellena
        const defaultBlackOnOutline = hasStroke && !explicitFill && /^rgb\(0,\s*0,\s*0\)$/.test(vFill);
        const pf = defaultBlackOnOutline
          ? null
          : (fillRef ? null : parseColor(vFill, style.color)) || parseColor(explicitFill, style.color) || cc;
        if (pf && pf.a > 0.01) setPaint('fill', pf, vs.fillOpacity);
        else cv.setAttribute('fill', 'none');
      } else {
        cv.setAttribute('fill', 'none');
      }

      // ── Trazo ──
      const applyStrokeGeometry = () => {
        cv.setAttribute(
          'stroke-width',
          vs.strokeWidth && vs.strokeWidth !== '0px' ? vs.strokeWidth : svgCompStyle.strokeWidth || '2',
        );
        cv.setAttribute('stroke-linecap', vs.strokeLinecap || 'round');
        cv.setAttribute('stroke-linejoin', vs.strokeLinejoin || 'round');
      };
      if (strokeRef && inlineDef(strokeRef)) {
        cv.setAttribute('stroke', `url(#${strokeRef})`);
        applyStrokeGeometry();
      } else if (hasStroke) {
        const usable = (v: string) => !!v && v !== 'none' && !urlRef(v);
        const strokeColorStr = usable(vStroke) ? vStroke : usable(svgCompStyle.stroke) ? svgCompStyle.stroke : style.color;
        const ps = parseColor(strokeColorStr, style.color) || cc;
        setPaint('stroke', ps, vs.strokeOpacity);
        applyStrokeGeometry();
      }

      // Opacidad propia del elemento (CSS opacity), distinta de la del relleno o trazo
      const elOpacity = parseFloat(vs.opacity);
      if (elOpacity >= 0 && elOpacity < 1) cv.setAttribute('opacity', String(elOpacity));

      // Preservar líneas discontinuas y punteadas (stroke-dasharray / stroke-dashoffset)
      const explicitDash = ov.getAttribute('stroke-dasharray');
      const compDash = vs.strokeDasharray && vs.strokeDasharray !== 'none' ? vs.strokeDasharray : '';
      const svgDash =
        svgCompStyle.strokeDasharray && svgCompStyle.strokeDasharray !== 'none' ? svgCompStyle.strokeDasharray : '';
      const dash = explicitDash || compDash || svgDash;
      if (dash && dash !== 'none') {
        cv.setAttribute('stroke-dasharray', dash);
      }
      const explicitOffset = ov.getAttribute('stroke-dashoffset');
      const compOffset =
        vs.strokeDashoffset && vs.strokeDashoffset !== 'none' && vs.strokeDashoffset !== '0px'
          ? vs.strokeDashoffset
          : '';
      const offset = explicitOffset || compOffset;
      if (offset) {
        cv.setAttribute('stroke-dashoffset', offset);
      }
    }

    // Inlinear <use href="#id"> (sprites): Figma no resuelve referencias fuera del SVG.
    // Se conservan x/y/transform del <use> y el viewBox del <symbol>; fill/stroke y currentColor
    // se resuelven con los colores reales del <use> en la página.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const origUses = element.querySelectorAll('use');
    const cloneUses = svgClone.querySelectorAll('use');
    for (let ui = 0; ui < cloneUses.length; ui++) {
      const u = cloneUses[ui];
      const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
      if (!href.startsWith('#')) continue;
      const targetEl = document.getElementById(href.slice(1));
      if (!targetEl) continue;
      const us = window.getComputedStyle(origUses[ui] || element);
      const x = u.getAttribute('x') || '0';
      const y = u.getAttribute('y') || '0';

      let replacement: Element;
      if (targetEl.tagName.toLowerCase() === 'symbol') {
        // <symbol> equivale a un <svg> anidado con su viewBox y el tamaño del <use>
        replacement = document.createElementNS(SVG_NS, 'svg');
        for (const attr of ['viewBox', 'preserveAspectRatio']) {
          const v = targetEl.getAttribute(attr);
          if (v) replacement.setAttribute(attr, v);
        }
        replacement.setAttribute('x', x);
        replacement.setAttribute('y', y);
        replacement.setAttribute('width', u.getAttribute('width') || '100%');
        replacement.setAttribute('height', u.getAttribute('height') || '100%');
        for (const ch of Array.from(targetEl.childNodes)) replacement.appendChild(ch.cloneNode(true));
      } else {
        replacement = document.createElementNS(SVG_NS, 'g');
        const copy = targetEl.cloneNode(true) as Element;
        copy.removeAttribute('id');
        replacement.appendChild(copy);
        if (x !== '0' || y !== '0') replacement.setAttribute('transform', `translate(${x} ${y})`);
      }

      // Lo que el contenido hereda del <use>
      if (us.fill && us.fill !== 'none' && !us.fill.includes('url(')) replacement.setAttribute('fill', us.fill);
      else if (us.fill === 'none') replacement.setAttribute('fill', 'none');
      if (us.stroke && us.stroke !== 'none' && !us.stroke.includes('url(')) {
        replacement.setAttribute('stroke', us.stroke);
        if (us.strokeWidth) replacement.setAttribute('stroke-width', us.strokeWidth);
      }
      const resolvedColor = us.color || style.color;
      for (const node of [replacement, ...Array.from(replacement.querySelectorAll('*'))]) {
        for (const attr of ['fill', 'stroke', 'stop-color']) {
          if ((node.getAttribute(attr) || '').toLowerCase() === 'currentcolor') node.setAttribute(attr, resolvedColor);
        }
      }

      let finalNode: Element = replacement;
      const useTransform = u.getAttribute('transform');
      if (useTransform) {
        finalNode = document.createElementNS(SVG_NS, 'g');
        finalNode.setAttribute('transform', useTransform);
        finalNode.appendChild(replacement);
      }
      u.parentNode?.replaceChild(finalNode, u);
    }

    let w = Math.max(1, Math.round(rect.width) || 24);
    let h = Math.max(1, Math.round(rect.height) || 24);
    // Preservar aspect ratio 1:1 en iconos donde el bounding box DOM tiene ligeras variaciones (ej. 28x31 por line-height de ng-icon)
    if (Math.abs(w - h) <= 6 && Math.min(w, h) >= 14) {
      const squareSize = Math.min(w, h);
      w = squareSize;
      h = squareSize;
    }

    // Tamaño real en la página, en la etiqueta RAÍZ. Antes se buscaba "width=" en todo el código y
    // cualquier stroke-width="…" lo daba por puesto: Figma importaba el SVG al tamaño de su viewBox y
    // las líneas decorativas (circuitos alrededor de un título) salían a otra escala y desplazadas.
    svgClone.setAttribute('width', String(w));
    svgClone.setAttribute('height', String(h));
    const vbAttr = (svgClone.getAttribute('viewBox') || '').trim();
    if (!vbAttr) {
      svgClone.setAttribute('viewBox', `0 0 ${w} ${h}`); // sin viewBox: 1 unidad = 1 px, como en la web
    } else if (/^none\b/.test((svgClone.getAttribute('preserveAspectRatio') || '').trim())) {
      // preserveAspectRatio="none" estira el dibujo a la caja sin conservar proporciones; Figma no lo
      // reproduce: se hornea esa escala en un <g> y el viewBox pasa a ser la caja
      const vb = vbAttr.split(/[\s,]+/).map(parseFloat);
      if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        const sx = w / vb[2];
        const sy = h / vb[3];
        if (Math.abs(sx - sy) > 0.001) {
          const g = document.createElementNS(SVG_NS, 'g');
          g.setAttribute('transform', `matrix(${sx} 0 0 ${sy} ${-vb[0] * sx} ${-vb[1] * sy})`);
          for (const ch of Array.from(svgClone.childNodes) as any[]) {
            if (!(ch.nodeType === Node.ELEMENT_NODE && ch.localName === 'defs')) g.appendChild(ch);
          }
          svgClone.appendChild(g);
          svgClone.setAttribute('viewBox', `0 0 ${w} ${h}`);
          svgClone.removeAttribute('preserveAspectRatio');
        }
      }
    }

    let raw = svgClone.outerHTML;
    raw = raw.replace(/currentColor/gi, ccHex);
    // Inlinear y limpiar variables CSS como style="stroke-width:var(--ng-icon__stroke-width, 2)"
    raw = raw.replace(/var\(--[a-zA-Z0-9_-]+,\s*([^)]+)\)/g, '$1');
    raw = raw.replace(/style="[^"]*"/gi, '');
    // Atributos de Angular y clases (los colores ya van como atributos calculados). Antes con /\\s+/
    // (barra invertida literal) esta limpieza nunca hacía nada.
    raw = raw.replace(/\s+(ng-reflect-[a-z-]+|_ng[a-z]+-[a-z0-9-]+|data-mat-icon-[a-z]+|class)="[^"]*"/gi, '');

    const svgRadius = parseCornerRadius(style);
    const svgBg = parseColor(style.backgroundColor);
    const svgStyles: any = { fills: [] };
    if (svgBg && svgBg.a > 0.01) svgStyles.fills.push(svgBg);
    if (hasAnyRadius(svgRadius)) svgStyles.cornerRadius = svgRadius;

    return {
      id: currentId,
      name: getSemanticName(element, tagName, style, rect),
      type: 'SVG',
      layout: {
        mode: 'NONE',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
        width: w,
        height: h,
        x: relX,
        y: relY,
      },
      styles: svgStyles,
      svgContent: raw,
    };
  }

  // ── 6. Canvas, Video e Iframes (medios que el DOM no devuelve como URL de imagen) ──
  if (
    tagName === 'canvas' ||
    tagName === 'video' ||
    tagName === 'iframe' ||
    tagName === 'embed' ||
    tagName === 'object'
  ) {
    const mediaNode: any = {
      id: currentId,
      name:
        tagName === 'canvas'
          ? 'Chart / Canvas'
          : tagName === 'video'
            ? 'Video / ' + (element.getAttribute('aria-label') || element.getAttribute('title') || 'Media')
            : 'Embed / ' + (element.getAttribute('title') || tagName),
      type: 'FRAME',
      layout: {
        mode: 'NONE',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
        width: Math.round(rect.width) || 300,
        height: Math.round(rect.height) || 150,
        x: relX,
        y: relY,
        positioning: style.position === 'absolute' || style.position === 'fixed' ? 'ABSOLUTE' : 'AUTO',
      },
      styles: {
        fills: [],
        cornerRadius: parseCornerRadius(style),
        imageScaleMode: style.objectFit === 'contain' ? 'FIT' : 'FILL',
      },
      children: [],
    };
    mediaNode._vpRect = vpRectOf(rect);

    if (tagName === 'canvas') {
      const px = canvasPixels(element);
      if (px) mediaNode.imageData = px;
      else mediaNode._needsShot = true; // WebGL / tainted → captura de pantalla
    } else if (tagName === 'video') {
      // 1) fotograma actual (si el video es same-origin y ya tiene datos)
      let frame = null;
      if (element.readyState >= 2 && element.videoWidth) {
        try {
          const c = document.createElement('canvas');
          c.width = element.videoWidth;
          c.height = element.videoHeight;
          c.getContext('2d')!.drawImage(element, 0, 0); // canvas nuevo: siempre hay contexto 2d
          frame = c.toDataURL('image/jpeg', 0.88);
        } catch (_e) {
          frame = null;
        }
      }
      if (frame) mediaNode.imageData = frame;
      else {
        // 2) póster declarado; 3) captura de pantalla como último recurso
        const poster = element.getAttribute('poster') || element.getAttribute('data-poster');
        if (poster) mediaNode._pendingImageSrc = new URL(poster, location.href).href;
        mediaNode._needsShot = true;
      }
    } else {
      mediaNode._needsShot = true;
      mediaNode.styles.fills = [{ r: 0.945, g: 0.949, b: 0.957, a: 1 }];
    }
    return mediaNode;
  }

  // ── 7. IMG & PICTURE: Extracción en Alta Resolución Nativa (Sin Pérdida de Calidad) ──
  if (tagName === 'img' || tagName === 'picture') {
    let pendingSrc = null;
    let altText = '';

    const imgEl = tagName === 'img' ? element : element.querySelector('img');
    const picEl = tagName === 'picture' ? element : element.closest('picture');

    if (imgEl) {
      altText = imgEl.getAttribute('alt') || '';
    }

    // 1. Recolectar todas las fuentes candidatas en orden de máxima resolución
    const candidates = [];

    function addSrcset(srcsetString: string) {
      if (!srcsetString || srcsetString.includes('data:image/gif')) return;
      const parts = srcsetString.split(',').map(s => s.trim());
      for (const p of parts) {
        const [u, desc] = p.split(/\s+/);
        if (!u || u.startsWith('data:image/gif')) continue;
        let density = 1;
        let width = 0;
        if (desc) {
          if (desc.endsWith('x')) density = parseFloat(desc) || 1;
          if (desc.endsWith('w')) width = parseInt(desc, 10) || 0;
        }
        candidates.push({ url: u, density, width });
      }
    }

    // A. Analizar <source> dentro de <picture> respetando media queries
    if (picEl) {
      const sources = Array.from(picEl.querySelectorAll('source')) as any[];
      // Encontrar sources que coincidan con el viewport actual
      const matchingSources = sources.filter(s => {
        const media = s.getAttribute('media');
        if (!media) return true;
        try {
          return window.matchMedia(media).matches;
        } catch (_e) {
          return false;
        }
      });

      const activeSource = matchingSources.length > 0 ? matchingSources[0] : null;
      if (activeSource) {
        addSrcset(activeSource.getAttribute('srcset') || activeSource.srcset);
      } else {
        // Fallback: si ninguno coincide por matchMedia, buscar fuente para desktop (min-width)
        const desktopSource = sources.find(s => {
          const m = (s.getAttribute('media') || '').toLowerCase();
          return (
            m.includes('min-width') ||
            (!m.includes('max-width: 734') && !m.includes('max-width: 640') && !m.includes('small'))
          );
        });
        if (desktopSource) {
          addSrcset(desktopSource.getAttribute('srcset') || desktopSource.srcset);
        } else {
          for (const s of sources) {
            addSrcset(s.getAttribute('srcset') || s.srcset);
          }
        }
      }
    }

    // B. Analizar srcset en <img>
    if (imgEl) {
      addSrcset(imgEl.getAttribute('srcset') || imgEl.srcset);
    }

    // C. Atributos de alta resolución comunes en la web (lazyloading, retina)
    if (imgEl) {
      const hiResAttrs = [
        'data-highres',
        'data-original',
        'data-src-retina',
        'data-retina',
        'data-large',
        'data-desktop-src',
        'data-src-desktop',
        'data-full-src',
        'data-src',
        'data-lazy-src',
      ];
      for (const attr of hiResAttrs) {
        const val = imgEl.getAttribute(attr);
        if (val && !val.startsWith('data:image/gif')) {
          candidates.push({ url: val, density: 2, width: 2500 });
        }
      }
    }

    // D. currentSrc y src nativos
    if (imgEl) {
      if (imgEl.currentSrc && !imgEl.currentSrc.startsWith('data:image/gif')) {
        candidates.push({ url: imgEl.currentSrc, density: 1.5, width: imgEl.naturalWidth || 1000 });
      }
      if (imgEl.src && !imgEl.src.startsWith('data:image/gif')) {
        candidates.push({ url: imgEl.src, density: 1, width: imgEl.naturalWidth || 800 });
      }
    }

    // Elegir la URL de mayor resolución (preferir Retina @2x / mayor ancho en píxeles y descartar recortes pequeños de móvil)
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const aIs2x = /(@2x|_2x|_large|_largetall|retina|highres)/i.test(a.url) ? 1 : 0;
        const bIs2x = /(@2x|_2x|_large|_largetall|retina|highres)/i.test(b.url) ? 1 : 0;
        const aIsSmall = /(_small|_thumb|mobile)/i.test(a.url) ? -1 : 0;
        const bIsSmall = /(_small|_thumb|mobile)/i.test(b.url) ? -1 : 0;

        const aScore = a.density * 10 + aIs2x * 5 + aIsSmall * 10;
        const bScore = b.density * 10 + bIs2x * 5 + bIsSmall * 10;

        if (bScore !== aScore) return bScore - aScore;
        if (b.width !== a.width) return b.width - a.width;
        return 0;
      });
      pendingSrc = candidates[0].url;
    }

    if (pendingSrc) {
      if (pendingSrc.startsWith('//')) pendingSrc = window.location.protocol + pendingSrc;
      else if (pendingSrc.startsWith('/')) pendingSrc = window.location.origin + pendingSrc;
    }

    // Dimensiones precisas: la caja visible de la imagen.
    //  - <img> más grande que su <picture> (hero recortado) → caja del <picture>, escala FILL.
    //  - <img> más chico que su <picture> (picture inline con espacio extra, logos) → caja del <img>,
    //    si no, FILL recortaría el logo para llenar una caja con otra proporción.
    let boxRect = rect;
    if (imgEl && picEl) {
      const pRect = picEl.getBoundingClientRect();
      const iRect = imgEl.getBoundingClientRect();
      const fitsInside = iRect.width <= pRect.width + 1 && iRect.height <= pRect.height + 1;
      boxRect = fitsInside && iRect.width > 0 && iRect.height > 0 ? iRect : pRect;
    }
    let imgW = Math.round(boxRect.width);
    let imgH = Math.round(boxRect.height);
    const boxRelX = parentRect ? Math.round(boxRect.left - parentRect.left) : 0;
    const boxRelY = parentRect ? Math.round(boxRect.top - parentRect.top) : 0;
    const imgFitStyle = imgEl ? window.getComputedStyle(imgEl) : style;

    // Fallbacks si las dimensiones medidas son 0 o 1
    if (imgW <= 1 && imgEl && imgEl.naturalWidth > 1) imgW = imgEl.naturalWidth;
    if (imgH <= 1 && imgEl && imgEl.naturalHeight > 1) imgH = imgEl.naturalHeight;
    if (imgW <= 0) imgW = 40;
    if (imgH <= 0) imgH = 40;

    const imgRadius = parseCornerRadius(imgFitStyle);
    const nodeImgRadius = hasAnyRadius(imgRadius) ? imgRadius : parseCornerRadius(style);

    const imgNode: any = {
      id: currentId,
      name: 'Image / ' + (altText || (tagName === 'picture' ? 'Picture' : 'Img')),
      type: 'FRAME',
      layout: {
        mode: 'NONE',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
        width: imgW,
        height: imgH,
        measuredWidth: imgW,
        measuredHeight: imgH,
        x: boxRelX,
        y: boxRelY,
        positioning: style.position === 'absolute' || style.position === 'fixed' ? 'ABSOLUTE' : 'AUTO',
      },
      styles: {
        fills: [],
        cornerRadius: nodeImgRadius,
        imageScaleMode: imgFitStyle.objectFit === 'contain' || imgFitStyle.objectFit === 'scale-down' ? 'FIT' : 'FILL',
      },
      children: [],
    };

    if (pendingSrc) {
      imgNode._pendingImageSrc = pendingSrc;
    }
    imgNode._vpRect = vpRectOf(boxRect);

    return imgNode;
  }

  // ── 8. Fills & Gradients ──
  // Capas CSS: background-color (abajo) + url() + degradados. Se conservan todas;
  // el plugin coloca la imagen entre el color base y los degradados (overlays).
  const fills = [];
  const grads = parseAllGradients(style.backgroundImage);
  const pendingBgSrc = extractBgUrl(style.backgroundImage);
  const bgColor = parseColor(style.backgroundColor);
  if (bgColor && bgColor.a > 0.01) fills.push(bgColor);
  if (grads.length > 0) fills.push(...grads);

  // ── 9. Strokes & Borders en Cualquier Lado ──
  const topW = Math.round(parseFloat(style.borderTopWidth) || 0);
  const rightBW = Math.round(parseFloat(style.borderRightWidth) || 0);
  const bottomW = Math.round(parseFloat(style.borderBottomWidth) || 0);
  let leftBW = Math.round(parseFloat(style.borderLeftWidth) || 0);
  const hasBorder =
    (topW > 0 && style.borderTopStyle !== 'none') ||
    (rightBW > 0 && style.borderRightStyle !== 'none') ||
    (bottomW > 0 && style.borderBottomStyle !== 'none') ||
    (leftBW > 0 && style.borderLeftStyle !== 'none');

  const topColor = parseColor(style.borderTopColor, style.color);
  const bottomColor = parseColor(style.borderBottomColor, style.color);
  const leftColor = parseColor(style.borderLeftColor, style.color);
  const rightColor = parseColor(style.borderRightColor, style.color);

  // Elegir color activo: priorizar los lados que realmente tienen ancho > 0 y estilo !== none
  let activeStrokeColor = null;
  if (leftBW > 0 && leftColor && leftColor.a > 0.01) activeStrokeColor = leftColor;
  else if (topW > 0 && topColor && topColor.a > 0.01) activeStrokeColor = topColor;
  else if (bottomW > 0 && bottomColor && bottomColor.a > 0.01) activeStrokeColor = bottomColor;
  else if (rightBW > 0 && rightColor && rightColor.a > 0.01) activeStrokeColor = rightColor;

  let strokeColor = activeStrokeColor || topColor || leftColor || bottomColor || rightColor;

  // Detección del estilo de trazo discontinuo (DASHED o DOTTED)
  const borderStyles = [
    topW > 0 ? style.borderTopStyle : '',
    rightBW > 0 ? style.borderRightStyle : '',
    bottomW > 0 ? style.borderBottomStyle : '',
    leftBW > 0 ? style.borderLeftStyle : '',
    style.borderTopStyle,
    style.borderRightStyle,
    style.borderBottomStyle,
    style.borderLeftStyle,
  ].filter(s => s && s !== 'none');
  const dashOf = (s: string) => (s === 'dashed' ? 'DASHED' : s === 'dotted' ? 'DOTTED' : 'SOLID');
  const bStyle = borderStyles.find(s => s === 'dashed' || s === 'dotted') || borderStyles[0] || 'solid';
  let strokeDashStyle = dashOf(bStyle);

  let accentBorder: any = undefined;
  // Acento: borde izquierdo DISTINTO del resto del marco (color, ancho o estilo), p. ej. una tarjeta
  // con borde sutil y una barra de color a la izquierda. Un borde izquierdo único no es acento: ya lo
  // dibujan los lados individuales del stroke (con acento además salía dos veces).
  const refSide =
    topW > 0
      ? { w: topW, c: topColor, s: style.borderTopStyle }
      : rightBW > 0
        ? { w: rightBW, c: rightColor, s: style.borderRightStyle }
        : bottomW > 0
          ? { w: bottomW, c: bottomColor, s: style.borderBottomStyle }
          : null;
  if (refSide && refSide.c && leftBW > 0 && leftColor && leftColor.a > 0.01) {
    const rc = refSide.c;
    const distinctColor =
      Math.abs(leftColor.r - rc.r) > 0.08 ||
      Math.abs(leftColor.g - rc.g) > 0.08 ||
      Math.abs(leftColor.b - rc.b) > 0.08 ||
      Math.abs((leftColor.a ?? 1) - (rc.a ?? 1)) > 0.15;
    const distinctWidth = leftBW !== refSide.w;
    const distinctStyle = style.borderLeftStyle !== refSide.s;
    if (distinctColor || distinctWidth || distinctStyle) {
      accentBorder = { side: 'LEFT', color: leftColor, width: leftBW, style: dashOf(style.borderLeftStyle) };
      // El marco conserva el borde del resto de lados; el lado izquierdo lo pinta solo el acento
      strokeColor = rc;
      strokeDashStyle = dashOf(refSide.s);
      leftBW = 0;
    }
  }

  const strokes = [];
  let borderSides = undefined;
  const maxBW = Math.max(topW, rightBW, bottomW, leftBW);
  if (hasBorder && strokeColor && strokeColor.a > 0.01) {
    strokes.push({ ...strokeColor, width: maxBW || 1, align: 'INSIDE', style: strokeDashStyle });
    if (topW !== rightBW || topW !== bottomW || topW !== leftBW) {
      borderSides = { top: topW, right: rightBW, bottom: bottomW, left: leftBW };
    }
  }

  // ── 10. Corner Radius ──
  const cornerRadius = parseCornerRadius(style);

  // ── 11. Box Shadows & Glassmorphism Backdrop Blur ──
  const boxShadow = parseBoxShadow(style.boxShadow);
  let backdropBlur = undefined;
  const bFilter = style.backdropFilter || (style as any).webkitBackdropFilter || '';
  if (bFilter && bFilter.includes('blur(')) {
    const m = bFilter.match(/blur\(([^)]+)\)/);
    if (m && m[1]) {
      const v = parseFloat(m[1]);
      if (!isNaN(v) && v > 0) backdropBlur = Math.round(v);
    }
  }

  // ── 12. Padding ──
  const padding = {
    top: Math.round(parseFloat(style.paddingTop) || 0),
    right: Math.round(parseFloat(style.paddingRight) || 0),
    bottom: Math.round(parseFloat(style.paddingBottom) || 0),
    left: Math.round(parseFloat(style.paddingLeft) || 0),
  };

  // ── 13. Auto Layout Inteligente ──
  // Hijos que generan caja (los display: contents se sustituyen por los suyos, como en el navegador)
  const layoutKids = boxChildren(element);
  let mode = 'NONE';
  let itemSpacing = 0;
  let primaryAlign = 'MIN';
  let counterAlign = 'MIN';
  let layoutWrap = 'NO_WRAP';
  let gridAsWrap = false;

  if (style.display.includes('flex')) {
    mode = style.flexDirection.includes('column') ? 'VERTICAL' : 'HORIZONTAL';
    itemSpacing = Math.round(parseFloat(style.gap || style.rowGap || style.columnGap) || 0);
    const jc = style.justifyContent;
    if (jc.includes('center')) primaryAlign = 'CENTER';
    else if (jc.includes('space-between')) primaryAlign = 'SPACE_BETWEEN';
    else if (jc.includes('end')) primaryAlign = 'MAX';
    const ai = style.alignItems;
    if (ai.includes('center')) counterAlign = 'CENTER';
    else if (ai.includes('end')) counterAlign = 'MAX';
    else if (ai.includes('baseline')) counterAlign = 'BASELINE';
    if (style.flexWrap === 'wrap') layoutWrap = 'WRAP';
  } else if (style.display.includes('grid')) {
    const hasAreas = style.gridTemplateAreas && style.gridTemplateAreas !== 'none';
    const rows = (style.gridTemplateRows || '').split(/\s+/).filter(Boolean);
    const cols = (style.gridTemplateColumns || '').split(/\s+/).filter(Boolean);
    if (hasAreas) {
      // Grid con áreas (ej. aside + header + content): NONE para preservar x, y absolutos
      mode = 'NONE';
    } else if (cols.length > 1 && (rows.length > 1 || layoutKids.length > cols.length)) {
      // Grid 2D de celdas (tarjetas, galerías) → Auto Layout con wrap de Figma, editable (fase 5.6).
      // fitWrapToGeometry comprueba que las filas sean regulares; si no, vuelve a posiciones exactas.
      mode = 'HORIZONTAL';
      layoutWrap = 'WRAP';
      gridAsWrap = true;
      itemSpacing = Math.round(parseFloat(style.columnGap || style.gap) || 0);
    } else if (cols.length <= 1) {
      mode = 'VERTICAL';
      itemSpacing = Math.round(parseFloat(style.rowGap || style.gap) || 0);
    } else {
      mode = 'HORIZONTAL';
      layoutWrap = 'NO_WRAP';
      itemSpacing = Math.round(parseFloat(style.columnGap || style.gap) || 0);
    }
  } else if (
    tagName === 'button' ||
    element.getAttribute('role') === 'button' ||
    (element.className && typeof element.className === 'string' && element.className.includes('btn'))
  ) {
    mode = 'HORIZONTAL';
    primaryAlign = 'CENTER';
    counterAlign = 'CENTER';
    itemSpacing = Math.round(parseFloat(style.gap) || 8);
  } else if (tagName === 'input' || tagName === 'select') {
    mode = 'HORIZONTAL';
    counterAlign = 'CENTER';
  } else if (tagName === 'tr' || style.display === 'table-row') {
    mode = 'HORIZONTAL';
    itemSpacing = 8;
    counterAlign = 'CENTER';
  } else if (['tbody', 'table', 'thead', 'tfoot'].includes(tagName) || style.display.includes('table')) {
    mode = 'VERTICAL';
  } else if (
    style.display === 'block' ||
    style.display === 'flow-root' ||
    ['form', 'section', 'article', 'fieldset'].includes(tagName)
  ) {
    if (layoutKids.length >= 2) {
      mode = 'VERTICAL';
      itemSpacing = Math.round(parseFloat(style.gap) || 0);
    }
  }

  // ── Inferencia Geométrica Real basada en posición de hijos en el DOM ──
  // Si los hijos están uno al lado del otro en el mismo eje Y -> ES HORIZONTAL (ej. KPI cards, grids de Tailwind)
  // Si los hijos están uno debajo del otro y el CSS gap es 0 (porque usaron margin) -> descubrir itemSpacing real
  const visibleChildren = (layoutKids as any[]).filter(ch => {
    const cs = window.getComputedStyle(ch);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
  });

  // Escena interactiva con lienzo 3D o visor: los elementos hijos (etiquetas, tarjetas de llamada, controles)
  // deben colocarse en sus coordenadas exactas relX, relY respecto al escenario, sin Auto Layout.
  // Solo cuenta un HIJO DIRECTO que ocupe al menos media caja (el escenario); antes se buscaba en todos
  // los descendientes y cualquier video o canvas dejaba sin Auto Layout a toda la cadena de ancestros.
  const elArea = Math.max(1, rect.width * rect.height);
  const hasCanvasOrViewer = layoutKids.some((c: Element) => {
    if (!c.matches('canvas, video, model-viewer, [data-engine]')) return false;
    const cr = c.getBoundingClientRect();
    return cr.width * cr.height >= elArea * 0.5;
  });

  if (visibleChildren.length >= 2 && !isWholePage) {
    // 0. Comprobar si los hijos visibles se solapan físicamente en 2D (ej. capa de fondo y contenido encima)
    let hasSignificantOverlap = false;
    for (let i = 0; i < visibleChildren.length; i++) {
      for (let j = i + 1; j < visibleChildren.length; j++) {
        const ra = visibleChildren[i].getBoundingClientRect();
        const rb = visibleChildren[j].getBoundingClientRect();
        const ox = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
        const oy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
        const overlapArea = ox * oy;
        const minArea = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (minArea > 0 && overlapArea / minArea > 0.35) {
          hasSignificantOverlap = true;
          break;
        }
      }
      if (hasSignificantOverlap) break;
    }

    // Pista de carrusel: slides desplazadas (transform/scroll) fuera del contenedor.
    // Modo NONE conserva su x real, así el frame recortado muestra la misma slide activa que la web.
    const isTrack = !hasSignificantOverlap && isCarouselTrack(element, rect, visibleChildren);
    if (isTrack) {
      mode = 'NONE';
    } else if (hasSignificantOverlap) {
      // Contenedor tipo Hero Banner / Stack con capas superpuestas:
      // Debe ser modo NONE para que las capas de fondo y overlays queden en sus posiciones exactas relX, relY
      // sin empujar el contenido hacia los lados.
      mode = 'NONE';
    } else {
      // 1. Separar hijos en flujo normal vs hijos absolutos / fixed
      const inFlowChildren = visibleChildren.filter(ch => {
        const cs = window.getComputedStyle(ch);
        return cs.position !== 'absolute' && cs.position !== 'fixed';
      });

      // 2. Si hay múltiples hijos en flujo normal, determinar si apilan vertical u horizontalmente
      if (inFlowChildren.length >= 2) {
        if (hasCanvasOrViewer) {
          mode = 'NONE';
        } else {
          // Geometría en ORDEN VISUAL (no en orden DOM): CSS `order`, `flex-direction: *-reverse`
          // o grid pueden pintar los hijos en otro orden. Los hijos luego se ordenan por x/y.
          const rects = inFlowChildren.map(ch => ch.getBoundingClientRect()).filter(r => r.width > 0 || r.height > 0);
          const TOL = 4;
          const byTop = [...rects].sort((a, b) => a.top - b.top);
          const byLeft = [...rects].sort((a, b) => a.left - b.left);
          let isVerticalStack = rects.length >= 2;
          let isHorizontalStack = rects.length >= 2;
          for (let i = 0; i < rects.length - 1; i++) {
            // Columna: cada hijo (en orden visual) empieza más abajo que el anterior
            if (byTop[i + 1].top < byTop[i].top + 8) isVerticalStack = false;
            // Fila: cada hijo empieza más a la derecha que el anterior Y comparten franja vertical
            const a = byLeft[i],
              b = byLeft[i + 1];
            const shareRow = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOL;
            if (b.left < a.left + 8 || !shareRow) isHorizontalStack = false;
          }

          if (isVerticalStack && !isHorizontalStack) {
            mode = 'VERTICAL';
            const measuredGap = Math.round(byTop[1].top - byTop[0].bottom);
            if (measuredGap >= 0 && measuredGap < 150) itemSpacing = measuredGap;
          } else if (isHorizontalStack && !isVerticalStack) {
            mode = 'HORIZONTAL';
            const measuredGap = Math.round(byLeft[1].left - byLeft[0].right);
            if (measuredGap >= 0 && measuredGap < 150) itemSpacing = measuredGap;
          } else if (!isVerticalStack && !isHorizontalStack && layoutWrap !== 'WRAP' && rects.length >= 2) {
            // Ni fila ni columna (ej. barra de puntos debajo de un carrusel pero primera en el DOM):
            // Auto Layout los reacomodaría mal y empujaría contenido fuera del frame → posiciones exactas.
            mode = 'NONE';
          }
        }
      } else if (inFlowChildren.length === 1) {
        // Contenedor con 1 solo hijo en flujo (los demás son fondos o overlays absolutos)
        if (
          style.justifyContent.includes('center') ||
          style.alignItems.includes('center') ||
          style.textAlign.includes('center')
        ) {
          primaryAlign = 'CENTER';
          counterAlign = 'CENTER';
        }
      }
    }

    // Centrado de elementos: si el texto o el contenedor está centrado, alinear al centro
    if (
      style.textAlign.includes('center') ||
      style.alignItems.includes('center') ||
      style.justifyContent.includes('center')
    ) {
      counterAlign = 'CENTER';
    }
  }

  // Shells de aplicación y pantallas completas: SIEMPRE modo NONE para que el menú quede a la izquierda en x=0
  const cName = (typeof element.className === 'string' ? element.className : '').toLowerCase();
  const idAttr = (typeof element.id === 'string' ? element.id : '').toLowerCase();
  const isSearchContainer = cName.includes('search') || idAttr.includes('search');
  const isLayoutShell = isWholePage || (['body', 'app-root', 'router-outlet'].includes(tagName) && isRoot);

  if (isLayoutShell) {
    mode = 'NONE';
  }

  // ── 14. Nombre Semántico ──
  const semanticName = getSemanticName(element, tagName, style, rect);

  // ── 15. Texto Terminal Puro ──
  // Hoja de texto, o raíz "todo inline" (<p>texto <a>link</a><sup>1</sup></p>) → UN solo TEXT
  const isDirectText =
    element.textContent &&
    element.textContent.trim().length > 0 &&
    (element.children.length === 0 || isInlineTextRoot(element));
  const rich =
    isDirectText && !['input', 'textarea', 'select'].includes(tagName) ? buildRichText(element, style) : null;
  if (
    isDirectText &&
    rich &&
    rich.characters &&
    !fills.length &&
    !strokes.length &&
    !pendingBgSrc &&
    padding.top === 0 &&
    padding.bottom === 0 &&
    tagName !== 'input' &&
    tagName !== 'textarea' &&
    tagName !== 'select' &&
    !pseudoHasImage(element, '::before') &&
    !pseudoHasImage(element, '::after')
  ) {
    const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
    const rawText = rich.characters;

    let textAlign = 'LEFT';
    if (style.textAlign.includes('center')) textAlign = 'CENTER';
    else if (style.textAlign.includes('right')) textAlign = 'RIGHT';
    else if (style.textAlign.includes('justify')) textAlign = 'JUSTIFIED';

    const measuredW = Math.round(rect.width);
    const measuredH = Math.round(rect.height);

    const fontSize = parseFloat(style.fontSize) || 14;
    let parsedLineHeight = undefined;
    if (style.lineHeight && style.lineHeight !== 'normal') {
      const lhVal = parseFloat(style.lineHeight);
      if (!isNaN(lhVal)) {
        parsedLineHeight = style.lineHeight.endsWith('px') ? Math.round(lhVal) : Math.round(lhVal * fontSize);
      }
    }
    const effLineHeight = parsedLineHeight || Math.round(fontSize * 1.3);

    // Detección precisa de multilínea
    const isMultiline = rich.lines > 1 || measuredH > effLineHeight * 1.35 || rawText.includes('\n');

    // Letter-spacing con precisión decimal (ej. 0.231px o -0.374px)
    let parsedLetterSpacing = undefined;
    if (style.letterSpacing && style.letterSpacing !== 'normal') {
      const lsVal = parseFloat(style.letterSpacing);
      if (!isNaN(lsVal) && Math.abs(lsVal) > 0.005) {
        parsedLetterSpacing = Math.round(lsVal * 1000) / 1000;
      }
    }

    // Determinar dimensionamiento inteligente (FILL vs HUG vs FIXED):
    let textWidth: any = 'HUG';
    const isBlockTag = [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'li',
      'div',
      'section',
      'article',
    ].includes(tagName);
    const isParentVertical = parentLayout && parentLayout.mode === 'VERTICAL';
    const isParentHorizontal = parentLayout && parentLayout.mode === 'HORIZONTAL';

    if (isParentVertical) {
      if (isMultiline || isBlockTag || (parentRect && Math.abs(measuredW - parentRect.width) <= 24)) {
        textWidth = 'FILL';
      }
    } else if (!isParentHorizontal && isMultiline && measuredW > 0) {
      textWidth = measuredW;
    }

    const cleanFontFamily = style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter';

    const textLeaf: RawNode = {
      id: currentId,
      name: semanticName,
      type: 'TEXT',
      layout: {
        mode: 'NONE',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
        width: textWidth,
        height: isMultiline ? 'HUG' : measuredH > 0 ? measuredH : 'HUG',
        measuredWidth: measuredW,
        measuredHeight: measuredH,
        x: relX,
        y: relY,
      },
      styles: { fills: [tc], ...textEffects(style) },
      textData: {
        characters: rawText,
        fontSize: Math.round(fontSize),
        fontWeight: style.fontWeight || 400,
        fontFamily: cleanFontFamily,
        // Pila CSS completa: el plugin prueba cada familia en orden (fase 5.3)
        fontStack: style.fontFamily || undefined,
        lineHeight: parsedLineHeight,
        letterSpacing: parsedLetterSpacing,
        textAlign,
        isMultiline,
        // Saltos de línea medidos en el navegador: Figma no debe re-acomodar el texto
        noWrap: rich.linesPreserved || undefined,
        lineCount: rich.lines,
        segments: rich.segments || undefined,
      },
    };
    // Líneas con márgenes distintos (texto que rodea un float): un texto por grupo de líneas
    const textOut = splitTextAroundFloats(textLeaf, rich, measuredW);
    textOut._paint = paintLayerOf(element, style);
    return textOut;
  }

  // ── 16. Dimensiones y Sizing (FILL vs HUG vs FIXED) ──
  const measuredW = Math.round(rect.width);
  const measuredH = Math.round(rect.height);

  let initialWidth;
  let initialHeight;

  if (isWholePage) {
    // Página completa: TODO el documento, no solo la primera pantalla (antes se usaba el alto de
    // la ventana y, con clipsContent, en Figma solo se veía el hero).
    const docH = Math.max(
      measuredH,
      document.documentElement.scrollHeight || 0,
      document.body ? document.body.scrollHeight : 0,
    );
    initialWidth = measuredW > 0 ? measuredW : vpW || 1440;
    initialHeight = docH > 0 ? Math.round(docH) : vpH || 900;
  } else if (isRoot) {
    initialWidth = measuredW > 0 ? measuredW : 'HUG';
    initialHeight = mode !== 'NONE' && element.children.length > 0 ? 'HUG' : measuredH > 0 ? measuredH : 'HUG';
  } else {
    initialWidth = measuredW;
    initialHeight = measuredH > 0 ? measuredH : 'HUG';
  }

  // Detección de Badges / Pills / Tags compactos
  const isBadge =
    (typeof element.className === 'string' &&
      (element.className.includes('badge') ||
        element.className.includes('pill') ||
        element.className.includes('role') ||
        element.className.includes('tag'))) ||
    (parseFloat(style.borderRadius) >= 12 && measuredH <= 32 && measuredW < 200);

  // Si está dentro de Auto Layout Vertical del padre y ocupa el ancho del contenido del padre -> FILL
  if (parentLayout && parentLayout.mode === 'VERTICAL' && parentRect) {
    const parentContentW = parentRect.width - (parentLayout.padding?.left || 0) - (parentLayout.padding?.right || 0);
    if (
      !isBadge &&
      (Math.abs(measuredW - parentContentW) <= 8 ||
        style.width === '100%' ||
        (style.display === 'block' && Math.abs(measuredW - parentContentW) <= 16))
    ) {
      initialWidth = 'FILL';
    }
  }

  // ¿HUG reproduce el ancho de la web? Solo si el elemento mide lo que su contenido + padding + borde.
  // Un círculo de 20 px con un "1" (ancho fijo, centrado) quedaba en Figma de 7 px: una barrita sin
  // número. Lo mismo un botón de ancho fijo. Entonces se conserva el ancho medido.
  const hugFitsWidth = (() => {
    let left = Infinity,
      right = -Infinity;
    for (const n of Array.from(element.childNodes) as any[]) {
      let r: DOMRect | null = null;
      if (n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim()) {
        const rg = document.createRange();
        rg.selectNodeContents(n);
        r = rg.getBoundingClientRect();
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        r = n.getBoundingClientRect();
      }
      if (r && r.width > 0) {
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
      }
    }
    if (!isFinite(left)) return true;
    const chrome =
      (parseFloat(style.paddingLeft) || 0) +
      (parseFloat(style.paddingRight) || 0) +
      (parseFloat(style.borderLeftWidth) || 0) +
      (parseFloat(style.borderRightWidth) || 0);
    return measuredW <= right - left + chrome + 2;
  })();

  // Si es un badge o pill, NUNCA debe ser FILL y debe tener Auto Layout centrado
  if (isBadge) {
    initialWidth = hugFitsWidth ? 'HUG' : measuredW;
    initialHeight = measuredH > 0 ? measuredH : 'HUG';
    if (mode === 'NONE') {
      mode = 'HORIZONTAL';
      primaryAlign = 'CENTER';
      counterAlign = 'CENTER';
    }
  }

  // Botones y badges que se ajustan al texto -> HUG (excepto si ocupa todo el ancho o es trigger/input de búsqueda)
  const isSearchOrFullWidth =
    initialWidth === 'FILL' ||
    (parentRect &&
      Math.abs(
        measuredW - (parentRect.width - (parentLayout?.padding?.left || 0) - (parentLayout?.padding?.right || 0)),
      ) <= 8) ||
    (typeof element.className === 'string' && element.className.includes('search'));

  if (
    (tagName === 'button' || semanticName.startsWith('Button') || semanticName.startsWith('Badge') || isBadge) &&
    !isSearchOrFullWidth &&
    !style.width?.includes('%') &&
    measuredW < 250 &&
    hugFitsWidth
  ) {
    initialWidth = 'HUG';
  }

  if (isRoot && fills.length === 0) {
    // Heredar el color de fondo visible del primer ancestro opaco (wrapper, body, html)
    let cur = element.parentElement;
    let inheritedBg = null;
    let inheritedGrad = null;
    while (cur && cur !== document.documentElement) {
      const cs = window.getComputedStyle(cur);
      const g = parseGradient(cs.backgroundImage);
      if (g) {
        inheritedGrad = g;
        break;
      }
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0.05) {
        inheritedBg = c;
        break;
      }
      cur = cur.parentElement;
    }

    if (!inheritedBg && !inheritedGrad && document.body) {
      const cs = window.getComputedStyle(document.body);
      const g = parseGradient(cs.backgroundImage);
      if (g) inheritedGrad = g;
      else {
        const c = parseColor(cs.backgroundColor);
        if (c && c.a > 0.05) inheritedBg = c;
      }
    }

    if (!inheritedBg && !inheritedGrad && document.documentElement) {
      const cs = window.getComputedStyle(document.documentElement);
      const g = parseGradient(cs.backgroundImage);
      if (g) inheritedGrad = g;
      else {
        const c = parseColor(cs.backgroundColor);
        if (c && c.a > 0.05) inheritedBg = c;
      }
    }

    if (inheritedGrad) {
      fills.push(inheritedGrad);
    } else {
      // Si toda la página es transparente en CSS, el navegador pinta blanco por defecto (#FFFFFF)
      fills.push(inheritedBg || { r: 1, g: 1, b: 1, a: 1 });
    }
  }

  const currentLayout = {
    mode,
    primaryAxisAlignItems: primaryAlign,
    counterAxisAlignItems: counterAlign,
    padding,
    itemSpacing,
    width: initialWidth,
    height: initialHeight,
    measuredWidth: Math.round(rect.width),
    measuredHeight: isWholePage && typeof initialHeight === 'number' ? initialHeight : Math.round(rect.height),
    positioning: style.position === 'absolute' || style.position === 'fixed' ? 'ABSOLUTE' : 'AUTO',
    layoutWrap,
    x: relX,
    y: relY,
  };

  const node: any = {
    id: currentId,
    name: semanticName,
    type: 'FRAME',
    layout: currentLayout,
    styles: {
      fills,
      strokes,
      borderSides,
      accentBorder: accentBorder || undefined,
      cornerRadius,
      opacity: parseFloat(style.opacity) || 1,
      boxShadow,
      backdropBlur,
    },
    children: [],
    // Recorte según el CSS (overflow): si la web recorta, Figma también; si no, el contenido desbordado se ve
    clipsContent:
      isWholePage || CLIPPING_OVERFLOW.test(style.overflowX) || CLIPPING_OVERFLOW.test(style.overflowY)
        ? true
        : undefined,
  };
  // ── 16a. Capa de pintado (QA-8): z-index de posicionados y de hijos flex/grid ──
  node._paint = paintLayerOf(element, style);

  // ── 16b. Efectos CSS (fase 5.4): nativos en Figma o, si no hay equivalente, rasterizar ──
  const filterInfo = parseCssFilter(style.filter);
  if (filterInfo.layerBlur) node.styles.layerBlur = Math.round(filterInfo.layerBlur * 10) / 10;
  if (filterInfo.dropShadows.length) node.styles.dropShadows = filterInfo.dropShadows;
  if (filterInfo.opacity < 1) node.styles.opacity = Math.round(node.styles.opacity * filterInfo.opacity * 1000) / 1000;
  const blendMode = BLEND_MODES[style.mixBlendMode];
  if (blendMode) node.styles.blendMode = blendMode;
  // Cuadrícula / puntos de fondo como mosaico (antes de decidir el rasterizado: si el mosaico ya
  // reproduce todas las capas repetidas, no hace falta una captura que se lleve el contenido)
  const gridTile = generateGridPatternTile(style.backgroundImage, style.backgroundSize);
  let rasterReason = effectsNeedingRaster(style, filterInfo);
  if (rasterReason === 'degradado repetido' && gridTile) {
    const repeating = splitCssList(style.backgroundImage)
      .map((l, i) => (/^\s*repeating-/i.test(l) ? i : -1))
      .filter(i => i >= 0);
    if (repeating.every(i => gridTile.layers.includes(i))) rasterReason = null;
  }
  if (rasterReason) {
    node.metadata = { ...(node.metadata || {}), cssEffect: rasterReason };
    // Solo elementos de tamaño razonable y sin hijos estructurados de UI (evitar borrar tarjetas o textos editables)
    const vpArea = (window.innerWidth || 1440) * (window.innerHeight || 900);
    const hasRichUiChildren =
      element.children.length > 1 &&
      (!!element.querySelector('p, h1, h2, h3, h4, h5, h6, button, a, [role="button"], input, article, section') ||
        element.querySelectorAll('div, span, p, a, button').length >= 4);
    if (!hasRichUiChildren && rect.width > 2 && rect.height > 2 && rect.width * rect.height <= vpArea * 1.5) {
      node._rasterize = rasterReason;
      node._vpRect = vpRectOf(rect);
    }
  }
  if (gridTile) {
    // El mosaico reemplaza a las capas que lo dibujaban (si no, salían estiradas encima); las demás
    // capas (viñetas, brillos) siguen como degradados sobre él
    node.styles.fills = [
      ...node.styles.fills.filter((f: any) => !grads.includes(f)),
      ...gradientsExcept(style.backgroundImage, gridTile.layers),
    ];
    node.imageData = gridTile.tile;
    node.styles.imageScaleMode = 'TILE';
  } else if (pendingBgSrc) {
    node._pendingBgImageSrc = pendingBgSrc;
    node.styles.imageScaleMode = bgScaleMode(style);
    node._vpRect = vpRectOf(rect);
  }

  // ── 17. Form Elements: Inputs & Selects con Contenido Real ──
  // Un párrafo "todo inline" (texto con <a>, <small>, <b>…) que lleva padding, fondo o borde también
  // va por aquí: frame con ese padding y UN solo texto con estilos. Antes se troceaba en piezas
  // sueltas (texto de varias líneas + el enlace + el punto, cada una con su posición) y, con la fuente
  // sustituta de Figma, el párrafo se reacomodaba y las piezas se montaban (notas al pie de apple.com).
  const inlineRichRoot = !!(isDirectText && rich && rich.characters && element.children.length > 0);
  if (element.children.length === 0 || inlineRichRoot) {
    let txt = (element.textContent || '').trim();
    txt = transformText(txt, style.textTransform);

    if (tagName === 'input' || tagName === 'textarea') {
      let val = element.value || element.placeholder || '';
      let isPlaceholder = !element.value;
      if (!val) {
        if (element.type === 'password') {
          val = '••••••••';
          isPlaceholder = false;
        } else {
          const pWrap = element.closest('.mb-4, .form-group, div');
          const lbl = pWrap?.querySelector('label')?.textContent?.trim();
          if (lbl) {
            val = 'Ingresar ' + lbl.toLowerCase();
          } else if (element.type === 'email') {
            val = 'correo@ejemplo.com';
          } else {
            val = 'Escribe aquí...';
          }
          isPlaceholder = true;
        }
      }

      const tc = isPlaceholder
        ? { r: 0.6, g: 0.65, b: 0.7, a: 1 }
        : parseColor(style.color) || { r: 0.15, g: 0.2, b: 0.25, a: 1 };

      node.children.push({
        id: currentId + '_val',
        name: isPlaceholder ? 'Placeholder / ' + val : 'Value / ' + val.slice(0, 15),
        type: 'TEXT',
        layout: {
          mode: 'NONE',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: 'HUG',
          height: 'HUG',
          x: padding.left || 12,
          y: 0,
        },
        styles: { fills: [tc] },
        textData: {
          characters: val,
          fontSize: Math.round(parseFloat(style.fontSize) || 14),
          fontWeight: 400,
          fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter',
          fontStack: style.fontFamily || undefined,
        },
      });
    } else if (tagName === 'select') {
      const selTxt =
        element.options && element.selectedIndex >= 0 && element.options[element.selectedIndex]
          ? element.options[element.selectedIndex].text.trim()
          : 'Seleccionar...';
      const tc = parseColor(style.color) || { r: 0.2, g: 0.25, b: 0.3, a: 1 };
      node.children.push({
        id: currentId + '_sel',
        name: 'Selected / ' + selTxt,
        type: 'TEXT',
        layout: {
          mode: 'NONE',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: 'FILL',
          height: 'HUG',
          x: padding.left || 12,
          y: 0,
        },
        styles: { fills: [tc] },
        textData: {
          characters: selTxt,
          fontSize: Math.round(parseFloat(style.fontSize) || 14),
          fontWeight: 400,
          fontFamily: 'Inter',
        },
      });
      // Icono Chevron Down
      node.children.push({
        id: currentId + '_chevron',
        name: 'Icon / ChevronDown',
        type: 'SVG',
        layout: {
          mode: 'NONE',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: 16,
          height: 16,
          x: 0,
          y: 0,
        },
        styles: { fills: [] },
        svgContent:
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      });
    } else if (txt.length > 0) {
      const clsName = typeof element.className === 'string' ? element.className : '';
      if (isIconFont(style.fontFamily, txt, clsName) && rect.width <= 128 && rect.height <= 128) {
        const iconImg = renderIconFontToDataUrl(txt, style, rect.width, rect.height);
        if (iconImg) {
          node.imageData = iconImg;
          node.name = 'Icon / ' + (txt.length > 20 ? 'Glyph' : txt);
          node.styles.imageScaleMode = 'FIT';
          return node;
        }
      }

      const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };

      // Asegurar Auto Layout en frames contenedores de texto (badges, pills, botones, versión)
      if (
        node.layout.mode === 'NONE' &&
        (padding.top > 0 || padding.left > 0 || fills.length > 0 || strokes.length > 0 || isBadge)
      ) {
        node.layout.mode = 'HORIZONTAL';
        node.layout.counterAxisAlignItems = 'CENTER';
        if (style.textAlign.includes('center') || isBadge) {
          node.layout.primaryAxisAlignItems = 'CENTER';
        }
      }

      let textAlignment = 'LEFT';
      if (style.textAlign.includes('center')) textAlignment = 'CENTER';
      else if (style.textAlign.includes('right')) textAlignment = 'RIGHT';

      // Iconos en ::before / ::after de un elemento de solo texto (ej. <p class="ico">)
      // Párrafo inline con padding: conserva sus ::before/::after decorativos como cuando se troceaba
      const leafBefore =
        pseudoHasImage(element, '::before') || inlineRichRoot
          ? extractPseudoElement(element, '::before', rect, currentLayout, counter)
          : null;
      const leafAfter =
        pseudoHasImage(element, '::after') || inlineRichRoot
          ? extractPseudoElement(element, '::after', rect, currentLayout, counter)
          : null;
      // Solo un pseudo en flujo (icono junto al texto) convierte la caja en fila; uno absoluto no
      const inFlowPseudo = [leafBefore, leafAfter].some(p => p && p.layout?.positioning !== 'ABSOLUTE');
      if (inFlowPseudo) {
        node.layout.mode = 'HORIZONTAL';
        node.layout.counterAxisAlignItems = 'CENTER';
        const ps = window.getComputedStyle(element, leafBefore ? '::before' : '::after');
        node.layout.itemSpacing = Math.round(parseFloat(leafBefore ? ps.marginRight : ps.marginLeft) || 6);
      }
      if (leafBefore) node.children.push(leafBefore);

      const labelRich = buildRichText(element, style);
      if (labelRich.characters) txt = labelRich.characters;

      node.children.push({
        id: currentId + '_text',
        name: isBadge ? 'Badge / ' + txt : 'Label',
        type: 'TEXT',
        layout: {
          mode: 'NONE',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: 'HUG',
          height: 'HUG',
          x: 0,
          y: 0,
        },
        styles: { fills: [tc] },
        textData: {
          characters: txt,
          fontSize: Math.round(parseFloat(style.fontSize) || 14),
          fontWeight: style.fontWeight || 500,
          fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter',
          fontStack: style.fontFamily || undefined,
          textAlign: textAlignment,
          lineHeight:
            style.lineHeight && style.lineHeight.endsWith('px') ? Math.round(parseFloat(style.lineHeight)) : undefined,
          isMultiline: labelRich.lines > 1,
          noWrap: labelRich.linesPreserved || undefined,
          lineCount: labelRich.lines,
          segments: labelRich.segments || undefined,
        },
      });
      if (leafAfter) node.children.push(leafAfter);
      // Celdas de tabla (fase 5.5): vertical-align y text-align ubican el texto dentro de la celda
      if (style.display === 'table-cell') alignTableCell(node, style);
    } else {
      // Caja vacía con decoración en ::before/::after (brillos, formas de fondo, iconos):
      // antes solo se extraían los pseudo-elementos de elementos con hijos y se perdían
      const decoBefore = extractPseudoElement(element, '::before', rect, currentLayout, counter);
      if (decoBefore) node.children.push(decoBefore);
      const decoAfter = extractPseudoElement(element, '::after', rect, currentLayout, counter);
      if (decoAfter) node.children.push(decoAfter);
    }
  } else {
    // ── 17.5 Pseudo-elemento ::before ──
    const beforeNode = extractPseudoElement(element, '::before', rect, currentLayout, counter);
    if (beforeNode) node.children.push(beforeNode);

    // ── 18. Hijos Recursivos ──
    const kidsOf = (el: any): ChildNode[] => {
      if (el.shadowRoot) return [...el.shadowRoot.childNodes];
      if (el.localName === 'slot') {
        const a = el.assignedNodes({ flatten: true });
        return a.length ? a : [...el.childNodes];
      }
      return [...el.childNodes];
    };
    // Hijos sin caja (display: contents, <slot>): sus hijos van directamente a este nodo, medidos
    // contra esta caja, como los coloca el navegador
    const expandBoxless = (nodes: ChildNode[]): ChildNode[] =>
      nodes.flatMap(n =>
        n.nodeType === Node.ELEMENT_NODE && isBoxless(n as Element) ? expandBoxless(kidsOf(n)) : [n],
      );
    const __kids = expandBoxless(kidsOf(element));
    const elementStyle = style;
    for (const child of __kids) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const cn = extractNodeTree(child, counter, rect, currentLayout);
        if (cn) node.children.push(cn);
      } else if (child.nodeType === Node.TEXT_NODE) {
        // Texto suelto dentro de un contenedor sin caja: se mide contra esta caja, pero conserva el
        // color y la fuente que hereda de ese contenedor
        const parentEl = child.parentElement;
        const style = parentEl && parentEl !== element ? window.getComputedStyle(parentEl) : elementStyle;
        // Espacios como los colapsa el navegador: antes se copiaban los saltos de línea y tabulaciones
        // del código fuente ("$45.900 o" / "$62.900 o" salían en líneas separadas y sangradas)
        const ws = style.whiteSpace || 'normal';
        let raw = child.textContent || '';
        if (ws === 'pre-line') raw = raw.replace(/[ \t\r\f]+/g, ' ').replace(/ *\n */g, '\n');
        else if (!/^pre|break-spaces/.test(ws)) raw = raw.replace(/[ \t\n\r\f]+/g, ' ');
        raw = raw.trim();
        if (raw.length > 0) {
          raw = transformText(raw, style.textTransform);
          const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
          let tx = 0,
            ty = 0;
          let tw = 0,
            th = 0;
          try {
            const r = document.createRange();
            r.selectNodeContents(child);
            const tr = r.getBoundingClientRect();
            if (tr.width > 0) {
              tx = Math.round(tr.left - rect.left);
              ty = Math.round(tr.top - rect.top);
              tw = Math.round(tr.width);
              th = Math.round(tr.height);
            }
          } catch (_e) {}

          const nodeFontSize = parseFloat(style.fontSize) || 14;
          let nodeLh = undefined;
          if (style.lineHeight && style.lineHeight !== 'normal') {
            const lhV = parseFloat(style.lineHeight);
            if (!isNaN(lhV))
              nodeLh = style.lineHeight.endsWith('px') ? Math.round(lhV) : Math.round(lhV * nodeFontSize);
          }
          const effLh = nodeLh || Math.round(nodeFontSize * 1.3);
          const isNodeMulti = th > effLh * 1.35 || raw.includes('\n');

          let nodeLs = undefined;
          if (style.letterSpacing && style.letterSpacing !== 'normal') {
            const lsV = parseFloat(style.letterSpacing);
            if (!isNaN(lsV) && Math.abs(lsV) > 0.005) nodeLs = Math.round(lsV * 1000) / 1000;
          }

          let childWidth: any = 'HUG';
          if (currentLayout && currentLayout.mode === 'VERTICAL') {
            if (isNodeMulti || (rect.width > 0 && Math.abs(tw - rect.width) <= 24)) {
              childWidth = 'FILL';
            }
          } else if (isNodeMulti && tw > 0) {
            childWidth = tw;
          }

          node.children.push({
            id: currentId + '_txt_' + ++counter.id,
            name: 'Text / ' + raw.slice(0, 15),
            type: 'TEXT',
            layout: {
              mode: 'NONE',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: childWidth,
              height: isNodeMulti ? 'HUG' : th > 0 ? th : 'HUG',
              measuredWidth: tw,
              measuredHeight: th,
              x: tx,
              y: ty,
            },
            styles: { fills: [tc] },
            textData: {
              characters: raw,
              fontSize: Math.round(nodeFontSize),
              fontWeight: style.fontWeight || 400,
              fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter',
              fontStack: style.fontFamily || undefined,
              lineHeight: nodeLh,
              letterSpacing: nodeLs,
              textAlign: style.textAlign.includes('center')
                ? 'CENTER'
                : style.textAlign.includes('right')
                  ? 'RIGHT'
                  : 'LEFT',
              isMultiline: isNodeMulti,
              // Una sola línea en la web → una sola línea en Figma: si la fuente sustituta es más ancha,
              // el plugin no la parte (antes los textos sueltos junto a otros elementos se partían)
              noWrap: !isNodeMulti && tw > 0 ? true : undefined,
              lineCount: !isNodeMulti && tw > 0 ? 1 : undefined,
            },
          });
        }
      }
    }

    // ── 18.5 Pseudo-elemento ::after ──
    const afterNode = extractPseudoElement(element, '::after', rect, currentLayout, counter);
    if (afterNode) node.children.push(afterNode);
  }

  // ── 19. Corrección de Dimensiones Colapsadas ──
  if (node.children.length > 0) {
    let mb = 0;
    let mr = 0;
    for (const ch of node.children) {
      const cy = ch.layout?.y || 0;
      const ch2 = typeof ch.layout?.height === 'number' ? ch.layout.height : ch.layout?.measuredHeight || 40;
      if (cy + ch2 > mb) mb = cy + ch2;
      const cx = ch.layout?.x || 0;
      const cw = typeof ch.layout?.width === 'number' ? ch.layout.width : ch.layout?.measuredWidth || 40;
      if (cx + cw > mr) mr = cx + cw;
    }

    const curH = typeof node.layout.height === 'number' ? node.layout.height : node.layout.measuredHeight || 0;
    const curW = typeof node.layout.width === 'number' ? node.layout.width : node.layout.measuredWidth || 0;

    // Contenedor colapsado a 0 en la web (p. ej. todos sus hijos son absolutos): se agranda solo hasta
    // abarcar a sus hijos, nunca al tamaño del padre (con el body de padre medía lo que la página).
    // Una caja de área 0 no pinta su fondo en la web, así que al agrandarla su fondo se quita para no
    // tapar lo de debajo. Si la web la recorta (overflow), sus hijos no se ven allí: se deja como está.
    if (!node.clipsContent) {
      if (curH < 1 && mb > 0) {
        node.layout.height = mb;
        node.layout.measuredHeight = mb;
        node.styles.fills = [];
      }
      if (curW < 1 && mr > 0) {
        node.layout.width = mr;
        node.layout.measuredWidth = mr;
        node.styles.fills = [];
      }
    }
  }

  // ── 20. Ordenamiento Geométrico de Hijos para Auto Layout ──
  // Garantiza que en Auto Layout horizontal los elementos aparezcan estrictamente de izquierda a derecha,
  // y en Auto Layout vertical de arriba a abajo, evitando inversiones por orden del DOM o CSS order/reverse.
  if (node.children.length > 1) {
    if (mode === 'NONE') {
      node.children.sort((a: RawNode, b: RawNode) => {
        const pW = (typeof node.layout?.width === 'number' ? node.layout.width : node.layout?.measuredWidth) || 200;
        const pH = (typeof node.layout?.height === 'number' ? node.layout.height : node.layout?.measuredHeight) || 200;
        const aW = (typeof a.layout?.width === 'number' ? a.layout.width : a.layout?.measuredWidth) || 0;
        const aH = (typeof a.layout?.height === 'number' ? a.layout.height : a.layout?.measuredHeight) || 0;
        const bW = (typeof b.layout?.width === 'number' ? b.layout.width : b.layout?.measuredWidth) || 0;
        const bH = (typeof b.layout?.height === 'number' ? b.layout.height : b.layout?.measuredHeight) || 0;
        const aIsBg = aW >= pW * 0.85 && aH >= pH * 0.85;
        const bIsBg = bW >= pW * 0.85 && bH >= pH * 0.85;
        if (aIsBg && !bIsBg) return -1;
        if (!aIsBg && bIsBg) return 1;
        return 0;
      });
    } else if (mode === 'HORIZONTAL') {
      node.children.sort((a: RawNode, b: RawNode) => (a.layout?.x || 0) - (b.layout?.x || 0));
      // Si el último hijo está empujado hacia la derecha (ej. chevron o botón de acción o shortcut CTRL K), el elemento central debe ser FILL
      if (node.children.length === 3 && cName.includes('search')) {
        const c1 = node.children[1];
        const c2 = node.children[2];
        const pW = typeof node.layout.width === 'number' ? node.layout.width : node.layout.measuredWidth || 200;
        const c2W = typeof c2.layout?.width === 'number' ? c2.layout.width : c2.layout?.measuredWidth || 20;
        const c2Right = (c2.layout?.x || 0) + c2W;
        if ((c2.layout?.x || 0) > pW - 60 || c2Right >= pW - 35) {
          c1.layout.width = 'FILL';
        }
      }
    } else if (mode === 'VERTICAL') {
      node.children.sort((a: RawNode, b: RawNode) => (a.layout?.y || 0) - (b.layout?.y || 0));
    }
  }

  // ── 20.1 Orden de capas de CSS (QA-8): sin esto, un fondo `position: fixed; z-index: -1` que va
  // al final del DOM quedaba ENCIMA de todo en Figma (bloque oscuro tapando el header y el hero).
  // Contexto de apilamiento: qué z-index escapa de este nodo hacia sus hermanos y si, al no pintar
  // nada propio, puede subir de capa sin tapar nada que en la web quede debajo
  node._stack = createsStackingContext(element, style);
  node._escZ = escapingZ(node);
  const paintsItself =
    (node.styles.fills || []).length > 0 ||
    (node.styles.strokes || []).length > 0 ||
    (node.styles.boxShadow || []).length > 0 ||
    !!node.styles.backdropBlur ||
    !!node.imageData ||
    !!node._pendingBgImageSrc ||
    !!node._needsShot ||
    !!node._rasterize;
  node._elevatable = !node._stack && !paintsItself;
  if (node.children.length > 1) sortByPaintOrder(node.children, mode);

  if (gridAsWrap) node._gridWrap = true;

  // ── 20.5 Ajustar el Auto Layout a la GEOMETRÍA real (principio de swarm-rebuild) ──
  // Padding, gap y alineación se deducían de palabras clave CSS; márgenes, place-items,
  // centrados por grid, etc. se perdían. Se recalculan con las posiciones medidas.
  fitAutoLayoutToGeometry(node);
  // Grid convertido en wrap que no se pudo verificar con la geometría (hijos sin medir, filas
  // irregulares…): posiciones exactas, como antes (fase 5.6)
  if (node._gridWrap && !node._gridWrapOk) {
    node.layout.mode = 'NONE';
    node.layout.layoutWrap = 'NO_WRAP';
  }

  // ── 21. Flattening de Wrappers Transparentes de Frameworks (Angular/React) ──
  const isFrameworkWrapper =
    !isSearchContainer &&
    (['app-root', 'router-outlet', 'app-login', 'ng-component', 'ng-container'].includes(tagName) ||
      (tagName.startsWith('app-') &&
        fills.length === 0 &&
        strokes.length === 0 &&
        padding.top === 0 &&
        padding.left === 0 &&
        boxShadow.length === 0) ||
      (tagName === 'div' &&
        fills.length === 0 &&
        strokes.length === 0 &&
        padding.top === 0 &&
        padding.left === 0 &&
        boxShadow.length === 0 &&
        node.children.length === 1 &&
        node.children[0].type !== 'TEXT'));

  // No aplanar contenedores con significado visual propio: los que recortan (viewport de
  // carrusel) o los que llevan background-image (se perdería la imagen).
  const hasOwnVisual = !!node.clipsContent || !!node._pendingBgImageSrc;
  if (!isRoot && isFrameworkWrapper && !hasOwnVisual && node.children.length === 1) {
    const singleChild = node.children[0];
    if (singleChild.layout) {
      singleChild.layout.x = (singleChild.layout.x || 0) + (node.layout?.x || 0);
      singleChild.layout.y = (singleChild.layout.y || 0) + (node.layout?.y || 0);
    }
    if (
      (singleChild.name === 'DIV' || singleChild.name.startsWith('Frame')) &&
      node.name &&
      !node.name.startsWith('Frame')
    ) {
      singleChild.name = node.name;
    }
    return singleChild;
  }

  return node;
}

/**
 * Capa de pintado de un elemento entre sus hermanos (orden de pintado de CSS, simplificado a un
 * mismo contexto de apilamiento):
 *   null → en flujo, no posicionado · número → posicionado (o hijo flex/grid con z-index)
 */
export function paintLayerOf(element: Element, style: CSSStyleDeclaration): number | null {
  const z = parseInt(style.zIndex, 10);
  const positioned = style.position !== 'static';
  let flexItemWithZ = false;
  if (!positioned && !isNaN(z) && element.parentElement) {
    flexItemWithZ = /flex|grid/.test(window.getComputedStyle(element.parentElement).display);
  }
  if (!positioned && !flexItemWithZ) return null;
  return isNaN(z) ? 0 : z;
}

/**
 * ¿Forma este elemento su propio contexto de apilamiento? Si no, los z-index de sus descendientes
 * compiten con los hermanos del elemento (en CSS "escapan" del contenedor).
 */
export function createsStackingContext(element: Element, style: CSSStyleDeclaration): boolean {
  const pos = style.position;
  if (pos === 'fixed' || pos === 'sticky') return true;
  if (pos !== 'static' && style.zIndex !== 'auto') return true;
  if (parseFloat(style.opacity) < 1) return true;
  const s = style as any;
  for (const prop of ['transform', 'filter', 'backdropFilter', 'clipPath', 'maskImage', 'webkitMaskImage']) {
    if (s[prop] && s[prop] !== 'none') return true;
  }
  if (style.mixBlendMode && style.mixBlendMode !== 'normal') return true;
  if (style.isolation === 'isolate') return true;
  if (/transform|opacity|filter/.test(style.willChange || '')) return true;
  if (/paint|layout|strict|content/.test(style.contain || '')) return true;
  if (style.zIndex !== 'auto' && element.parentElement) {
    return /flex|grid/.test(window.getComputedStyle(element.parentElement).display);
  }
  return false;
}

/**
 * Mayor z-index positivo que "escapa" de un nodo hacia sus hermanos: el de sus hijos con z-index
 * propio, o lo que escapa de los hijos que tampoco forman contexto. 0 si nada escapa.
 */
export function escapingZ(node: RawNode): number {
  if (node._stack) return 0;
  let max = 0;
  for (const c of node.children || []) {
    const own = typeof c._paint === 'number' && c._paint > 0 ? c._paint : 0;
    const inner = !c._stack && typeof c._escZ === 'number' ? c._escZ : 0;
    max = Math.max(max, own, inner);
  }
  return max;
}

/**
 * Clave de orden: z negativo → en flujo → posicionado (z auto/0) → z positivo.
 * Un contenedor transparente que no forma contexto sube a la capa de lo que escapa de él: p. ej.
 * un envoltorio normal con tarjetas `position: relative; z-index: 2` junto a un canvas absoluto.
 * En CSS las tarjetas quedan sobre el canvas; comparando solo hermanos, la captura opaca del canvas
 * las tapaba en Figma.
 */
function paintKey(n: RawNode): [number, number] {
  let z = n._paint;
  if (n._elevatable && typeof n._escZ === 'number' && n._escZ > 0 && (z === null || z === undefined || z <= 0)) {
    z = n._escZ;
  }
  if (z === null || z === undefined) return [1, 0];
  if (z < 0) return [0, z];
  if (z === 0) return [2, 0];
  return [3, z];
}

/**
 * Ordena los hijos como los pinta el navegador (los primeros quedan debajo en Figma).
 * Con Auto Layout el orden de los hijos en flujo ES el layout: solo se mueven los absolutos.
 * Orden estable: a igual capa se conserva el orden previo (DOM / geométrico).
 */
export function sortByPaintOrder(children: RawNode[], mode: string): void {
  const indexed = children.map((c, i) => ({ c, i, k: paintKey(c) }));
  const byPaint = (a: (typeof indexed)[number], b: (typeof indexed)[number]) =>
    a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i;
  if (mode === 'NONE') {
    indexed.sort(byPaint);
    indexed.forEach((x, i) => (children[i] = x.c));
    return;
  }
  const isAbs = (c: RawNode) => c.layout?.positioning === 'ABSOLUTE';
  const flow = indexed.filter(x => !isAbs(x.c));
  // Un absoluto va debajo del flujo si tiene z negativo o si algún hijo en flujo quedó elevado por
  // encima de él (tarjetas con z-index dentro de un envoltorio en flujo, sobre un canvas absoluto)
  const keyLt = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const goesBelow = (x: (typeof indexed)[number]) => x.k[0] === 0 || flow.some(f => keyLt(x.k, f.k));
  const below = indexed.filter(x => isAbs(x.c) && goesBelow(x)).sort(byPaint);
  const above = indexed.filter(x => isAbs(x.c) && !goesBelow(x)).sort(byPaint);
  [...below, ...flow, ...above].forEach((x, i) => (children[i] = x.c));
}
