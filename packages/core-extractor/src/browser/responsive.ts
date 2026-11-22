/**
 * Breakpoints y claro/oscuro (Función A de la propuesta): el mismo bloque a varios anchos de
 * pantalla y en los dos temas, para que Figma lo reciba como variantes `Breakpoint=…` y con sus
 * colores como Variables de modos Light/Dark.
 *
 * Cómo se consigue otro ancho sin redimensionar la ventana ni pedir permisos: el bloque se exporta
 * (export-html.ts: sus reglas reales, con @media) y se dibuja en una página propia de la extensión
 * (render-frame.html) incrustada con ese ancho; sus @media responden de verdad y el extractor corre
 * ahí dentro. La comunicación va por un MessageChannel privado (la página no la ve).
 *
 * Tema oscuro:
 *  - Si el CSS usa prefers-color-scheme / light-dark(), se reescribe para forzar el otro tema.
 *  - Si no, se prueba el interruptor de tema por clase del sitio (html.dark, data-theme…); si cambia
 *    los colores del bloque, se captura con él activado y se deja todo como estaba.
 *
 * Límite: lo que cambia por JavaScript al redimensionar (no por CSS) no aparece en los otros anchos.
 */
import { exportBlock, type ExportOptions } from './export-html';

export interface CaptureOptions {
  /** Anchos a capturar (por defecto 375, 768 y 1440) */
  widths?: number[];
  breakpoints?: boolean;
  themes?: boolean;
  /** URL de render-frame.html (chrome.runtime.getURL en la extensión) */
  frameUrl: string;
  /** Token de un solo uso por captura (la extensión lo pide al service worker) */
  getToken?: () => Promise<string>;
  fetchCss?: ExportOptions['fetchCss'];
  /** El bloque ya extraído de la página en vivo (ancho y tema actuales) */
  liveRootNode?: any;
  timeoutMs?: number;
}

export interface CaptureVariant {
  name: string;
  width: number;
  rootNode: any;
  /** El mismo bloque en tema oscuro (Figma empareja sus colores con los de rootNode) */
  dark?: any;
}

export interface CaptureResult {
  variants: CaptureVariant[];
  themeSource: 'media' | 'class' | null;
  warnings: string[];
}

export const DEFAULT_WIDTHS = [375, 768, 1440];

export function breakpointName(width: number): string {
  if (width < 600) return 'Mobile';
  if (width < 1024) return 'Tablet';
  return 'Desktop';
}

// ── Página de render ───────────────────────────────────────────────────────────────────────────

/** Documento del export sin hoja enlazada ni scripts: el CSS viaja aparte (hoja construida) */
function captureDoc(html: string): string {
  return html
    .replace(/<link rel="stylesheet" href="styles\.css">/, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

/**
 * Dibuja `html` + `css` en render-frame.html a `width` px y devuelve la extracción del bloque
 * ([data-ctf-root]). La página se crea, se usa y se quita.
 */
export async function extractInFrame(
  frameUrl: string,
  html: string,
  css: string,
  width: number,
  timeoutMs = 20000,
  token = '',
): Promise<any> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  const h = Math.max(600, innerHeight);
  frame.style.cssText = `position:fixed!important;left:-${width + 400}px!important;top:0!important;width:${width}px!important;height:${h}px!important;border:0!important;opacity:0!important;pointer-events:none!important;display:block!important;visibility:visible!important`;
  const loaded = new Promise<void>((resolve, reject) => {
    frame.addEventListener('load', () => resolve(), { once: true });
    frame.addEventListener('error', () => reject(new Error('No se pudo abrir la página de render')), { once: true });
  });
  frame.src = frameUrl;
  document.documentElement.appendChild(frame);
  try {
    await withTimeout(loaded, timeoutMs, 'La página de render no cargó');
    const channel = new MessageChannel();
    const reply = new Promise<any>((resolve, reject) => {
      channel.port1.onmessage = e => {
        const d = e.data || {};
        if (d.ok) resolve(d.rootNode);
        else reject(new Error(d.error || 'Error en la página de render'));
      };
    });
    frame.contentWindow!.postMessage({ type: 'CTF_RENDER', html, css, token }, '*', [channel.port2]);
    return await withTimeout(reply, timeoutMs, `Tiempo agotado capturando a ${width}px`);
  } finally {
    frame.remove();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// ── Tema ───────────────────────────────────────────────────────────────────────────────────────

/** ¿El CSS del bloque depende del tema del sistema? */
export function usesColorScheme(css: string): boolean {
  return /prefers-color-scheme|light-dark\(/i.test(css);
}

/**
 * Fuerza un tema en el CSS: las condiciones `(prefers-color-scheme: …)` pasan a ser siempre ciertas
 * (el tema pedido) o siempre falsas (el otro), y `color-scheme` fija ese tema (resuelve light-dark()).
 */
export function forceColorScheme(css: string, scheme: 'dark' | 'light'): string {
  return css
    .replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi, (_m, v: string) =>
      v.toLowerCase() === scheme ? '(min-width: 0px)' : '(max-width: 0.001px)',
    )
    .replace(/(^|[;{\s])color-scheme\s*:\s*[^;}]+/gi, `$1color-scheme: ${scheme}`)
    .concat(`\n:root { color-scheme: ${scheme}; }\n`);
}

const THEME_ATTRS = ['data-theme', 'data-bs-theme', 'data-color-mode', 'data-mode'];
const DARK_CLASSES = ['dark', 'dark-theme', 'dark-mode', 'theme-dark'];

export function pageLooksDark(): boolean {
  const root = document.documentElement;
  const body = document.body;
  return (
    DARK_CLASSES.some(c => root.classList.contains(c) || (body && body.classList.contains(c))) ||
    THEME_ATTRS.some(a => root.getAttribute(a) === 'dark')
  );
}

/**
 * Activa el tema contrario por clase/atributo (las convenciones habituales: Tailwind `dark`,
 * Bootstrap `data-bs-theme`, GitHub `data-color-mode`…). Devuelve cómo deshacerlo exactamente.
 */
export function toggleClassTheme(): () => void {
  const els = [document.documentElement, document.body].filter(Boolean) as HTMLElement[];
  const saved = els.map(el => ({
    el,
    cls: el.getAttribute('class'),
    attrs: THEME_ATTRS.map(a => [a, el.getAttribute(a)] as const),
  }));
  const dark = pageLooksDark();
  const root = document.documentElement;
  for (const el of els) {
    if (dark) DARK_CLASSES.forEach(c => el.classList.remove(c));
    else el.classList.add('dark');
  }
  for (const a of THEME_ATTRS.slice(0, 3)) root.setAttribute(a, dark ? 'light' : 'dark');
  return () => {
    for (const s of saved) {
      if (s.cls == null) s.el.removeAttribute('class');
      else s.el.setAttribute('class', s.cls);
      for (const [a, v] of s.attrs) {
        if (v == null) s.el.removeAttribute(a);
        else s.el.setAttribute(a, v);
      }
    }
  };
}

/** Colores visibles del bloque (para saber si un cambio de tema le afecta) */
function colorSignature(root: Element): string {
  const els = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 400)];
  return els
    .map(el => {
      const cs = getComputedStyle(el);
      return `${cs.color}|${cs.backgroundColor}|${cs.borderTopColor}`;
    })
    .join(';');
}

/** Sin transiciones mientras se captura (si no, los colores estarían a medio camino) */
function freezeTransitions(): () => void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync('*, *::before, *::after { transition: none !important; }');
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== sheet);
  };
}

