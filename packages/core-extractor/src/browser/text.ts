/**
 * Texto enriquecido: contenido inline como un solo nodo, saltos de línea del navegador, superíndices.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
import { isVisuallyHidden } from './dom-helpers';
import type { Rgba } from './types';

type ScriptBaseline = 'SUPER' | 'SUB';

/** Estilo de un carácter (cacheado por elemento); _tt/_ws son text-transform y white-space del elemento. */
interface CharStyle {
  fontFamily: string;
  fontWeight: string | number;
  fontSize: number;
  italic: boolean;
  color: Rgba | null;
  underline: boolean;
  strike: boolean;
  baseline: ScriptBaseline | null;
  _tt: string;
  _ws: string;
  key?: string;
}

/** Tramo de texto con estilo propio (índices [start, end) sobre characters). */
interface RichSegment {
  start: number;
  end: number;
  _key?: string;
  fontFamily: string;
  fontWeight: string | number;
  fontSize: number;
  italic?: boolean;
  color?: Rgba;
  underline?: boolean;
  strike?: boolean;
  baseline?: ScriptBaseline;
}

export const INLINE_SKIP = /^(script|style|noscript|template)$/;

export const INLINE_BLOCKERS = /^(img|picture|svg|video|canvas|iframe|input|select|textarea|button)$/;

/**
 * ¿Todos los hijos son inline (span, a, sup, strong, em, br…) y hay texto?
 * Entonces el elemento es UN bloque de texto con estilos internos, no capas separadas.
 */
export function isInlineTextRoot(el: Element) {
  if (el.children.length === 0) return false;
  if (!(el.textContent || '').trim()) return false;
  const check = (node: Element): boolean => {
    for (const c of node.children) {
      const tag = c.localName;
      if (INLINE_SKIP.test(tag) || tag === 'br' || tag === 'wbr') continue;
      if (INLINE_BLOCKERS.test(tag) || c instanceof SVGElement) return false;
      const cs = window.getComputedStyle(c);
      if (cs.display === 'none') continue;
      if (isVisuallyHidden(cs, c.getBoundingClientRect())) continue;
      if (cs.display !== 'inline') return false;
      // Fondos/bordes en un inline (chips, badges) necesitan su propia capa
      const bg = cs.backgroundColor;
      if ((bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) || cs.backgroundImage !== 'none')
        return false;
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') return false;
      if (!check(c)) return false;
    }
    return true;
  };
  return check(el);
}

export function cssColorToRgba(str: string | null | undefined): Rgba | null {
  const m = (str || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a };
}

// Superíndices/subíndices: Figma no permite aplicar vertical-align ni OpenType "sups/numr" por API,
// así que se usan los caracteres Unicode equivalentes (1 a 1, no altera los índices de los tramos).
export const SUP_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

export const SUB_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

/** SUPER / SUB si el elemento o algún ancestro (hasta root) lo convierte en super/subíndice */
export function scriptPosition(el: Element, root: Element): ScriptBaseline | null {
  for (let e: Element | null = el; e && e !== root.parentElement; e = e.parentElement) {
    const tag = e.localName;
    if (tag === 'sup') return 'SUPER';
    if (tag === 'sub') return 'SUB';
    const cs = window.getComputedStyle(e);
    if (cs.verticalAlign === 'super') return 'SUPER';
    if (cs.verticalAlign === 'sub') return 'SUB';
    if (cs.fontVariantPosition === 'super') return 'SUPER';
    if (cs.fontVariantPosition === 'sub') return 'SUB';
    const ffs = cs.fontFeatureSettings || '';
    if (/"(sups|numr)"/.test(ffs)) return 'SUPER';
    if (/"(subs|sinf|dnom)"/.test(ffs)) return 'SUB';
    if (e === root) break;
  }
  return null;
}

export function applyTextTransform(ch: string, tt: string) {
  if (tt === 'uppercase') return ch.toUpperCase();
  if (tt === 'lowercase') return ch.toLowerCase();
  return ch;
}

/**
 * Recorre el texto visible de `root` y devuelve:
 *  - characters: texto con espacios colapsados como en CSS y '\n' donde el NAVEGADOR partió la línea
 *  - segments:   tramos con estilo propio (fuente, peso, tamaño, color, sup/sub, subrayado)
 *  - lines:      nº de líneas, linesPreserved: true si los saltos se midieron con éxito
 * Conservar los saltos reales evita que Figma re-acomode el texto al sustituir la fuente
 * (ej. SF Pro → Inter, más ancha), que es lo que hacía que el texto pisara los botones.
 */
