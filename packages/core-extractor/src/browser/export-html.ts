/**
 * Exportar un bloque de la página como HTML + CSS + JS que funciona fuera de ella.
 *
 * Diferencia con "guardar como" o con copiar el outerHTML: se lleva las REGLAS reales de la página
 * (no estilos calculados en línea), así que el resultado sigue siendo responsive (@media), conserva
 * :hover y las animaciones (@keyframes), y es legible y editable.
 *
 * Cómo:
 *  1. Hojas de estilo: todas las legibles; las de otro dominio se descargan con los permisos de la
 *     extensión (opts.fetchCss) y se vuelven a analizar con CSSStyleSheet.replaceSync.
 *  2. Se quedan las reglas cuyo selector toca al bloque, a sus descendientes o a sus ancestros
 *     (quitando :hover, ::before… solo para la prueba de coincidencia), dentro de sus @media,
 *     @supports, @container y @layer. @keyframes, @font-face y @property solo si se usan.
 *  3. El bloque se clona con URLs absolutas, el estado de los formularios, los lienzos como imagen y
 *     los <symbol> de sprites que referencia. Sus ancestros se reproducen como cajas vacías con
 *     `display: contents`: los selectores que dependen de ellos (`.tema-oscuro .card`), la herencia
 *     (fuente, color) y las variables CSS siguen funcionando, sin que sus cajas ocupen sitio.
 *  4. Verificación: el resultado se dibuja en un iframe oculto al mismo ancho de ventana y se
 *     compara el estilo calculado de cada elemento con el original. Lo que no coincide (hojas
 *     ilegibles, estilos puestos por JavaScript) se corrige con una regla por elemento, y se mide
 *     la fidelidad geométrica.
 *  5. JS: los widgets estándar (pestañas ARIA, aria-expanded/aria-controls, collapse/dropdown/tab de
 *     Bootstrap) reciben un script pequeño que los hace funcionar. El JavaScript propio del sitio no
 *     se copia: depende de su build, su estado y su servidor.
 */
import { applyRevealsToClone, detectClassReveals, REVEAL_JS, type StyleReveal } from './export-reveals';

export interface ExportOptions {
  /** Descarga el texto de una hoja de otro dominio (la extensión lo hace desde el service worker) */
  fetchCss?: (url: string) => Promise<string | null>;
  /** Dibujar el resultado en un iframe y corregir diferencias (por defecto sí) */
  verify?: boolean;
  /** Tope de tiempo de la verificación en ms */
  verifyTimeoutMs?: number;
  /**
   * Elementos que aparecen al hacer scroll movidos por JavaScript (el inspector los dejó visibles
   * para medir): su estado oculto y el visible. Se exportan ocultos y script.js los anima.
   */
  reveals?: StyleReveal[];
}

export interface ExportStats {
  elements: number;
  /** Reglas de estilo conservadas / revisadas */
  rules: number;
  totalRules: number;
  sheets: number;
  /** Hojas que no se pudieron leer ni descargar (sus estilos llegan por las correcciones) */
  unreadableSheets: string[];
  verified: boolean;
  /** Elementos y propiedades corregidos tras la verificación */
  patchedElements: number;
  patchedProps: number;
  /** % de elementos con la misma posición y tamaño (±2 px) que en la página; null sin verificar */
  fidelity: number | null;
  widgets: string[];
  /** Animaciones de entrada al hacer scroll que se conservaron */
  reveals: number;
  warnings: string[];
}

export interface ExportResult {
  /** index.html que enlaza styles.css y script.js */
  html: string;
  css: string;
  js: string;
  /** Un solo archivo con el CSS y el JS dentro */
  singleFile: string;
  /** Nombre sugerido para los archivos (sin extensión) */
  baseName: string;
  stats: ExportStats;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const IDX = 'data-ctf-i';

// ── 1. Hojas de estilo ─────────────────────────────────────────────────────────────────────────

interface SheetSource {
  rules: CSSRule[];
  base: string;
  media: string;
  /** Texto fuente de la hoja (para recuperar declaraciones que el CSSOM no sabe serializar) */
  loadText?: () => Promise<string | null>;
  recover?: Map<CSSStyleRule, string>;
}

const IMPORT_RE = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/gi;

async function parseCssText(
  text: string,
  base: string,
  fetchCss: ExportOptions['fetchCss'],
  depth: number,
  out: SheetSource[],
  unreadable: string[],
  media = '',
): Promise<void> {
  // replaceSync ignora @import: se resuelven a mano, en su sitio (antes que el resto de la hoja)
  const imports: Array<{ url: string; media: string }> = [];
  const body = text.replace(IMPORT_RE, (_m, _q, url, cond) => {
    imports.push({ url: absUrl(url, base), media: (cond || '').trim() });
    return '';
  });
  for (const imp of imports) {
    if (depth > 3 || !fetchCss) {
      unreadable.push(imp.url);
      continue;
    }
    const sub = await safeFetch(fetchCss, imp.url);
    if (sub == null) unreadable.push(imp.url);
    else await parseCssText(sub, imp.url, fetchCss, depth + 1, out, unreadable, imp.media || media);
  }
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(body);
    out.push({ rules: Array.from(sheet.cssRules), base, media, loadText: async () => body });
  } catch (_e) {
    unreadable.push(base);
  }
}

async function safeFetch(fetchCss: NonNullable<ExportOptions['fetchCss']>, url: string): Promise<string | null> {
  try {
    const t = await fetchCss(url);
    return typeof t === 'string' ? t : null;
  } catch (_e) {
    return null;
  }
}

async function addSheet(
  sheet: CSSStyleSheet,
  fetchCss: ExportOptions['fetchCss'],
  out: SheetSource[],
  unreadable: string[],
  depth: number,
): Promise<void> {
  if (sheet.disabled) return;
  const base = sheet.href || document.baseURI;
  const media = sheet.media && sheet.media.mediaText && sheet.media.mediaText !== 'all' ? sheet.media.mediaText : '';
  let rules: CSSRule[] | null = null;
  try {
    rules = Array.from(sheet.cssRules);
  } catch (_e) {
    rules = null;
  }
  if (!rules) {
    // Otro dominio sin CORS: el navegador no deja leerla. Se descarga con los permisos de la extensión
    const text = sheet.href && fetchCss ? await safeFetch(fetchCss, sheet.href) : null;
    if (text == null) {
      unreadable.push(sheet.href || '(hoja sin URL)');
      return;
    }
    await parseCssText(text, sheet.href!, fetchCss, depth + 1, out, unreadable, media);
    return;
  }
  // Los @import van primero: se expanden en orden y el resto de la hoja después
  const own: CSSRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSImportRule) {
      if (rule.styleSheet && depth < 4) await addSheet(rule.styleSheet, fetchCss, out, unreadable, depth + 1);
      else if (rule.href) unreadable.push(absUrl(rule.href, base));
    } else own.push(rule);
  }
  const owner = sheet.ownerNode as Element | null;
  const loadText = async (): Promise<string | null> => {
    if (owner && owner.tagName && owner.tagName.toLowerCase() === 'style') return owner.textContent;
    if (!sheet.href) return null;
    if (fetchCss) return safeFetch(fetchCss, sheet.href);
    try {
      const r = await fetch(sheet.href);
      return r.ok ? await r.text() : null;
    } catch (_e) {
      return null;
    }
  };
  out.push({ rules: own, base, media, loadText });
}