// ── Captura ────────────────────────────────────────────────────────────────────────────────────

export async function captureVariants(el: Element, opts: CaptureOptions): Promise<CaptureResult> {
  const warnings: string[] = [];
  const timeout = opts.timeoutMs ?? 20000;
  const current = Math.round(innerWidth);
  const inFrame = async (doc: string, css: string, w: number) =>
    extractInFrame(opts.frameUrl, doc, css, w, timeout, opts.getToken ? await opts.getToken() : '');
  const extractLive = async () => {
    const res = await window.__codeToFigmaExtract!(el);
    if (!res) throw new Error('No se pudo extraer el bloque');
    return res.rootNode;
  };

  // Anchos: el de escritorio sale de la página en vivo (lo más fiel: incluye lienzos, vídeo…)
  // cuando la ventana es de escritorio; el resto, de la página de render
  let widths =
    opts.breakpoints === false ? [current] : opts.widths && opts.widths.length ? opts.widths : DEFAULT_WIDTHS;
  widths = Array.from(new Set(widths.map(w => Math.round(w)))).sort((a, b) => a - b);
  const liveIdx =
    current >= 1024 ? widths.findIndex(w => w >= 1024) : widths.findIndex(w => Math.abs(w - current) <= 2);
  if (liveIdx >= 0) widths[liveIdx] = current;
  else if (opts.breakpoints === false) widths = [current];

  const exp = await exportBlock(el, { verify: false, fetchCss: opts.fetchCss });
  const doc = captureDoc(exp.html);

  const variants: CaptureVariant[] = [];
  for (const w of widths) {
    const rootNode =
      w === current && liveIdx >= 0 ? opts.liveRootNode || (await extractLive()) : await inFrame(doc, exp.css, w);
    variants.push({ name: breakpointName(w), width: w, rootNode });
  }
  // Dos anchos con el mismo nombre (p. ej. 1024 y 1440): se distinguen por el ancho
  const seen = new Map<string, number>();
  for (const v of variants) seen.set(v.name, (seen.get(v.name) || 0) + 1);
  for (const v of variants) if ((seen.get(v.name) || 0) > 1) v.name = `${v.name} ${v.width}`;

  let themeSource: CaptureResult['themeSource'] = null;
  if (opts.themes) {
    if (usesColorScheme(exp.css)) {
      themeSource = 'media';
      const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
      const otherCss = forceColorScheme(exp.css, isDark ? 'light' : 'dark');
      for (const v of variants) {
        const other = await inFrame(doc, otherCss, v.width);
        if (isDark) {
          v.dark = v.rootNode;
          v.rootNode = other;
        } else v.dark = other;
      }
    } else {
      const before = colorSignature(el);
      const unfreeze = freezeTransitions();
      const isDark = pageLooksDark();
      const undo = toggleClassTheme();
      try {
        void getComputedStyle(el).color; // recalcular con el tema nuevo
        if (colorSignature(el) !== before) {
          themeSource = 'class';
          const expOther = await exportBlock(el, { verify: false, fetchCss: opts.fetchCss });
          const docOther = captureDoc(expOther.html);
          for (const v of variants) {
            const other =
              v.width === current && liveIdx >= 0
                ? await extractLive()
                : await inFrame(docOther, expOther.css, v.width);
            if (isDark) {
              v.dark = v.rootNode;
              v.rootNode = other;
            } else v.dark = other;
          }
        } else {
          warnings.push(
            'Este bloque no cambia de colores con el tema oscuro de la página: se envía solo el tema actual',
          );
        }
      } finally {
        undo();
        void getComputedStyle(el).color;
        unfreeze();
      }
    }
  }
  return { variants, themeSource, warnings: [...warnings, ...exp.stats.warnings.filter(w => /hoja/.test(w))] };
}
