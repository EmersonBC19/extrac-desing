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
} from './dom-helpers';
import { isInlineTextRoot, buildRichText } from './text';
import { fitAutoLayoutToGeometry, pseudoPosition } from './geometry';
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
  if (parentRect !== null && isVisuallyHidden(style, rect)) return null;
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
  if (parentRect && (style.position === 'fixed' || style.position === 'sticky') && window.scrollY > 0) {
    const parentEl = element.parentElement;
    const parentFixed = parentEl && window.getComputedStyle(parentEl).position === 'fixed';
    const parentDocTop = parentRect.top + window.scrollY;
    if (!parentFixed && (style.position === 'fixed' || parentDocTop <= 1)) {
      relY = Math.round(rect.top - parentDocTop);
    }
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
        _sharedCtx.clearRect(0, 0, 1, 1);
        _sharedCtx.fillStyle = str;
        _sharedCtx.fillRect(0, 0, 1, 1);
        const d = _sharedCtx.getImageData(0, 0, 1, 1).data;
        if (d[3] === 0) return null;
        return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 };
      }
    } catch (_e) {}
    return null;
  }

  // ── 2. Gradient Parser (Linear & Radial) ──
  function parseGradient(bgStr: string) {
    if (!bgStr || !bgStr.includes('gradient')) return null;

    // Gradientes Radiales
    const radMatch = bgStr.match(/radial-gradient\((.*)\)/i);
    if (radMatch) {
      const inner = radMatch[1];
      let stopsStr = inner;
      const firstComma = inner.indexOf(',');
      if (firstComma > -1 && (inner.includes('circle') || inner.includes('ellipse') || inner.includes('at'))) {
        stopsStr = inner.slice(firstComma + 1).trim();
      }
      const rawStops = splitCssList(stopsStr);
      const stops = [];
      for (let i = 0; i < rawStops.length; i++) {
        const stopPart = rawStops[i];
        const colorMatch = stopPart.match(/(rgba?\([^)]+\)|#[a-f0-9]+|[a-z]+)/i);
        if (!colorMatch) continue;
        const col = parseColor(colorMatch[0]);
        if (!col) continue;

        let pos = i / Math.max(1, rawStops.length - 1);
        const posMatch = stopPart
          .replace(colorMatch[0], '')
          .trim()
          .match(/([\d.]+)%/);
        if (posMatch) {
          pos = parseFloat(posMatch[1]) / 100;
        }
        stops.push({ position: Math.max(0, Math.min(1, pos)), color: col });
      }
      if (stops.length >= 2) {
        return { type: 'GRADIENT_RADIAL', stops };
      }
    }

    // Gradientes Lineales
    const linMatch = bgStr.match(/linear-gradient\((.*)\)/i);
    if (!linMatch) return null;
    const inner = linMatch[1];

    let angle = 180;
    let stopsStr = inner;
    const firstComma = inner.indexOf(',');
    if (firstComma > -1) {
      const firstToken = inner.slice(0, firstComma).trim().toLowerCase();
      if (firstToken.includes('deg')) {
        angle = parseFloat(firstToken) || 180;
        stopsStr = inner.slice(firstComma + 1).trim();
      } else if (firstToken === 'to top') {
        angle = 0;
        stopsStr = inner.slice(firstComma + 1).trim();
      } else if (firstToken === 'to right') {
        angle = 90;
        stopsStr = inner.slice(firstComma + 1).trim();
      } else if (firstToken === 'to bottom') {
        angle = 180;
        stopsStr = inner.slice(firstComma + 1).trim();
      } else if (firstToken === 'to left') {
        angle = 270;
        stopsStr = inner.slice(firstComma + 1).trim();
      }
    }

    const rawStops = splitCssList(stopsStr);
    const stops = [];
    for (let i = 0; i < rawStops.length; i++) {
      const stopPart = rawStops[i];
      const colorMatch = stopPart.match(/(rgba?\([^)]+\)|#[a-f0-9]+|[a-z]+)/i);
      if (!colorMatch) continue;
      const col = parseColor(colorMatch[0]);
      if (!col) continue;

      let pos = i / Math.max(1, rawStops.length - 1);
      const posMatch = stopPart
        .replace(colorMatch[0], '')
        .trim()
        .match(/([\d.]+)%/);
      if (posMatch) {
        pos = parseFloat(posMatch[1]) / 100;
      }
      stops.push({ position: Math.max(0, Math.min(1, pos)), color: col });
    }

    if (stops.length >= 2) {
      return { type: 'GRADIENT_LINEAR', angle, stops };
    }
    return null;
  }

  // ── 3. Box Shadow Parser ──
  function parseBoxShadow(shadowStr: string) {
    if (!shadowStr || shadowStr === 'none') return [];
    const shadows = [];
    const parts = splitCssList(shadowStr);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colorMatch = trimmed.match(/(rgba?\([^)]+\)|#[a-f0-9]+)/i);
      const color = colorMatch ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 0.15 };
      const cleanLength = trimmed.replace(/(rgba?\([^)]+\)|#[a-f0-9]+)/i, '').trim();
      const lengths = cleanLength.split(/\s+/).map(l => parseFloat(l) || 0);
      if (lengths.length >= 2 && color) {
        shadows.push({
          color,
          offset: { x: lengths[0], y: lengths[1] },
          radius: lengths[2] || 0,
          spread: lengths[3] || 0,
        });
      }
    }
    return shadows;
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
      const bg = parseColor(style.backgroundColor);
      const w = parseFloat(style.width) || 0;
      const h = parseFloat(style.height) || 0;
      const bgUrl = extractBgUrl(style.backgroundImage);
      const hasBgGrad = !!parseGradient(style.backgroundImage);

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
            cornerRadius: parseFloat(style.borderRadius) || 0,
            imageScaleMode: bgScaleMode(style),
          },
          children: [],
        };
        pNode._pendingBgImageSrc = bgUrl;
        return pNode;
      }

      if (!hasContent) {
        if ((!bg || bg.a <= 0.05) && !hasBgGrad) return null;
        if (w <= 0 || h <= 0) return null;
      }

      const rawText = (content || '').replace(/^['"]|['"]$/g, '').trim();
      const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
      const isPosAbs = style.position === 'absolute' || style.position === 'fixed';
      const br = parseFloat(style.borderRadius) || 0;

      if (rawText.length > 0) {
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
          },
        };
      } else if (w > 0 && h > 0 && ((bg && bg.a > 0.05) || hasBgGrad)) {
        const decoFills = hasBgGrad ? [parseGradient(style.backgroundImage)] : [bg];
        return {
          id: 'pseudo_' + ++counter.id,
          name: pseudo === '::before' ? 'Decorator / Before' : 'Decorator / After',
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
            fills: decoFills,
            cornerRadius: br > 0 ? br : 0,
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

    // Limpiar clases utilitarias de Tailwind / Angular para no usarlas de nombre
    const rawClass = typeof el.className === 'string' ? el.className.trim() : '';
    if (rawClass) {
      const cleanClasses = rawClass.split(/\\s+/).filter(c => {
        return !/^(mb-|mt-|ml-|mr-|p-|px-|py-|w-|h-|flex|grid|block|inline|relative|absolute|text-|bg-|border-|rounded-|ng-|mat-|cursor-|transition-|duration-|hover:|focus:)/.test(
          c,
        );
      });
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

    const origVectors = element.querySelectorAll('path, circle, rect, polygon, line, ellipse');
    const cloneVectors = svgClone.querySelectorAll('path, circle, rect, polygon, line, ellipse');
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
      if (vFill && vFill !== 'none') {
        if (hasStroke) {
          // Icono tipo outline / stroke: si no tiene fill explícito inline o es none/transparent, NUNCA forzar sólido
          const explicitFill = ov.getAttribute('fill');
          if (!explicitFill || explicitFill === 'none' || explicitFill === 'transparent') {
            cv.setAttribute('fill', 'none');
          } else {
            const pf = parseColor(explicitFill, style.color) || parseColor(vFill, style.color) || cc;
            const fHex =
              '#' +
              Math.round(pf.r * 255)
                .toString(16)
                .padStart(2, '0') +
              Math.round(pf.g * 255)
                .toString(16)
                .padStart(2, '0') +
              Math.round(pf.b * 255)
                .toString(16)
                .padStart(2, '0');
            cv.setAttribute('fill', fHex);
            if (pf.a < 1) cv.setAttribute('fill-opacity', String(pf.a));
          }
        } else {
          // Icono puramente sólido (ej. logo Banco Pichincha)
          const pf = parseColor(vFill, style.color) || cc;
          const fHex =
            '#' +
            Math.round(pf.r * 255)
              .toString(16)
              .padStart(2, '0') +
            Math.round(pf.g * 255)
              .toString(16)
              .padStart(2, '0') +
            Math.round(pf.b * 255)
              .toString(16)
              .padStart(2, '0');
          cv.setAttribute('fill', fHex);
          if (pf.a < 1) cv.setAttribute('fill-opacity', String(pf.a));
        }
      } else {
        cv.setAttribute('fill', 'none');
      }

      if (hasStroke) {
        const strokeColorStr =
          vStroke && vStroke !== 'none'
            ? vStroke
            : svgCompStyle.stroke && svgCompStyle.stroke !== 'none'
              ? svgCompStyle.stroke
              : style.color;
        const ps = parseColor(strokeColorStr, style.color) || cc;
        const sHex =
          '#' +
          Math.round(ps.r * 255)
            .toString(16)
            .padStart(2, '0') +
          Math.round(ps.g * 255)
            .toString(16)
            .padStart(2, '0') +
          Math.round(ps.b * 255)
            .toString(16)
            .padStart(2, '0');
        cv.setAttribute('stroke', sHex);
        if (ps.a < 1) cv.setAttribute('stroke-opacity', String(ps.a));
        cv.setAttribute(
          'stroke-width',
          vs.strokeWidth && vs.strokeWidth !== '0px' ? vs.strokeWidth : svgCompStyle.strokeWidth || '2',
        );
        cv.setAttribute('stroke-linecap', vs.strokeLinecap || 'round');
        cv.setAttribute('stroke-linejoin', vs.strokeLinejoin || 'round');
      }
    }

    let w = Math.max(1, Math.round(rect.width) || 24);
    let h = Math.max(1, Math.round(rect.height) || 24);
    // Preservar aspect ratio 1:1 en iconos donde el bounding box DOM tiene ligeras variaciones (ej. 28x31 por line-height de ng-icon)
    if (Math.abs(w - h) <= 6 && Math.min(w, h) >= 14) {
      const squareSize = Math.min(w, h);
      w = squareSize;
      h = squareSize;
    }

    let raw = svgClone.outerHTML;
    raw = raw.replace(/currentColor/gi, ccHex);
    // Inlinear y limpiar variables CSS como style="stroke-width:var(--ng-icon__stroke-width, 2)"
    raw = raw.replace(/var\(--[a-zA-Z0-9_-]+,\s*([^)]+)\)/g, '$1');
    raw = raw.replace(/style="[^"]*"/gi, '');
    if (!/viewBox/i.test(raw)) raw = raw.replace('<svg', '<svg viewBox="0 0 ' + w + ' ' + h + '"');
    if (!/width=/i.test(raw)) raw = raw.replace('<svg', '<svg width="' + w + '"');
    if (!/height=/i.test(raw)) raw = raw.replace('<svg', '<svg height="' + h + '"');
    raw = raw.replace(/\\s+(ng-reflect-[a-z-]+|_ng[a-z]+-[a-z0-9-]+|data-mat-icon-[a-z]+|class)="[^"]*"/gi, '');

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
      styles: { fills: [] },
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
        cornerRadius: parseFloat(style.borderRadius) || 0,
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
        cornerRadius: parseFloat(imgFitStyle.borderRadius) || parseFloat(style.borderRadius) || 0,
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
  const grad = parseGradient(style.backgroundImage);
  const pendingBgSrc = extractBgUrl(style.backgroundImage);
  const bgColor = parseColor(style.backgroundColor);
  if (bgColor && bgColor.a > 0.01) fills.push(bgColor);
  if (grad) fills.push(grad);

  // ── 9. Strokes & Borders en Cualquier Lado ──
  const topW = Math.round(parseFloat(style.borderTopWidth) || 0);
  const rightBW = Math.round(parseFloat(style.borderRightWidth) || 0);
  const bottomW = Math.round(parseFloat(style.borderBottomWidth) || 0);
  const leftBW = Math.round(parseFloat(style.borderLeftWidth) || 0);
  const hasBorder =
    (topW > 0 && style.borderTopStyle !== 'none') ||
    (rightBW > 0 && style.borderRightStyle !== 'none') ||
    (bottomW > 0 && style.borderBottomStyle !== 'none') ||
    (leftBW > 0 && style.borderLeftStyle !== 'none');

  const strokeColor =
    parseColor(style.borderTopColor, style.color) ||
    parseColor(style.borderBottomColor, style.color) ||
    parseColor(style.borderLeftColor, style.color) ||
    parseColor(style.borderRightColor, style.color);

  const strokes = [];
  let borderSides = undefined;
  const maxBW = Math.max(topW, rightBW, bottomW, leftBW);
  if (hasBorder && strokeColor && strokeColor.a > 0.01) {
    strokes.push({ ...strokeColor, width: maxBW || 1, align: 'INSIDE' });
    if (topW !== rightBW || topW !== bottomW || topW !== leftBW) {
      borderSides = { top: topW, right: rightBW, bottom: bottomW, left: leftBW };
    }
  }

  // ── 10. Corner Radius ──
  const rtl = parseFloat(style.borderTopLeftRadius) || 0;
  const rtr = parseFloat(style.borderTopRightRadius) || 0;
  const rbr = parseFloat(style.borderBottomRightRadius) || 0;
  const rbl = parseFloat(style.borderBottomLeftRadius) || 0;
  const cornerRadius = rtl === rtr && rtr === rbr && rbr === rbl ? rtl : [rtl, rtr, rbr, rbl];

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
  let mode = 'NONE';
  let itemSpacing = 0;
  let primaryAlign = 'MIN';
  let counterAlign = 'MIN';
  let layoutWrap = 'NO_WRAP';

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
    if (hasAreas || (rows.length > 1 && cols.length > 1)) {
      // 2D Grid multidimensional (ej. aside + header + content): DEBE ser NONE para preservar x, y absolutos
      mode = 'NONE';
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
    if (element.children.length >= 2) {
      mode = 'VERTICAL';
      itemSpacing = Math.round(parseFloat(style.gap) || 0);
    }
  }

  // ── Inferencia Geométrica Real basada en posición de hijos en el DOM ──
  // Si los hijos están uno al lado del otro en el mismo eje Y -> ES HORIZONTAL (ej. KPI cards, grids de Tailwind)
  // Si los hijos están uno debajo del otro y el CSS gap es 0 (porque usaron margin) -> descubrir itemSpacing real
  const visibleChildren = (Array.from(element.children) as any[]).filter(ch => {
    const cs = window.getComputedStyle(ch);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
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

    return {
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
      styles: { fills: [tc] },
      textData: {
        characters: rawText,
        fontSize: Math.round(fontSize),
        fontWeight: style.fontWeight || 400,
        fontFamily: cleanFontFamily,
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

  // Si es un badge o pill, NUNCA debe ser FILL y debe tener Auto Layout centrado
  if (isBadge) {
    initialWidth = 'HUG';
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
    measuredW < 250
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
      cornerRadius,
      opacity: parseFloat(style.opacity) || 1,
      boxShadow,
      backdropBlur,
    },
    children: [],
    clipsContent:
      isWholePage || CLIPPING_OVERFLOW.test(style.overflowX) || CLIPPING_OVERFLOW.test(style.overflowY)
        ? true
        : undefined,
  };
  if (pendingBgSrc) {
    node._pendingBgImageSrc = pendingBgSrc;
    node.styles.imageScaleMode = bgScaleMode(style);
    node._vpRect = vpRectOf(rect);
  }

  // ── 17. Form Elements: Inputs & Selects con Contenido Real ──
  if (element.children.length === 0) {
    let txt = (element.textContent || '').trim();
    if (style.textTransform === 'uppercase') txt = txt.toUpperCase();

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
      const leafBefore = pseudoHasImage(element, '::before')
        ? extractPseudoElement(element, '::before', rect, currentLayout, counter)
        : null;
      const leafAfter = pseudoHasImage(element, '::after')
        ? extractPseudoElement(element, '::after', rect, currentLayout, counter)
        : null;
      if (leafBefore || leafAfter) {
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
    const __kids = (function (el) {
      if (el.shadowRoot) return [...el.shadowRoot.childNodes];
      if (el.localName === 'slot') {
        const a = el.assignedNodes({ flatten: true });
        return a.length ? a : [...el.childNodes];
      }
      return [...el.childNodes];
    })(element);
    for (const child of __kids) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const cn = extractNodeTree(child, counter, rect, currentLayout);
        if (cn) node.children.push(cn);
      } else if (child.nodeType === Node.TEXT_NODE) {
        let raw = (child.textContent || '').trim();
        if (raw.length > 0) {
          if (style.textTransform === 'uppercase') raw = raw.toUpperCase();
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
              lineHeight: nodeLh,
              letterSpacing: nodeLs,
              textAlign: style.textAlign.includes('center')
                ? 'CENTER'
                : style.textAlign.includes('right')
                  ? 'RIGHT'
                  : 'LEFT',
              isMultiline: isNodeMulti,
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
    if (typeof node.layout.height === 'number' && node.layout.height <= 0) {
      let mb = 0;
      for (const ch of node.children) {
        const cy = ch.layout?.y || 0;
        const ch2 = typeof ch.layout?.height === 'number' ? ch.layout.height : 40;
        if (cy + ch2 > mb) mb = cy + ch2;
      }
      if (mb > 0) node.layout.height = mb;
    }
    if (typeof node.layout.width === 'number' && node.layout.width <= 0) {
      let mr = 0;
      for (const ch of node.children) {
        const cx = ch.layout?.x || 0;
        const cw = typeof ch.layout?.width === 'number' ? ch.layout.width : 40;
        if (cx + cw > mr) mr = cx + cw;
      }
      if (mr > 0) node.layout.width = mr;
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

  // ── 20.5 Ajustar el Auto Layout a la GEOMETRÍA real (principio de swarm-rebuild) ──
  // Padding, gap y alineación se deducían de palabras clave CSS; márgenes, place-items,
  // centrados por grid, etc. se perdían. Se recalculan con las posiciones medidas.
  fitAutoLayoutToGeometry(node);

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

  // ── 22. Perfeccionamiento de Componentes Críticos del Sidebar ──
  const elClass = typeof element.className === 'string' ? element.className : '';

  // 1. Header Workspace Text & Role
  if (elClass.includes('sidebar-workspace-text')) {
    node.layout.mode = 'VERTICAL';
    node.layout.counterAxisAlignItems = 'MIN';
    node.layout.itemSpacing = 4;
    node.layout.width = 169;
  }
  if (elClass.includes('sidebar-workspace-role')) {
    node.name = 'Badge / Polaris Cloud';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'CENTER';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.padding = { top: 2, right: 9, bottom: 2, left: 9 };
    node.layout.width = 'HUG';
    node.layout.height = 19;
    node.styles.cornerRadius = 999;
    node.styles.fills = [{ r: 1, g: 1, b: 1, a: 0.14 }];
    if (node.children && node.children.length > 0 && node.children[0].type === 'TEXT') {
      node.children[0].textData.characters = 'POLARIS CLOUD';
      node.children[0].textData.fontSize = 10;
      node.children[0].textData.fontWeight = 600;
      node.children[0].styles.fills = [{ r: 1, g: 0.918, b: 0.118, a: 1 }];
    }
  }

  // 2. Search Container & Search Trigger
  if (elClass.includes('sidebar-search') && tagName === 'div') {
    node.name = 'Sidebar / Search';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'CENTER';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.padding = { top: 0, right: 12, bottom: 6, left: 12 };
    node.layout.width = 'FILL';
    node.layout.height = 40;
    if (node.children && node.children.length > 0) {
      node.children[0].layout.width = 'FILL';
    }
  }
  if (elClass.includes('sidebar-search-trigger')) {
    node.name = 'Button / Search Trigger';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'SPACE_BETWEEN';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.padding = { top: 0, right: 8, bottom: 0, left: 10 };
    node.layout.width = 'FILL';
    node.layout.height = 34;
    node.styles.cornerRadius = 9;
  }

  // 3. Version Footer
  if (elClass.includes('sidebar-version')) {
    node.name = 'Sidebar / Version';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'CENTER';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.padding = { top: 0, right: 16, bottom: 0, left: 16 };
    node.layout.width = 'FILL';
    node.layout.height = 36;
    node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.12, width: 1, align: 'INSIDE' }];
    node.styles.borderSides = { top: 1, right: 0, bottom: 0, left: 0 };
    if (node.children && node.children.length > 0 && node.children[0].type === 'TEXT') {
      node.children[0].styles.fills = [{ r: 0.776, g: 0.816, b: 0.863, a: 1 }];
      node.children[0].textData.textAlign = 'CENTER';
    }
  }

  // 4. User Footer Row & Avatar & Logout
  if (elClass.includes('sidebar-user') && tagName === 'div') {
    node.name = 'Sidebar / User';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'SPACE_BETWEEN';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.padding = { top: 10, right: 12, bottom: 10, left: 12 };
    node.layout.width = 'FILL';
    node.layout.height = 63;
    node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.12, width: 1, align: 'INSIDE' }];
    node.styles.borderSides = { top: 1, right: 0, bottom: 0, left: 0 };
  }
  if (elClass.includes('sidebar-user-avatar')) {
    node.name = 'Avatar / P';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'CENTER';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.width = 30;
    node.layout.height = 30;
    node.styles.cornerRadius = 15;
    node.styles.fills = [{ r: 0, g: 0.129, b: 0.341, a: 1 }];
    node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.2, width: 1, align: 'INSIDE' }];
  }
  if (elClass.includes('sidebar-user-logout')) {
    node.name = 'Button / Logout';
    node.layout.mode = 'HORIZONTAL';
    node.layout.primaryAxisAlignItems = 'CENTER';
    node.layout.counterAxisAlignItems = 'CENTER';
    node.layout.width = 34;
    node.layout.height = 34;
    node.styles.cornerRadius = 10;
    node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.12, width: 1, align: 'INSIDE' }];
  }

  return node;
}
