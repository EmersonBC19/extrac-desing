/**
 * Animaciones de entrada al hacer scroll ("reveal") en la exportación HTML + CSS + JS.
 *
 * Al exportar, el inspector deja visibles los elementos que aparecen al hacer scroll (para medirlos
 * bien), así que el bloque exportado los mostraba siempre, sin animación. Aquí se devuelve cada uno
 * a su estado OCULTO en el HTML/CSS y script.js los anima al entrar en la vista con un
 * IntersectionObserver, como en la web. Dos tipos:
 *  - por clase: una librería o el sitio agrega una clase al aparecer (AOS: aos-animate; WOW o
 *    Animate.css: animated / animate__animated; is-visible, in-view…). Se detecta quitando la clase
 *    un instante, con las transiciones congeladas, y viendo si el elemento se oculta;
 *  - por estilos: JavaScript cambia opacity/transform en línea (GSAP, whileInView…). El inspector
 *    sabe su estado oculto y el visible (los anotó al recorrer la página) y los pasa aquí.
 * Con prefers-reduced-motion todo aparece sin animación.
 */

export interface StyleReveal {
  el: Element;
  hidden: { opacity: string; transform: string; visibility: string; filter?: string };
  visible: { opacity: string; transform: string; visibility: string; filter?: string };
  /** transition CSS original del elemento (si tenía una que anime opacity/transform) */
  transition?: string;
}

export interface ClassReveal {
  el: Element;
  classes: string[];
}

/** Clases con las que las librerías y los sitios marcan "ya apareció" */
export const REVEAL_CLASSES = [
  'aos-animate',
  'animated',
  'animate__animated',
  'is-visible',
  'is-revealed',
  'revealed',
  'reveal-visible',
  'in-view',
  'is-inview',
  'inview',
  'is-in-view',
  'visible',
  'appeared',
  'is-appeared',
  'animate-in',
  'animated-in',
];

const FREEZE = '*, *::before, *::after { transition: none !important; animation: none !important; }';

function freezeTransitions(): () => void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(FREEZE);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== sheet);
    };
  } catch (_e) {
    const style = document.createElement('style');
    style.textContent = FREEZE;
    (document.head || document.documentElement).appendChild(style);
    return () => style.remove();
  }
}

const translatePx = (transform: string): number => {
  const m = String(transform || '').match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const v = m[1].split(',').map(Number);
  return Math.hypot(v[4] || 0, v[5] || 0);
};
const scaleOf = (transform: string): number => {
  const m = String(transform || '').match(/matrix\(([^)]+)\)/);
  if (!m) return 1;
  const v = m[1].split(',').map(Number);
  return Math.hypot(v[0], v[1]);
};

/** ¿El estado sin la clase está "oculto" respecto del visible? (desvanecido, desplazado o escalado) */
function looksHidden(withClass: CSSStyleDeclaration | Record<string, string>, without: Record<string, string>) {
  const o1 = parseFloat((withClass as any).opacity);
  const o0 = parseFloat(without.opacity);
  if (o1 - o0 > 0.5) return true;
  if ((withClass as any).visibility !== 'hidden' && without.visibility === 'hidden') return true;
  const dt = Math.abs(translatePx(without.transform) - translatePx((withClass as any).transform));
  const ds = Math.abs(scaleOf(without.transform) - scaleOf((withClass as any).transform));
  return o1 - o0 > 0.2 && (dt > 8 || ds > 0.05);
}

/**
 * Reveals por clase dentro de `root`: elementos con una clase de REVEAL_CLASSES que, al quitarla,
 * quedan ocultos. Las transiciones se congelan durante la prueba: la página no parpadea.
 */
export function detectClassReveals(root: Element, max = 300): ClassReveal[] {
  const found: ClassReveal[] = [];
  const candidates = [root, ...Array.from(root.querySelectorAll('*'))].filter(el =>
    REVEAL_CLASSES.some(c => el.classList && el.classList.contains(c)),
  );
  if (!candidates.length) return found;
  const unfreeze = freezeTransitions();
  try {
    for (const el of candidates.slice(0, max)) {
      const cs = window.getComputedStyle(el);
      if (cs.position === 'fixed' || cs.display === 'none') continue;
      const visible = { opacity: cs.opacity, visibility: cs.visibility, transform: cs.transform };
      if (!(parseFloat(visible.opacity) > 0.5) || visible.visibility === 'hidden') continue;
      const classes = REVEAL_CLASSES.filter(c => el.classList.contains(c));
      el.classList.remove(...classes);
      const after = window.getComputedStyle(el);
      const hidden = { opacity: after.opacity, visibility: after.visibility, transform: after.transform };
      el.classList.add(...classes);
      void window.getComputedStyle(el).opacity; // volver al estado visible antes de descongelar
      if (looksHidden(visible, hidden)) found.push({ el, classes });
    }
  } finally {
    unfreeze();
  }
  return found;
}