export function buildRichText(root: Element, rootStyle: CSSStyleDeclaration) {
  const out: string[] = [];
  const charStyles: Array<CharStyle | null> = [];
  const rootRect = root.getBoundingClientRect();
  const rootFs = parseFloat(rootStyle.fontSize) || 16;
  const rootLh = parseFloat(rootStyle.lineHeight) || rootFs * 1.2;
  const clipsY =
    /^(hidden|clip)$/.test(rootStyle.overflowY) || (rootStyle.webkitLineClamp && rootStyle.webkitLineClamp !== 'none');
  const ellipsis =
    rootStyle.textOverflow === 'ellipsis' || (rootStyle.webkitLineClamp && rootStyle.webkitLineClamp !== 'none');
  const range = document.createRange();
  const MAX_MEASURE = 4000;
  let measured = 0;
  let measureOk = true;
  let lineCenter: number | null = null;
  let lastWasSpace = true;
  let truncated = false;
  let lines = 1;

  const styleKeyCache = new Map<Element, CharStyle>();
  function styleFor(el: Element): CharStyle {
    if (styleKeyCache.has(el)) return styleKeyCache.get(el)!;
    const cs = window.getComputedStyle(el);
    const st: CharStyle = {
      fontFamily: (cs.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim() || 'Inter',
      fontWeight: cs.fontWeight || 400,
      fontSize: Math.round((parseFloat(cs.fontSize) || rootFs) * 10) / 10,
      italic: cs.fontStyle === 'italic' || cs.fontStyle === 'oblique',
      color: cssColorToRgba(cs.color),
      underline: (cs.textDecorationLine || '').includes('underline'),
      strike: (cs.textDecorationLine || '').includes('line-through'),
      baseline: scriptPosition(el, root),
      _tt: cs.textTransform,
      _ws: cs.whiteSpace,
    };
    st.key = [
      st.fontFamily,
      st.fontWeight,
      st.fontSize,
      st.italic,
      st.color && [st.color.r, st.color.g, st.color.b, st.color.a].join(','),
      st.underline,
      st.strike,
      st.baseline,
    ].join('|');
    styleKeyCache.set(el, st);
    return st;
  }

  function pushChar(ch: string, st: CharStyle | null) {
    out.push(ch);
    charStyles.push(st);
  }

  function newLine() {
    lines++;
    if (out.length && out[out.length - 1] === ' ') {
      out[out.length - 1] = '\n';
    } else pushChar('\n', charStyles[charStyles.length - 1] || null);
    lastWasSpace = true;
  }

  function emitText(node: Text) {
    const parent = node.parentElement || root;
    const st = styleFor(parent);
    const preserve = /^pre/.test(st._ws) || st._ws === 'break-spaces';
    const data = node.data;
    for (let i = 0; i < data.length && !truncated; i++) {
      const ch = data[i];
      const isSpace = /\s/.test(ch);
      if (preserve && ch === '\n') {
        newLine();
        lineCenter = null;
        continue;
      }
      if (isSpace && !preserve) {
        if (lastWasSpace) continue;
        pushChar(' ', st);
        lastWasSpace = true;
        continue;
      }
      // Medir posición para detectar saltos de línea del navegador. Un salto solo puede caer
      // al inicio de una palabra (tras espacio, guion o barra) o al inicio de un nodo de texto,
      // así que basta medir esos caracteres (5-8x más rápido que medir todos).
      const prevOut = out.length ? out[out.length - 1] : ' ';
      const isBreakOpportunity = i === 0 || lastWasSpace || /[-/–—]/.test(prevOut);
      if (measureOk && !isSpace && isBreakOpportunity && measured < MAX_MEASURE) {
        measured++;
        try {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (r && r.height > 0) {
            if (clipsY && r.top >= rootRect.bottom - 1) {
              truncated = true;
              break;
            }
            const c = r.top + r.height / 2;
            if (lineCenter !== null && c > lineCenter + rootLh * 0.5) newLine();
            lineCenter = c;
          }
        } catch (_e) {
          measureOk = false;
        }
      } else if (measured >= MAX_MEASURE) {
        measureOk = false;
      }
      let outCh = applyTextTransform(ch, st._tt);
      if (st.baseline === 'SUPER' && SUP_MAP[outCh]) outCh = SUP_MAP[outCh];
      else if (st.baseline === 'SUB' && SUB_MAP[outCh]) outCh = SUB_MAP[outCh];
      pushChar(outCh, st);
      lastWasSpace = false;
    }
  }

  (function walk(node: Node) {
    for (const ch of node.childNodes) {
      if (truncated) return;
      if (ch.nodeType === Node.TEXT_NODE) {
        emitText(ch as Text);
        continue;
      }
      if (ch.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = (ch as Element).localName;
      if (INLINE_SKIP.test(tag)) continue;
      if (tag === 'br') {
        newLine();
        lineCenter = null;
        continue;
      }
      const cs = window.getComputedStyle(ch as Element);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (isVisuallyHidden(cs, (ch as Element).getBoundingClientRect())) continue;
      walk(ch);
    }
  })(root);

  // Recortar espacios al inicio/fin y alrededor de los saltos
  let text = out.join('');
  const keep: number[] = [];
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (ch === ' ' && (i === 0 || out[i - 1] === '\n' || i === out.length - 1 || out[i + 1] === '\n')) continue;
    keep.push(i);
  }
  const chars = keep.map(i => out[i]);
  const styles = keep.map(i => charStyles[i]);
  while (chars.length && chars[chars.length - 1] === '\n') {
    chars.pop();
    styles.pop();
  }
  while (chars.length && chars[0] === '\n') {
    chars.shift();
    styles.shift();
  }
  if (truncated && ellipsis && chars.length) {
    chars.push('…');
    styles.push(styles[styles.length - 1]);
  }
  text = chars.join('');
  lines = text.split('\n').length;

  // Agrupar caracteres contiguos con el mismo estilo
  const segments: RichSegment[] = [];
  for (let i = 0; i < styles.length; i++) {
    const st = styles[i] || styles[i - 1];
    if (!st) continue;
    const last = segments[segments.length - 1];
    if (last && last._key === st.key && last.end === i) {
      last.end = i + 1;
      continue;
    }
    segments.push({
      start: i,
      end: i + 1,
      _key: st.key,
      fontFamily: st.fontFamily,
      fontWeight: st.fontWeight,
      fontSize: st.fontSize,
      italic: st.italic || undefined,
      color: st.color || undefined,
      underline: st.underline || undefined,
      strike: st.strike || undefined,
      baseline: st.baseline || undefined,
    });
  }
  segments.forEach(s => delete s._key);

  return {
    characters: text,
    segments: segments.length > 1 ? segments : null,
    lines,
    linesPreserved: measureOk && measured > 0,
  };
}
