/**
 * Estados de interacción sin mover el puntero (plan de mejoras, fase 6.1).
 *
 * Las reglas `:hover` (y `:focus`, `:focus-visible`) de las hojas de estilo de la página se copian
 * reescritas como `[data-ctf-state~="hover"]` y se marca el elemento y sus ancestros (en un hover
 * real también están en :hover). Se extrae y se deshace todo. Misma especificidad que la pseudo-
 * clase y declaradas al final, así que ganan igual que en un hover real.
 *
 * Límites (documentados): hojas de otro dominio sin CORS no se pueden leer (el navegador lo
 * impide) y los efectos hechos con JavaScript (mouseenter) no aparecen.
 */
export type InteractionState = 'hover' | 'focus';

const ATTR = 'data-ctf-state';
const PSEUDO: Record<InteractionState, RegExp> = {
  hover: /:hover\b/g,
  focus: /:focus(?:-visible|-within)?\b/g,
};

export interface StateEmulation {
  /** Reglas de la página que cambian este elemento o su contenido en ese estado */
  rules: number;
  /** Hojas que no se pudieron leer (otro dominio sin CORS) */
  unreadableSheets: number;
  undo: () => void;
}

/** Reglas de estilo de una hoja (entrando en @media que aplican, @supports, @layer, @container) */
function collectRules(list: CSSRuleList, out: CSSStyleRule[]) {
  for (const rule of Array.from(list)) {
    if (rule instanceof CSSStyleRule) out.push(rule);
    else if (rule instanceof CSSMediaRule) {
      if (window.matchMedia(rule.conditionText || rule.media.mediaText).matches) collectRules(rule.cssRules, out);
    } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      collectRules((rule as CSSGroupingRule).cssRules, out);
    }
  }
}

function mark(el: Element, state: InteractionState): () => void {
  const touched: [Element, string | null][] = [];
  for (let p: Element | null = el; p; p = p.parentElement) {
    const prev = p.getAttribute(ATTR);
    touched.push([p, prev]);
    p.setAttribute(ATTR, prev ? `${prev} ${state}` : state);
  }
  return () => {
    for (const [p, prev] of touched) {
      if (prev === null) p.removeAttribute(ATTR);
      else p.setAttribute(ATTR, prev);
    }
  };
}

/**
 * Aplica el estado al elemento. Devuelve null si ninguna regla legible lo cambia (no hay
 * variante que capturar).
 */
export function emulateState(target: Element, state: InteractionState): StateEmulation | null {
  const pseudo = PSEUDO[state];
  const rules: CSSStyleRule[] = [];
  let unreadableSheets = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectRules(sheet.cssRules, rules);
    } catch (_e) {
      unreadableSheets++;
    }
  }

  const unmark = mark(target, state);
  const css: string[] = [];
  for (const rule of rules) {
    const sel = rule.selectorText || '';
    pseudo.lastIndex = 0;
    if (!pseudo.test(sel)) continue;
    // Solo las partes del selector con la pseudo-clase, reescritas
    const parts = sel
      .split(/,(?![^(]*\))/)
      .filter(part => {
        pseudo.lastIndex = 0;
        return pseudo.test(part);
      })
      .map(part => part.replace(pseudo, `[${ATTR}~="${state}"]`).trim());
    const relevant = parts.filter(part => {
      try {
        return target.matches(part) || !!target.querySelector(part);
      } catch (_e) {
        return false;
      }
    });
    if (relevant.length) css.push(`${relevant.join(', ')} { ${rule.style.cssText} }`);
  }
  if (!css.length) {
    unmark();
    return null;
  }
  // Sin transiciones ni animaciones: el estado final se ve al instante. Va en una hoja aparte
  // porque al deshacer hay que quitarla DESPUÉS de las reglas del estado; si se quitaran juntas,
  // el navegador animaría la vuelta al estado normal (parpadeo visible en la página).
  const removeState = addSheet(css.join('\n'));
  const removeFreeze = addSheet(`[${ATTR}], [${ATTR}] * { transition: none !important; animation: none !important; }`);
  void target.getBoundingClientRect(); // forzar el recálculo de estilos
  return {
    rules: css.length,
    unreadableSheets,
    undo: () => {
      removeState();
      // Recalcular con las transiciones aún congeladas: vuelve al estado normal sin animación
      void window.getComputedStyle(target).color;
      void target.getBoundingClientRect();
      unmark();
      removeFreeze();
    },
  };
}

/** Hoja de estilo temporal (constructable; si no se puede, <style>). Devuelve cómo quitarla */
function addSheet(cssText: string): () => void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== sheet);
    };
  } catch (_e) {
    const style = document.createElement('style');
    style.textContent = cssText;
    (document.head || document.documentElement).appendChild(style);
    return () => style.remove();
  }
}