/** Quita del estilo en línea del clon las propiedades que el inspector forzó para medir */
function stripForced(clone: Element) {
  const style = (clone as HTMLElement).style;
  if (!style) return;
  for (const p of ['opacity', 'visibility', 'transform', 'filter', 'transition', 'animation']) {
    if (style.getPropertyPriority(p) === 'important') style.removeProperty(p);
  }
  if (!style.length) clone.removeAttribute('style');
}

/** Transición de la entrada: la del elemento si animaba opacity/transform; si no, 0,6 s ease-out */
export function enterTransition(original: string | undefined): string {
  const t = String(original || '').trim();
  const durations = [...t.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map(m => parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1));
  if (/(opacity|transform|all)/.test(t) && durations.some(d => d > 0)) return t;
  return 'opacity 0.6s ease-out, transform 0.6s ease-out, filter 0.6s ease-out';
}

export interface RevealResult {
  css: string;
  count: number;
}

/**
 * Aplica los reveals al clon exportado. `cloneOf` da el clon de un elemento original.
 * Devuelve el CSS de los reveals por estilos (estado oculto, visible y transición).
 */
export function applyRevealsToClone(
  classReveals: ClassReveal[],
  styleReveals: StyleReveal[],
  cloneOf: (el: Element) => Element | null,
): RevealResult {
  const rules: string[] = [];
  let count = 0;
  for (const r of classReveals) {
    const c = cloneOf(r.el);
    if (!c) continue;
    c.classList.remove(...r.classes);
    if (!c.getAttribute('class')) c.removeAttribute('class');
    c.setAttribute('data-ctf-reveal', 'class');
    c.setAttribute('data-ctf-reveal-class', r.classes.join(' '));
    count++;
  }
  styleReveals.forEach(r => {
    const c = cloneOf(r.el);
    if (!c) return;
    stripForced(c);
    const id = `r${count}`;
    c.setAttribute('data-ctf-reveal', id);
    const decl = (s: StyleReveal['hidden']) =>
      [
        `opacity: ${s.opacity}`,
        s.transform && s.transform !== 'none' ? `transform: ${s.transform}` : 'transform: none',
        `visibility: ${s.visibility || 'visible'}`,
        s.filter && s.filter !== 'none' ? `filter: ${s.filter}` : '',
      ]
        .filter(Boolean)
        // !important: las reglas copiadas del sitio pueden ser más específicas que el atributo
        .map(d => `${d} !important`)
        .join('; ');
    rules.push(
      `[data-ctf-reveal="${id}"] { ${decl(r.hidden)}; transition: ${enterTransition(r.transition)} !important; }`,
      `[data-ctf-reveal="${id}"].ctf-in { ${decl(r.visible)}; }`,
    );
    count++;
  });
  if (!count) return { css: '', count };
  const css =
    `/* Animaciones de entrada al hacer scroll: el estado oculto está aquí o en las reglas copiadas;\n * script.js las activa al entrar en la vista (sin animación con prefers-reduced-motion) */\n` +
    rules.join('\n') +
    (rules.length ? '\n' : '') +
    `@media (prefers-reduced-motion: reduce) {\n  [data-ctf-reveal] { transition: none !important; animation: none !important; }\n}\n`;
  return { css, count };
}

/** script.js: activa cada reveal al entrar en la vista (una vez) */
export const REVEAL_JS = `/* Code to Figma — animaciones de entrada al hacer scroll */
(function () {
  var els = document.querySelectorAll('[data-ctf-reveal]');
  if (!els.length) return;
  function show(el) {
    var cls = el.getAttribute('data-ctf-reveal-class');
    if (cls) cls.split(' ').forEach(function (c) { if (c) el.classList.add(c); });
    else el.classList.add('ctf-in');
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(els, show);
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        show(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  Array.prototype.forEach.call(els, function (el) { io.observe(el); });
})();
`;