// ── Declaraciones que el CSSOM pierde ──────────────────────────────────────────────────────────
//
// Chrome no sabe serializar un atajo con var() que luego se sobrescribe en parte:
//   .a { border: var(--w) solid var(--c); border-width: 1px 0 }
// sale como "border-top-style: ; border-top-color: ; … border-width: 1px 0px": el "solid" se pierde y
// el borde desaparece. Esas reglas se recuperan del texto fuente de la hoja.

/** ¿Alguna propiedad (no variable) serializada sin valor? */
function losesDeclarations(rule: CSSStyleRule): boolean {
  return /(?:^|[;\s])(?!--)[a-z-]+:\s*(?:;|$)/.test(rule.style.cssText);
}

function needsRecovery(rules: CSSRule[]): boolean {
  for (const r of rules) {
    if (r instanceof CSSStyleRule) {
      if (losesDeclarations(r)) return true;
    } else if (!(r instanceof CSSKeyframesRule) && (r as CSSGroupingRule).cssRules) {
      if (needsRecovery(Array.from((r as CSSGroupingRule).cssRules))) return true;
    }
  }
  return false;
}

/** Selector comparable entre el texto fuente y el CSSOM (espacios, comillas, ::before) */
function normSelector(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/::?(before|after|first-line|first-letter)\b/gi, '::$1')
    .replace(/["']/g, '')
    .replace(/\s*([>+~,()])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reglas de estilo del texto fuente, en orden: [selector, cuerpo] (entrando en @media, @layer…) */
function scanStyleRules(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const n = text.length;
  const skipString = (j: number): number => {
    const q = text[j];
    for (let k = j + 1; k < n; k++) {
      if (text[k] === '\\') k++;
      else if (text[k] === q) return k;
    }
    return n;
  };
  const skipComment = (j: number): number => {
    const e = text.indexOf('*/', j + 2);
    return e < 0 ? n : e + 1;
  };
  const blockEnd = (start: number): number => {
    let depth = 0;
    for (let j = start; j < n; j++) {
      const ch = text[j];
      if (ch === '/' && text[j + 1] === '*') j = skipComment(j);
      else if (ch === '"' || ch === "'") j = skipString(j);
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) return j + 1;
    }
    return n;
  };
  const walk = (from: number, to: number) => {
    let preludeStart = from;
    for (let j = from; j < to; j++) {
      const ch = text[j];
      if (ch === '/' && text[j + 1] === '*') j = skipComment(j);
      else if (ch === '"' || ch === "'") j = skipString(j);
      else if (ch === ';' || ch === '}') preludeStart = j + 1;
      else if (ch === '{') {
        const prelude = text
          .slice(preludeStart, j)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .trim();
        const end = blockEnd(j);
        if (!prelude.startsWith('@')) out.push([prelude, text.slice(j + 1, end - 1)]);
        else if (/^@(?:media|supports|layer|container|scope|document|starting-style)\b/i.test(prelude))
          walk(j + 1, end - 1);
        j = end - 1;
        preludeStart = end;
      }
    }
  };
  walk(0, n);
  return out;
}

/** Regla del CSSOM → su cuerpo en el texto fuente (la n-ésima regla con el mismo selector) */
function buildRecovery(text: string, rules: CSSRule[]): Map<CSSStyleRule, string> {
  const bySelector = new Map<string, string[]>();
  for (const [sel, body] of scanStyleRules(text)) {
    const k = normSelector(sel);
    const list = bySelector.get(k) || [];
    list.push(body);
    bySelector.set(k, list);
  }
  const seen = new Map<string, number>();
  const out = new Map<CSSStyleRule, string>();
  const walk = (list: CSSRule[]) => {
    for (const r of list) {
      if (r instanceof CSSStyleRule) {
        const k = normSelector(r.selectorText || '');
        const nth = seen.get(k) || 0;
        seen.set(k, nth + 1);
        if (!losesDeclarations(r)) continue;
        const body = (bySelector.get(k) || [])[nth];
        if (body != null && /var\(/.test(body)) out.set(r, body.trim().replace(/;?\s*$/, ';'));
      } else if (!(r instanceof CSSKeyframesRule) && (r as CSSGroupingRule).cssRules) {
        walk(Array.from((r as CSSGroupingRule).cssRules));
      }
    }
  };
  walk(rules);
  return out;
}

async function gatherSheets(fetchCss: ExportOptions['fetchCss']) {
  const sources: SheetSource[] = [];
  const unreadable: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    await addSheet(sheet as CSSStyleSheet, fetchCss, sources, unreadable, 0);
  }
  for (const sheet of Array.from(document.adoptedStyleSheets || [])) {
    await addSheet(sheet, fetchCss, sources, unreadable, 0);
  }
  return { sources, unreadable };
}

// ── URLs ───────────────────────────────────────────────────────────────────────────────────────

function absUrl(u: string, base: string): string {
  const s = (u || '').trim();
  if (!s || /^(?:data|blob|javascript|mailto|tel|about):|^#/i.test(s)) return s;
  try {
    return new URL(s, base).href;
  } catch (_e) {
    return s;
  }
}

/** url(...) relativas → absolutas (en una hoja, relativas a la hoja; en línea, a la página) */
function absolutizeCss(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
    const abs = absUrl(u, base);
    return abs === u ? m : `url(${q || '"'}${abs}${q || '"'})`;
  });
}

function absolutizeSrcset(v: string, base: string): string {
  if (/data:/i.test(v)) return v; // las comas de un data: URI romperían el reparto
  return v
    .split(',')
    .map(part => {
      const bits = part.trim().split(/\s+/);
      if (!bits[0]) return part.trim();
      bits[0] = absUrl(bits[0], base);
      return bits.join(' ');
    })
    .join(', ');
}

// ── 2. Reglas que tocan al bloque ──────────────────────────────────────────────────────────────

/** Pseudo-clases de estado y pseudo-elementos: fuera para PROBAR si el selector toca al bloque */
const NON_STRUCTURAL =
  /::?(?:hover|active|focus-visible|focus-within|focus|visited|target|before|after|placeholder|marker|selection|first-line|first-letter|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)(?![\w-])|::(?:part|slotted|highlight|cue)\([^)]*\)/gi;

/** Divide una lista de selectores por las comas de primer nivel */
function splitSelectors(sel: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of sel) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface FilterCtx {
  root: Element;
  scope: Element[]; // el bloque y sus ancestros
  kept: number;
  total: number;
  keyframes: Array<{ name: string; text: string }>;
  fontFaces: Array<{ family: string; text: string }>;
  properties: Array<{ name: string; text: string }>;
  cache: Map<string, boolean>;
  /** Cuerpos recuperados del texto fuente de la hoja en curso */
  recover?: Map<CSSStyleRule, string>;
}

function selectorTouches(part: string, ctx: FilterCtx): boolean {
  const hit = ctx.cache.get(part);
  if (hit !== undefined) return hit;
  let s = part.replace(NON_STRUCTURAL, '').trim();
  s = s.replace(/[>+~]\s*$/, '').trim();
  if (!s || /^[>+~]/.test(s)) s = s ? `* ${s}` : '*';
  let res: boolean;
  try {
    res = ctx.scope.some(el => el.matches(s)) || ctx.root.querySelector(s) !== null;
  } catch (_e) {
    // Selector que el navegador no acepta tras quitarle pseudo-clases (p. ej. :has(:hover)): se
    // conserva. Es preferible una regla de más que perder un estilo.
    res = true;
  }
  ctx.cache.set(part, res);
  return res;
}

function filterRules(rules: CSSRule[], base: string, ctx: FilterCtx): string[] {
  const out: string[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      ctx.total++;
      const parts = splitSelectors(rule.selectorText || '');
      const kept = parts.filter(p => selectorTouches(p, ctx));
      if (!kept.length) continue;
      ctx.kept++;
      const nested = (rule as any).cssRules && (rule as any).cssRules.length > 0;
      const recovered = ctx.recover && ctx.recover.get(rule);
      const text = recovered
        ? `${kept.join(', ')} { ${recovered} }`
        : nested || kept.length === parts.length
          ? rule.cssText
          : `${kept.join(', ')} { ${rule.style.cssText} }`;
      out.push(absolutizeCss(text, base));
    } else if (rule instanceof CSSKeyframesRule) {
      ctx.keyframes.push({ name: rule.name, text: absolutizeCss(rule.cssText, base) });
    } else if (rule instanceof CSSFontFaceRule) {
      const family = (rule.style.getPropertyValue('font-family') || '').replace(/^['"]|['"]$/g, '').trim();
      ctx.fontFaces.push({ family, text: absolutizeCss(rule.cssText, base) });
    } else if (typeof CSSPropertyRule !== 'undefined' && rule instanceof CSSPropertyRule) {
      ctx.properties.push({ name: rule.name, text: rule.cssText });
    } else if (typeof CSSLayerStatementRule !== 'undefined' && rule instanceof CSSLayerStatementRule) {
      out.push(rule.cssText); // el orden de las capas importa aunque no tengan reglas
    } else if (rule instanceof CSSImportRule || rule instanceof CSSNamespaceRule || rule instanceof CSSPageRule) {
      continue;
    } else if ((rule as CSSGroupingRule).cssRules) {
      // @media, @supports, @container, @layer {…}, @scope, @starting-style
      const inner = filterRules(Array.from((rule as CSSGroupingRule).cssRules), base, ctx);
      if (inner.length) {
        const header = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
        out.push(`${header} {\n${inner.map(r => '  ' + r).join('\n')}\n}`);
      }
    } else if (rule.cssText) {
      out.push(rule.cssText); // @counter-style, @font-feature-values…: pequeños, se conservan
    }
  }
  return out;
}

/**
 * La misma regla repetida (hojas cargadas varias veces, muy común): se queda la ÚLTIMA aparición.
 * Con contenido idéntico, la última es la que decide la cascada, así que el resultado no cambia.
 */
function dedupeKeepLast(rules: string[]): string[] {
  const last = new Map<string, number>();
  rules.forEach((r, i) => last.set(r, i));
  return rules.filter((r, i) => last.get(r) === i);
}

// Valor de una declaración: respeta comillas y paréntesis (los data: URI llevan ";base64")
const DECL_VALUE = String.raw`((?:[^;"'(){}]|"[^"]*"|'[^']*'|\((?:[^()"']|"[^"]*"|'[^']*'|\((?:[^()]|\([^()]*\))*\))*\))*)`;
const VAR_REF = /var\(\s*(--[\w-]+)/g;

/**
 * Variables CSS que nada usa: los design systems definen miles en :root y un bloque usa unas
 * decenas. Se conservan las referenciadas desde declaraciones normales o desde el HTML (estilos en
 * línea) y, transitivamente, las que esas usan.
 */
function pruneCustomProperties(css: string, html: string): string {
  const declRe = new RegExp(String.raw`(--[\w-]+)\s*:\s*${DECL_VALUE}\s*(?:;|(?=\}))`, 'g');
  const values = new Map<string, string[]>();
  const withoutCustom = css.replace(declRe, (_m, name: string, value: string) => {
    const list = values.get(name) || [];
    list.push(value);
    values.set(name, list);
    return '';
  });
  if (!values.size) return css;
  const used = new Set<string>();
  const queue: string[] = [];
  const scan = (text: string) => {
    for (const m of text.matchAll(VAR_REF)) {
      if (!used.has(m[1])) {
        used.add(m[1]);
        queue.push(m[1]);
      }
    }
  };
  scan(withoutCustom);
  scan(html);
  while (queue.length) for (const v of values.get(queue.pop()!) || []) scan(v);

  let out = css.replace(declRe, (m, name: string) => (used.has(name) ? m : ''));
  // Reglas que se quedaron vacías (y los @media que solo las contenían)
  for (let i = 0; i < 4; i++) {
    const next = out
      .replace(/(^|[;}\n])\s*[^{}@;]+\{\s*\}/g, '$1')
      .replace(/@(?:media|supports|container|layer)[^{}]*\{\s*\}/g, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 3. Clon del bloque ─────────────────────────────────────────────────────────────────────────

const URL_ATTRS = ['src', 'href', 'poster', 'action', 'formaction', 'data', 'background', 'xlink:href'];

interface CloneResult {
  clone: Element;
  origs: Element[];
  widgets: Set<string>;
  warnings: string[];
}

function cleanAttributes(o: Element, c: Element, base: string) {
  for (const attr of Array.from(c.attributes)) {
    const n = attr.name.toLowerCase();
    if (n.startsWith('on') || n === 'nonce' || n === 'integrity' || (n.startsWith('data-ctf') && n !== IDX)) {
      c.removeAttribute(attr.name);
    }
  }
  for (const n of URL_ATTRS) {
    const v = c.getAttribute(n);
    if (v == null) continue;
    if (/^\s*javascript:/i.test(v)) c.setAttribute(n, '#');
    else c.setAttribute(n, absUrl(v, base));
  }
  for (const n of ['srcset', 'imagesrcset']) {
    const v = c.getAttribute(n);
    if (v) c.setAttribute(n, absolutizeSrcset(v, base));
  }
  const style = c.getAttribute('style');
  if (style && /url\(/i.test(style)) c.setAttribute('style', absolutizeCss(style, base));

  const tag = o.tagName.toLowerCase();
  if (tag === 'img') {
    // Lazy loading de librerías (data-src): la imagen que se ve es currentSrc
    const img = o as HTMLImageElement;
    if (img.currentSrc && !/^data:image\/gif/i.test(img.currentSrc)) {
      const src = c.getAttribute('src') || '';
      if (!src || /^data:image\/(gif|svg)/i.test(src)) c.setAttribute('src', img.currentSrc);
    }
  } else if (tag === 'input') {
    const inp = o as HTMLInputElement;
    if (inp.type === 'checkbox' || inp.type === 'radio') {
      if (inp.checked) c.setAttribute('checked', '');
      else c.removeAttribute('checked');
    } else if (inp.type !== 'password' && inp.type !== 'file' && inp.value) {
      c.setAttribute('value', inp.value);
    }
  } else if (tag === 'textarea') {
    c.textContent = (o as HTMLTextAreaElement).value;
  } else if (tag === 'select') {
    const opts = (o as HTMLSelectElement).options;
    const copts = c.querySelectorAll('option');
    for (let i = 0; i < opts.length && i < copts.length; i++) {
      if (opts[i].selected) copts[i].setAttribute('selected', '');
      else copts[i].removeAttribute('selected');
    }
  }
}

/** Diferencia de clases entre el elemento "activo" y sus hermanos inactivos (is-active, show…) */
function classDiff(active: Element | null, inactive: Element[]): string {
  if (!active || !inactive.length) return '';
  const common = (el: Element) => new Set(Array.from(el.classList));
  const others = inactive.map(common);
  return Array.from(active.classList)
    .filter(c => others.every(s => !s.has(c)))
    .join(' ');
}

function annotateWidgets(root: Element, origToClone: Map<Element, Element>, widgets: Set<string>) {
  const cloneOf = (el: Element | null) => (el ? origToClone.get(el) || null : null);
  const byId = (id: string | null): Element | null => {
    if (!id) return null;
    const el = root.ownerDocument.getElementById(id);
    return el && (el === root || root.contains(el)) ? el : null;
  };
  const visibleDisplay = (el: Element) => {
    const d = getComputedStyle(el).display;
    return d && d !== 'none' ? d : '';
  };

  // Pestañas ARIA
  for (const list of Array.from(root.querySelectorAll('[role="tablist"]'))) {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    if (tabs.length < 2) continue;
    const active = tabs.find(t => t.getAttribute('aria-selected') === 'true') || null;
    const inactive = tabs.filter(t => t !== active);
    const cl = cloneOf(list);
    if (!cl) continue;
    widgets.add('tabs');
    cl.setAttribute('data-ctf-w', 'tabs');
    const tabClass = classDiff(active, inactive);
    if (tabClass) cl.setAttribute('data-ctf-on', tabClass);
    const panels = tabs.map(t => byId(t.getAttribute('aria-controls')));
    const activePanel = active ? byId(active.getAttribute('aria-controls')) : null;
    const panelClass = classDiff(
      activePanel,
      panels.filter((p): p is Element => !!p && p !== activePanel),
    );
    if (panelClass) cl.setAttribute('data-ctf-panel-on', panelClass);
    if (activePanel) {
      const d = visibleDisplay(activePanel);
      if (d) cl.setAttribute('data-ctf-display', d);
    }
  }

  // Disclosure: botón con aria-expanded que controla otro elemento del bloque (acordeón, menú móvil)
  for (const btn of Array.from(root.querySelectorAll('[aria-expanded][aria-controls]'))) {
    if (btn.getAttribute('role') === 'tab') continue;
    const target = byId(btn.getAttribute('aria-controls'));
    const cb = cloneOf(btn);
    if (!target || !cb) continue;
    widgets.add('disclosure');
    cb.setAttribute('data-ctf-w', 'disclosure');
    const ct = cloneOf(target);
    const d = visibleDisplay(target);
    if (ct && d && btn.getAttribute('aria-expanded') === 'true') ct.setAttribute('data-ctf-display', d);
  }

  // Bootstrap: collapse, dropdown y tab (data-bs-toggle o el data-toggle de la v4)
  for (const btn of Array.from(root.querySelectorAll('[data-bs-toggle], [data-toggle]'))) {
    const kind = btn.getAttribute('data-bs-toggle') || btn.getAttribute('data-toggle') || '';
    if (!['collapse', 'dropdown', 'tab', 'pill'].includes(kind)) continue;
    const cb = cloneOf(btn);
    if (!cb) continue;
    widgets.add(`bootstrap-${kind}`);
    cb.setAttribute('data-ctf-w', `bs-${kind}`);
  }
}

/** Ids referenciados (href="#id", url(#id)) que viven fuera del bloque: sprites SVG, degradados */
function externalRefs(clone: Element, root: Element): Element[] {
  const ids = new Set<string>();
  const html = clone.outerHTML;
  for (const m of html.matchAll(/(?:xlink:)?href="#([^"]+)"/g)) ids.add(m[1]);
  for (const m of html.matchAll(/url\(\s*['"]?#([^'")]+)['"]?\s*\)/g)) ids.add(m[1]);
  const out: Element[] = [];
  for (const id of ids) {
    const el = root.ownerDocument.getElementById(id);
    if (!el || el === root || root.contains(el)) continue;
    if (el.namespaceURI === SVG_NS) out.push(el);
  }
  return out;
}

function cloneBlock(root: Element): CloneResult {
  const base = document.baseURI;
  const clone = root.cloneNode(true) as Element;
  const origs: Element[] = [];
  const origToClone = new Map<Element, Element>();
  const warnings: string[] = [];
  const pending: Array<() => void> = [];

  const walk = (o: Node, c: Node) => {
    if (o.nodeType !== Node.ELEMENT_NODE) return;
    const oe = o as Element;
    const ce = c as Element;
    ce.setAttribute(IDX, String(origs.length));
    origs.push(oe);
    origToClone.set(oe, ce);
    cleanAttributes(oe, ce, base);
    const tag = oe.tagName.toLowerCase();

    if (
      tag === 'script' ||
      tag === 'noscript' ||
      tag === 'base' ||
      tag === 'meta' ||
      oe.id === '__code_to_figma_root' // el inspector de la propia extensión
    ) {
      pending.push(() => ce.remove());
      return;
    }
    if (tag === 'style' || (tag === 'link' && /stylesheet/i.test(oe.getAttribute('rel') || ''))) {
      pending.push(() => ce.remove()); // sus reglas ya están en las hojas recogidas
      return;
    }
    if (tag === 'canvas') {
      try {
        const data = (oe as HTMLCanvasElement).toDataURL('image/png');
        pending.push(() => {
          const img = document.createElement('img');
          for (const a of Array.from(ce.attributes)) img.setAttribute(a.name, a.value);
          img.setAttribute('src', data);
          img.setAttribute('alt', '');
          ce.replaceWith(img);
        });
      } catch (_e) {
        warnings.push('Un lienzo (canvas) de otro dominio no se pudo copiar: queda vacío');
      }
    }
    // Shadow DOM abierto → shadow DOM declarativo (el navegador lo reconstruye al abrir el archivo)
    const sr = (oe as HTMLElement).shadowRoot;
    if (sr) {
      pending.push(() => {
        const tpl = document.createElement('template');
        tpl.setAttribute('shadowrootmode', 'open');
        let styles = '';
        for (const s of Array.from(sr.adoptedStyleSheets || [])) {
          try {
            styles += Array.from(s.cssRules)
              .map(r => r.cssText)
              .join('\n');
          } catch (_e) {}
        }
        tpl.innerHTML = (styles ? `<style>${styles}</style>` : '') + sr.innerHTML;
        ce.insertBefore(tpl, ce.firstChild);
      });
    }

    const oc = o.childNodes;
    const cc = c.childNodes;
    for (let i = 0; i < oc.length && i < cc.length; i++) walk(oc[i], cc[i]);
  };
  walk(root, clone);

  const widgets = new Set<string>();
  annotateWidgets(root, origToClone, widgets);
  for (const fn of pending) fn();
  return { clone, origs, widgets, warnings };
}

// ── Contexto: ancestros, fondo y ancho ─────────────────────────────────────────────────────────

/** Ancestros entre <body> y el bloque (sin incluirlos), del más externo al más interno */
function ancestorChain(root: Element): Element[] {
  const chain: Element[] = [];
  for (let p = root.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    chain.unshift(p);
  }
  return chain;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function attrsOf(el: Element, extra: Record<string, string> = {}, base = document.baseURI): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(el.attributes)) {
    const n = a.name.toLowerCase();
    if (n.startsWith('on') || n === 'nonce' || n.startsWith('data-ctf')) continue;
    let v = a.value;
    if (n === 'style' && extra.style) v = `${v.replace(/;?\s*$/, ';')} ${extra.style}`;
    else if (URL_ATTRS.includes(n)) v = /^\s*javascript:/i.test(v) ? '#' : absUrl(v, base);
    if (n === 'style' && /url\(/i.test(v)) v = absolutizeCss(v, base);
    seen.add(n);
    out.push(`${a.name}="${escapeAttr(v)}"`);
  }
  for (const [k, v] of Object.entries(extra)) if (!seen.has(k)) out.push(`${k}="${escapeAttr(v)}"`);
  return out.length ? ' ' + out.join(' ') : '';
}

function isTransparent(color: string): boolean {
  if (!color || color === 'transparent') return true;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  return parts.length >= 4 && parseFloat(parts[3]) === 0;
}

/** Fondo que se ve detrás del bloque y que pinta un ancestro que en la exportación no tendrá caja */
function backdropColor(root: Element): string | null {
  for (let p = root.parentElement; p; p = p.parentElement) {
    if (p === document.body || p === document.documentElement) return null; // sus reglas viajan
    const bg = getComputedStyle(p).backgroundColor;
    if (!isTransparent(bg)) return bg;
  }
  return null;
}

/** Ancho del contenido del padre: el bloque se coloca en una caja igual de ancha */
function containerWidth(root: Element): number {
  const p = root.parentElement;
  if (!p) return Math.round(root.getBoundingClientRect().width);
  const cs = getComputedStyle(p);
  const w =
    p.getBoundingClientRect().width -
    (parseFloat(cs.paddingLeft) || 0) -
    (parseFloat(cs.paddingRight) || 0) -
    (parseFloat(cs.borderLeftWidth) || 0) -
    (parseFloat(cs.borderRightWidth) || 0);
  const own = root.getBoundingClientRect().width;
  return Math.round(Math.max(w, own));
}

// ── 4. Verificación ────────────────────────────────────────────────────────────────────────────

const COMPARE_PROPS = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'box-sizing',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-content',
  'align-self',
  'justify-items',
  'justify-self',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'order',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'grid-auto-flow',
  'row-gap',
  'column-gap',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'box-shadow',
  'opacity',
  'transform',
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'z-index',
  'overflow-x',
  'overflow-y',
  'visibility',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'text-decoration-color',
  'white-space',
  'text-overflow',
  'vertical-align',
  'list-style-type',
  'object-fit',
  'object-position',
  'clip-path',
  'mask-image',
];

const PSEUDO_PROPS = [
  'content',
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'background-color',
  'background-image',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-top-left-radius',
  'color',
  'font-size',
  'opacity',
  'transform',
];

/** Propiedades que una animación o transición está moviendo ahora (no se congelan) */
function animatedProps(el: Element): Set<string> {
  const out = new Set<string>();
  try {
    for (const a of el.getAnimations ? el.getAnimations() : []) {
      const eff = a.effect as KeyframeEffect | null;
      if ((a as any).transitionProperty) out.add((a as any).transitionProperty);
      for (const kf of eff && eff.getKeyframes ? eff.getKeyframes() : []) {
        for (const k of Object.keys(kf)) {
          if (['offset', 'easing', 'composite', 'computedOffset'].includes(k)) continue;
          out.add(k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
        }
      }
    }
  } catch (_e) {}
  if (out.has('inset')) ['top', 'right', 'bottom', 'left'].forEach(p => out.add(p));
  return out;
}

interface Patch {
  idx: number;
  pseudo: '' | '::before' | '::after';
  props: Record<string, string>;
}

function waitFor<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

async function renderInFrame(docHtml: string, css: string, timeoutMs: number): Promise<HTMLIFrameElement | null> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = `position:fixed!important;left:-${innerWidth + 200}px!important;top:0!important;width:${innerWidth}px!important;height:${innerHeight}px!important;border:0!important;opacity:0!important;pointer-events:none!important;visibility:visible!important;display:block!important`;
  const loaded = new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
  frame.srcdoc = docHtml;
  document.documentElement.appendChild(frame);
  await waitFor(loaded, timeoutMs, undefined);
  const doc = frame.contentDocument;
  const win = frame.contentWindow as (Window & typeof globalThis) | null;
  if (!doc || !win) {
    frame.remove();
    return null;
  }
  // Las hojas construidas no dependen de la CSP de la página (un <style> en línea sí)
  try {
    const sheet = new win.CSSStyleSheet();
    // La hoja se aplica después de cargar: sin esto, las transiciones de la página (color .15s…)
    // estarían a medio camino al comparar
    sheet.replaceSync(`${css}
*, *::before, *::after { transition: none !important; }`);
    doc.adoptedStyleSheets = [sheet];
  } catch (_e) {
    frame.remove();
    return null;
  }
  const imgs = Array.from(doc.images).map(im => (im.complete ? Promise.resolve() : im.decode().catch(() => {})));
  await waitFor(
    Promise.all([doc.fonts ? doc.fonts.ready : Promise.resolve(), ...imgs]),
    Math.min(4000, timeoutMs),
    undefined,
  );
  return frame;
}

/**
 * Valores que el navegador resuelve con el layout (margin: auto → px, top: 50% → px, pistas de grid).
 * Si el elemento o su padre ya miden distinto, la diferencia es consecuencia de eso: congelarla en px
 * rompería el responsive.
 */
const LAYOUT_RESOLVED = new Set([
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'top',
  'right',
  'bottom',
  'left',
  'grid-template-columns',
  'grid-template-rows',
]);

function sizeDiffers(o: Element, c: Element): boolean {
  const a = o.getBoundingClientRect();
  const b = c.getBoundingClientRect();
  if (Math.abs(a.width - b.width) > 1) return true;
  const op = o.parentElement;
  const cp = c.parentElement;
  if (!op || !cp) return false;
  return Math.abs(op.getBoundingClientRect().width - cp.getBoundingClientRect().width) > 1;
}

function diffElement(
  o: Element,
  c: Element,
  cwin: Window,
  pseudo: '' | '::before' | '::after',
): Record<string, string> {
  const os = getComputedStyle(o, pseudo || null);
  const cs = cwin.getComputedStyle(c, pseudo || null);
  const out: Record<string, string> = {};
  if (pseudo) {
    const oc = os.getPropertyValue('content');
    const cc = cs.getPropertyValue('content');
    if ((oc === 'none' || oc === 'normal') && (cc === 'none' || cc === 'normal')) return out;
  }
  const skip = pseudo ? new Set<string>() : animatedProps(o);
  if (!pseudo && sizeDiffers(o, c)) LAYOUT_RESOLVED.forEach(p => skip.add(p));
  for (const p of pseudo ? PSEUDO_PROPS : COMPARE_PROPS) {
    if (skip.has(p)) continue;
    const ov = os.getPropertyValue(p);
    const cv = cs.getPropertyValue(p);
    if (ov !== cv) out[p] = ov;
  }
  return out;
}

function geometryMatches(origs: Element[], cdoc: Document): number {
  const oRoot = origs[0].getBoundingClientRect();
  const cRootEl = cdoc.querySelector(`[${IDX}="0"]`);
  if (!cRootEl) return 0;
  const cRoot = cRootEl.getBoundingClientRect();
  let total = 0;
  let ok = 0;
  origs.forEach((o, i) => {
    const r = o.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const c = cdoc.querySelector(`[${IDX}="${i}"]`);
    if (!c) return;
    total++;
    const k = c.getBoundingClientRect();
    if (
      Math.abs(r.left - oRoot.left - (k.left - cRoot.left)) <= 2 &&
      Math.abs(r.top - oRoot.top - (k.top - cRoot.top)) <= 2 &&
      Math.abs(r.width - k.width) <= 2 &&
      Math.abs(r.height - k.height) <= 2
    )
      ok++;
  });
  return total ? Math.round((ok / total) * 1000) / 10 : 100;
}

function patchCss(patches: Patch[], important: Set<string>): string {
  // :is(#_, *) da especificidad de id sin exigir un id: gana a las reglas de clase de la página
  return patches
    .map(p => {
      const decl = Object.entries(p.props)
        .map(([k, v]) => `${k}: ${v}${important.has(`${p.idx}${p.pseudo}|${k}`) ? ' !important' : ''};`)
        .join(' ');
      return `[data-ctf="${p.idx}"]:is(#_, *)${p.pseudo} { ${decl} }`;
    })
    .join('\n');
}

async function verify(
  origs: Element[],
  buildDoc: (css: string, withIndex: boolean) => string,
  baseCss: string,
  timeoutMs: number,
  rootSkip: Set<string>,
): Promise<{ patches: Patch[]; important: Set<string>; fidelity: number } | null> {
  const deadline = Date.now() + timeoutMs;
  const patches = new Map<string, Patch>();
  const important = new Set<string>();

  const pass = async (round: number): Promise<number | null> => {
    const css = baseCss + '\n' + patchCss(Array.from(patches.values()), important);
    const frame = await renderInFrame(buildDoc(css, true), css, Math.max(1500, deadline - Date.now()));
    if (!frame) return null;
    try {
      const cdoc = frame.contentDocument!;
      const cwin = frame.contentWindow!;
      // El iframe tiene que estar usando la hoja: si no, comparar no tiene sentido
      const sentinel = cdoc.querySelector(`[${IDX}="0"]`);
      if (!sentinel) return null;
      origs.forEach((o, i) => {
        const c = cdoc.querySelector(`[${IDX}="${i}"]`);
        if (!c) return;
        for (const pseudo of ['', '::before', '::after'] as const) {
          if (pseudo && o.namespaceURI === SVG_NS) continue;
          const diff = diffElement(o, c, cwin, pseudo);
          if (i === 0 && !pseudo) for (const k of rootSkip) delete diff[k];
          const keys = Object.keys(diff);
          if (!keys.length) continue;
          const key = `${i}${pseudo}`;
          const patch = patches.get(key) || { idx: i, pseudo, props: {} };
          for (const k of keys) {
            // Segunda vuelta: si la corrección ya estaba y aún no gana, la regla original es !important
            if (round > 0 && k in patch.props) important.add(`${key}|${k}`);
            patch.props[k] = diff[k];
          }
          patches.set(key, patch);
        }
      });
      return geometryMatches(origs, cdoc);
    } finally {
      frame.remove();
    }
  };

  let fidelity = await pass(0);
  if (fidelity == null) return null;
  if (patches.size && Date.now() < deadline) {
    const again = await pass(1);
    if (again != null) fidelity = again;
    if (important.size && Date.now() < deadline) {
      const last = await pass(2);
      if (last != null) fidelity = last;
    }
  }
  return { patches: Array.from(patches.values()), important, fidelity };
}

// ── 5. JS de los widgets ───────────────────────────────────────────────────────────────────────

const WIDGETS_JS = `/* Code to Figma — interacción de los widgets estándar del bloque exportado.
 * Pestañas ARIA (role=tab), botones aria-expanded/aria-controls y collapse/dropdown/tab de Bootstrap.
 * El JavaScript propio del sitio no se copia. */
(function () {
  'use strict';
  var byId = function (id) { return id ? document.getElementById(id) : null; };
  var show = function (el, display) {
    if (!el) return;
    el.removeAttribute('hidden');
    el.style.display = '';
    if (getComputedStyle(el).display === 'none') el.style.display = el.getAttribute('data-ctf-display') || display || 'block';
  };
  var hide = function (el) {
    if (!el) return;
    el.setAttribute('hidden', '');
    if (getComputedStyle(el).display !== 'none') el.style.display = 'none';
  };
  var toggleClasses = function (el, classes, on) {
    if (!el || !classes) return;
    classes.split(/\\s+/).forEach(function (c) { if (c) el.classList.toggle(c, on); });
  };

  document.querySelectorAll('[data-ctf-w="tabs"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var select = function (tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        toggleClasses(t, list.getAttribute('data-ctf-on'), on);
        var panel = byId(t.getAttribute('aria-controls'));
        toggleClasses(panel, list.getAttribute('data-ctf-panel-on'), on);
        if (on) show(panel, list.getAttribute('data-ctf-display')); else hide(panel);
      });
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function (e) { e.preventDefault(); select(t); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var next = tabs[(i + d + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  });

  document.querySelectorAll('[data-ctf-w="disclosure"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (btn.tagName === 'A') e.preventDefault();
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var target = byId(btn.getAttribute('aria-controls'));
      if (open) show(target); else hide(target);
    });
  });

  var bsTarget = function (btn) {
    var sel = btn.getAttribute('data-bs-target') || btn.getAttribute('data-target') || btn.getAttribute('href');
    if (!sel || sel.charAt(0) !== '#') return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  };
  document.querySelectorAll('[data-ctf-w="bs-collapse"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var t = bsTarget(btn);
      if (!t) return;
      var open = !t.classList.contains('show');
      t.classList.toggle('show', open);
      btn.classList.toggle('collapsed', !open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.querySelectorAll('[data-ctf-w="bs-dropdown"]').forEach(function (btn) {
    var menu = btn.parentElement && btn.parentElement.querySelector('.dropdown-menu');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!menu) return;
      var open = !menu.classList.contains('show');
      menu.classList.toggle('show', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (menu && !btn.contains(e.target) && !menu.contains(e.target)) menu.classList.remove('show');
    });
  });
  document.querySelectorAll('[data-ctf-w="bs-tab"], [data-ctf-w="bs-pill"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var pane = bsTarget(btn);
      var nav = btn.closest('.nav, [role="tablist"]');
      if (nav) nav.querySelectorAll('[data-ctf-w="bs-tab"], [data-ctf-w="bs-pill"]').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
        var p = bsTarget(b);
        if (p) p.classList.remove('active', 'show');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      if (pane) pane.classList.add('active', 'show');
    });
  });
})();
`;

// ── Ensamblado ─────────────────────────────────────────────────────────────────────────────────

function slug(s: string): string {
  return (
    (s || 'componente')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'componente'
  );
}

function blockName(root: Element): string {
  const heading = root.querySelector('h1, h2, h3, h4');
  const label = root.getAttribute('aria-label') || (heading && heading.textContent) || '';
  if (label.trim()) return label.trim();
  const cls = (root.getAttribute('class') || '').split(/\s+/).find(c => c && !/^_|[0-9]{3,}/.test(c));
  return root.id || cls || root.tagName.toLowerCase();
}

export async function exportBlock(input: Element, opts: ExportOptions = {}): Promise<ExportResult> {
  let root = input;
  // Dentro de un <svg>: se exporta el <svg> entero (sus hijos no se sostienen solos)
  if (root.namespaceURI === SVG_NS && root.tagName.toLowerCase() !== 'svg') {
    root = (root as SVGElement).ownerSVGElement || root;
  }
  const pageMode = root === document.body || root === document.documentElement;
  if (root === document.documentElement) root = document.body;

  const warnings: string[] = [];
  const chain = pageMode ? [] : ancestorChain(root);
  const scope = [root, ...chain, document.body, document.documentElement];

  // 1-2. Reglas
  const { sources, unreadable } = await gatherSheets(opts.fetchCss);
  const ctx: FilterCtx = {
    root,
    scope,
    kept: 0,
    total: 0,
    keyframes: [],
    fontFaces: [],
    properties: [],
    cache: new Map(),
  };
  const ruleBlocks: string[] = [];
  for (const src of sources) {
    ctx.recover = undefined;
    if (src.loadText && needsRecovery(src.rules)) {
      const text = await src.loadText().catch(() => null);
      if (text) ctx.recover = buildRecovery(text, src.rules);
    }
    for (const r of filterRules(src.rules, src.base, ctx)) {
      ruleBlocks.push(src.media ? `@media ${src.media} {\n${r}\n}` : r);
    }
  }

  // 3. Clon
  // Animaciones de entrada por clase (AOS, WOW, is-visible…), detectadas sobre el original
  const styleReveals = (opts.reveals || []).filter(rv => rv && rv.el && root.contains(rv.el));
  const byStyle = new Set(styleReveals.map(rv => rv.el));
  const classReveals = detectClassReveals(root).filter(rv => !byStyle.has(rv.el));

  const { clone, origs, widgets, warnings: cloneWarnings } = cloneBlock(root);
  warnings.push(...cloneWarnings);
  clone.setAttribute('data-ctf-root', '');
  const defs = externalRefs(clone, root);

  const rulesText = pruneCustomProperties(dedupeKeepLast(ruleBlocks).join('\n'), clone.outerHTML);
  const usageText = rulesText + '\n' + clone.outerHTML;
  const keyframes = ctx.keyframes.filter(k =>
    new RegExp(`(?:^|[\\s,:])${escapeRe(k.name)}(?:$|[\\s,;!])`, 'm').test(usageText),
  );
  const lowerUsage = usageText.toLowerCase();
  const fontFaces = ctx.fontFaces.filter(f => f.family && lowerUsage.includes(f.family.toLowerCase()));
  const properties = ctx.properties.filter(p => usageText.includes(p.name));

  // Lo que pintaban o medían los ancestros (que aquí no tienen caja)
  const overrides: string[] = [];
  if (!pageMode) {
    const bg = backdropColor(root);
    const width = containerWidth(root);
    overrides.push(
      '[data-ctf-chain] { display: contents !important; }',
      `body { display: block !important; box-sizing: border-box !important; width: ${width}px !important; max-width: 100% !important; margin: 0 auto !important; padding: 0 !important; min-height: 0 !important; height: auto !important; overflow: visible !important; }`,
    );
    if (bg) overrides.push(`html { background: ${bg} !important; }`, 'body { background: transparent !important; }');
    const pos = getComputedStyle(root).position;
    if (pos === 'absolute' || pos === 'fixed' || pos === 'sticky') {
      overrides.push('[data-ctf-root] { position: relative !important; inset: auto !important; }');
    }
  }

  const source = `${location.href}`;
  const header = `/* Exportado con Code to Figma desde ${source.replace(/\*\//g, '* /')}\n * ${new Date().toISOString().slice(0, 10)} · ${ctx.kept} de ${ctx.total} reglas de la página */`;
  const baseCss = [
    header,
    ...fontFaces.map(f => f.text),
    ...properties.map(p => p.text),
    rulesText,
    ...keyframes.map(k => k.text),
    overrides.length ? '/* El bloque fuera de su página */\n' + overrides.join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const defsHtml = defs.length
    ? `<svg aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${defs
        .map(d => absolutizeCss(d.outerHTML, document.baseURI))
        .join('')}</defs></svg>`
    : '';

  const htmlAttrs = attrsOf(document.documentElement);
  const bodyAttrs = attrsOf(document.body);
  const title = `${blockName(root)} — ${document.title || location.hostname}`.slice(0, 120);

  const wrapChain = (cloneHtml: string) => {
    const open = chain.map(a => `<${a.tagName.toLowerCase()}${attrsOf(a, { 'data-ctf-chain': '' })}>`).join('');
    const close = chain
      .slice()
      .reverse()
      .map(a => `</${a.tagName.toLowerCase()}>`)
      .join('');
    return open + cloneHtml + close;
  };

  const buildDoc = (cloneHtml: string, head: string, tail: string) => {
    // Página completa: el clon ES el <body> (con sus atributos y marcas)
    const body = pageMode
      ? cloneHtml.replace(/<\/body>\s*$/i, `\n${defsHtml}\n${tail}</body>`)
      : `<body${bodyAttrs}>\n${wrapChain(cloneHtml)}\n${defsHtml}\n${tail}</body>`;
    return `<!doctype html>\n<html${htmlAttrs}>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeAttr(
      title,
    )}</title>\n${head}\n</head>\n${body}\n</html>\n`;
  };

  // 4. Verificación
  let patches: Patch[] = [];
  let important = new Set<string>();
  let fidelity: number | null = null;
  let verified = false;
  if (opts.verify !== false) {
    const indexed = clone.outerHTML;
    // Lo que se cambió a propósito en el bloque raíz no se "corrige" de vuelta
    const rootSkip = new Set(
      overrides.some(o => o.startsWith('[data-ctf-root]')) ? ['position', 'top', 'right', 'bottom', 'left'] : [],
    );
    const res = await verify(
      origs,
      () => buildDoc(indexed, '', ''),
      baseCss,
      opts.verifyTimeoutMs ?? 15000,
      rootSkip,
    ).catch(() => null);
    if (res) {
      verified = true;
      patches = res.patches;
      important = res.important;
      fidelity = res.fidelity;
    } else {
      warnings.push('No se pudo verificar el resultado en esta página');
    }
  }

  // Reveals: el clon vuelve a su estado oculto y script.js lo anima al entrar en la vista
  const indexOf = new Map(origs.map((o, i) => [o, String(i)]));
  const cloneByIdx = new Map<string, Element>();
  for (const el of [clone, ...Array.from(clone.querySelectorAll(`[${IDX}]`))]) {
    const i = el.getAttribute(IDX);
    if (i != null) cloneByIdx.set(i, el);
  }
  const reveal = applyRevealsToClone(classReveals, styleReveals, el => {
    const i = indexOf.get(el);
    return i != null ? cloneByIdx.get(i) || null : null;
  });

  // Marcas finales: solo los elementos corregidos conservan su número
  const patched = new Set(patches.map(p => p.idx));
  for (const el of [clone, ...Array.from(clone.querySelectorAll(`[${IDX}]`))]) {
    const i = el.getAttribute(IDX);
    el.removeAttribute(IDX);
    if (i != null && patched.has(Number(i))) el.setAttribute('data-ctf', i);
  }
  const css =
    baseCss +
    (patches.length
      ? `\n\n/* Ajustes medidos en la página: estilos que las reglas copiadas no reproducen (hojas que no se\n * pudieron leer, estilos puestos por JavaScript o que dependían de elementos que no se exportan) */\n${patchCss(patches, important)}`
      : '') +
    '\n' +
    (reveal.css ? '\n' + reveal.css : '');

  const js = [widgets.size ? WIDGETS_JS : '', reveal.count ? REVEAL_JS : ''].filter(Boolean).join('\n');
  const finalHtml = clone.outerHTML;
  const html = buildDoc(
    finalHtml,
    '<link rel="stylesheet" href="styles.css">',
    js ? '<script src="script.js"></script>\n' : '',
  );
  const singleFile = buildDoc(
    finalHtml,
    `<style>\n${css.replace(/<\/style/gi, '<\\/style')}</style>`,
    js ? `<script>\n${js.replace(/<\/script/gi, '<\\/script')}</script>\n` : '',
  );

  if (unreadable.length) {
    warnings.push(
      `${unreadable.length} hoja(s) de estilo no se pudieron leer; sus estilos llegan como ajustes medidos (sin @media ni :hover)`,
    );
  }

  return {
    html,
    css,
    js,
    singleFile,
    baseName: slug(blockName(root)),
    stats: {
      elements: origs.length,
      rules: ctx.kept,
      totalRules: ctx.total,
      sheets: sources.length,
      unreadableSheets: unreadable,
      verified,
      patchedElements: patched.size,
      patchedProps: patches.reduce((n, p) => n + Object.keys(p.props).length, 0),
      fidelity,
      widgets: Array.from(widgets),
      reveals: reveal.count,
      warnings,
    },
  };
}

// ── ZIP (sin compresión) ───────────────────────────────────────────────────────────────────────

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Un .zip "store" (sin comprimir): suficiente para unos pocos archivos de texto */
export function buildZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nombres en UTF-8
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

/** Los archivos del export listos para el zip */
export function exportFiles(res: ExportResult): Array<{ name: string; content: string }> {
  const files = [
    { name: 'index.html', content: res.html },
    { name: 'styles.css', content: res.css },
  ];
  if (res.js) files.push({ name: 'script.js', content: res.js });
  return files;
}
