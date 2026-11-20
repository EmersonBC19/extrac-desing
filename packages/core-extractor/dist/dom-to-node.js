/**
 * Función auxiliar para parsear colores CSS en Node.js
 */
export function parseCssColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'initial') {
        return null;
    }
    const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1], 10) / 255,
            g: parseInt(rgbaMatch[2], 10) / 255,
            b: parseInt(rgbaMatch[3], 10) / 255,
            a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
        };
    }
    const hexMatch = colorStr.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
        return {
            r: parseInt(hexMatch[1], 16) / 255,
            g: parseInt(hexMatch[2], 16) / 255,
            b: parseInt(hexMatch[3], 16) / 255,
            a: 1
        };
    }
    return null;
}
/**
 * Parsea box-shadow computado de CSS
 */
export function parseBoxShadow(shadowStr) {
    if (!shadowStr || shadowStr === 'none')
        return [];
    const shadows = [];
    const parts = shadowStr.split(/,(?![^(]*\))/);
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed)
            continue;
        const colorMatch = trimmed.match(/(rgba?\([^)]+\)|#[a-f0-9]+)/i);
        const color = colorMatch ? parseCssColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 0.15 };
        const cleanLength = trimmed.replace(/(rgba?\([^)]+\)|#[a-f0-9]+)/i, '').trim();
        const lengths = cleanLength.split(/\s+/).map(l => parseFloat(l) || 0);
        if (lengths.length >= 2 && color) {
            shadows.push({ color, offset: { x: lengths[0], y: lengths[1] }, radius: lengths[2] || 0, spread: lengths[3] || 0 });
        }
    }
    return shadows;
}
/**
 * Script serializable para inyectar en Chromium mediante page.evaluate().
 * Diseñado con precisión milimétrica para generar mockups nativos en Figma:
 * - Auto Layout automático en bloques, flex y grids
 * - Nomenclatura semántica profesional de capas y componentes
 * - Gradientes lineales nativos, sombras (box-shadow) y bordes direccionales
 * - Inputs, selects, botones y badges con fidelidad de diseño artesanal
 * - Eliminación de wrappers redundantes de frameworks (Angular, React, Vue)
 */
export const browserDomExtractorScript = `
function extractNodeTree(element, counter = { id: 0 }, parentRect = null, parentLayout = null) {
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
  const vpW = window.innerWidth || 1440;
  const vpH = window.innerHeight || 900;
  const isRoot = parentRect === null;
  const isWholePage = isRoot && (element === document.body || element === document.documentElement || tagName === 'body');

  // Descartar elementos colapsados
  const isZeroClipped = (rect.height <= 0.5) &&
    (style.overflow === 'hidden' || style.overflowY === 'hidden') &&
    (style.maxHeight === '0px' || style.height === '0px');
  if (isZeroClipped) return null;

  // Filtrado de elementos fuera de pantalla
  if (element.children.length === 0) {
    if (rect.width <= 0 && rect.height <= 0 && (!element.textContent || !element.textContent.trim())) return null;
    if (parentRect !== null && (rect.left >= vpW + 150 || rect.right <= -150)) return null;
    if (parentRect !== null && rect.top >= 4500) return null;
  } else {
    if (parentRect !== null && (rect.left >= vpW + 300 || rect.right < -400)) return null;
  }

  const currentId = 'node_' + (++counter.id);
  const relX = parentRect ? Math.round(rect.left - parentRect.left) : 0;
  const relY = parentRect ? Math.round(rect.top - parentRect.top) : 0;

  // ── Helper para dividir valores CSS respetando paréntesis ──
  function splitCssList(str) {
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
  let _sharedCanvas = null;
  let _sharedCtx = null;
  function parseColor(str, fallbackColor = null) {
    if (!str || str === 'transparent' || str === 'inherit' || str === 'initial') return null;
    str = str.trim();
    if (str.toLowerCase() === 'currentcolor') {
      return fallbackColor ? parseColor(fallbackColor) : null;
    }
    if (str.startsWith('rgb')) {
      const open = str.indexOf('(');
      const close = str.lastIndexOf(')');
      if (open > -1 && close > open) {
        const parts = str.slice(open + 1, close).split(/[, /]+/).map(s => s.trim()).filter(Boolean);
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
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      else if (h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
      if (h.length === 6) {
        return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: 1 };
      }
      if (h.length === 8) {
        return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: parseInt(h.slice(6,8),16)/255 };
      }
    }
    try {
      if (!_sharedCanvas) {
        _sharedCanvas = document.createElement('canvas');
        _sharedCanvas.width = 1; _sharedCanvas.height = 1;
        _sharedCtx = _sharedCanvas.getContext('2d', { willReadFrequently: true });
      }
      if (_sharedCtx) {
        _sharedCtx.clearRect(0, 0, 1, 1);
        _sharedCtx.fillStyle = str;
        _sharedCtx.fillRect(0, 0, 1, 1);
        const d = _sharedCtx.getImageData(0, 0, 1, 1).data;
        if (d[3] === 0) return null;
        return { r: d[0]/255, g: d[1]/255, b: d[2]/255, a: d[3]/255 };
      }
    } catch(_e){}
    return null;
  }

  // ── 2. Gradient Parser (Linear & Radial) ──
  function parseGradient(bgStr) {
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
        const posMatch = stopPart.replace(colorMatch[0], '').trim().match(/([\d.]+)%/);
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
      } else if (firstToken === 'to top') { angle = 0; stopsStr = inner.slice(firstComma + 1).trim(); }
      else if (firstToken === 'to right') { angle = 90; stopsStr = inner.slice(firstComma + 1).trim(); }
      else if (firstToken === 'to bottom') { angle = 180; stopsStr = inner.slice(firstComma + 1).trim(); }
      else if (firstToken === 'to left') { angle = 270; stopsStr = inner.slice(firstComma + 1).trim(); }
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
      const posMatch = stopPart.replace(colorMatch[0], '').trim().match(/([\d.]+)%/);
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
  function parseBoxShadow(shadowStr) {
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
          spread: lengths[3] || 0
        });
      }
    }
    return shadows;
  }

  // ── 3.5 Pseudo-element (::before / ::after) Extractor ──
  function extractPseudoElement(element, pseudo, parentRect, parentLayout, counter) {
    try {
      const style = window.getComputedStyle(element, pseudo);
      const content = style.content;
      const hasContent = content && content !== 'none' && content !== 'normal' && content !== '""' && content !== "''";
      const bg = parseColor(style.backgroundColor);
      const w = parseFloat(style.width) || 0;
      const h = parseFloat(style.height) || 0;

      if (!hasContent) {
        if (!bg || bg.a <= 0.05 || w <= 0 || h <= 0) return null;
      }

      let rawText = (content || '').replace(/^['"]|['"]$/g, '').trim();
      const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
      const isPosAbs = style.position === 'absolute' || style.position === 'fixed';
      const br = parseFloat(style.borderRadius) || 0;

      if (rawText.length > 0) {
        return {
          id: 'pseudo_' + (++counter.id),
          name: pseudo === '::before' ? 'Pseudo / Before' : 'Pseudo / After',
          type: 'TEXT',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: 'HUG',
            height: 'HUG',
            positioning: isPosAbs ? 'ABSOLUTE' : 'AUTO'
          },
          styles: { fills: [tc] },
          textData: {
            characters: rawText,
            fontSize: Math.round(parseFloat(style.fontSize) || 14),
            fontWeight: style.fontWeight || 400,
            fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter'
          }
        };
      } else if (w > 0 && h > 0 && bg && bg.a > 0.05) {
        return {
          id: 'pseudo_' + (++counter.id),
          name: pseudo === '::before' ? 'Decorator / Before' : 'Decorator / After',
          type: 'FRAME',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: Math.round(w),
            height: Math.round(h),
            positioning: isPosAbs ? 'ABSOLUTE' : 'AUTO'
          },
          styles: {
            fills: [bg],
            cornerRadius: br > 0 ? br : 0
          },
          children: []
        };
      }
    } catch (_e) {}
    return null;
  }

  // ── 4. Clasificador Semántico de Capas ──
  function getSemanticName(el, tag, st, r) {
    const customName = el.getAttribute('data-component-name') || el.getAttribute('data-testid');
    if (customName) return customName;

    // Detectar icono o SVG
    if (tag === 'svg') {
      const label = el.getAttribute('aria-label') || el.getAttribute('data-icon');
      if (label) return 'Icon / ' + label;
      const p = el.parentElement;
      if (p) {
        const pIcon = p.getAttribute('name') || p.getAttribute('icon') || p.getAttribute('data-icon') || p.getAttribute('fontIcon');
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
    const isBtn = tag === 'button' || el.getAttribute('role') === 'button' || (el.className && typeof el.className === 'string' && el.className.includes('btn'));
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
      const type = el.type || 'text';
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
    const childrenList = Array.from(el.children);
    const hasDirectLabel = childrenList.some(c => c.tagName.toLowerCase() === 'label');
    const hasDirectInput = childrenList.some(c => ['input', 'select', 'textarea'].includes(c.tagName.toLowerCase()) || c.querySelector('input, select, textarea'));
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
    const isCard = (el.className && typeof el.className === 'string' && el.className.includes('card')) || tag === 'article';
    if (isCard) return 'Card / Container';

    // Detectar Navigation / Sidebar / Header
    if (tag === 'nav' || el.getAttribute('role') === 'navigation') return 'Navigation / Bar';
    if (tag === 'aside' || (el.className && typeof el.className === 'string' && el.className.includes('sidebar'))) return 'Sidebar';
    if (tag === 'header' || (el.className && typeof el.className === 'string' && el.className.includes('header'))) return 'Header / Navbar';
    if (tag === 'form') return 'Form / Container';

    // Limpiar clases utilitarias de Tailwind / Angular para no usarlas de nombre
    const rawClass = typeof el.className === 'string' ? el.className.trim() : '';
    if (rawClass) {
      const cleanClasses = rawClass.split(/\\s+/).filter(c => {
        return !/^(mb-|mt-|ml-|mr-|p-|px-|py-|w-|h-|flex|grid|block|inline|relative|absolute|text-|bg-|border-|rounded-|ng-|mat-|cursor-|transition-|duration-|hover:|focus:)/.test(c);
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
    const ccHex = '#' + Math.round(cc.r*255).toString(16).padStart(2,'0') +
                        Math.round(cc.g*255).toString(16).padStart(2,'0') +
                        Math.round(cc.b*255).toString(16).padStart(2,'0');

    const svgCompStyle = window.getComputedStyle(element);
    const svgHasStroke = (svgCompStyle.stroke && svgCompStyle.stroke !== 'none') ||
                         element.getAttribute('stroke') !== null;

    const origVectors = element.querySelectorAll('path, circle, rect, polygon, line, ellipse');
    const cloneVectors = svgClone.querySelectorAll('path, circle, rect, polygon, line, ellipse');
    for (let vi = 0; vi < origVectors.length; vi++) {
      const ov = origVectors[vi];
      const cv = cloneVectors[vi];
      if (!cv) continue;
      const vs = window.getComputedStyle(ov);

      // Rectángulo de bounding box transparente/invisible (común en Lucide / Tabler: <path d="M0 0h24v24H0z" fill="none">)
      const dAttr = ov.getAttribute('d') || '';
      if (dAttr.includes('0 0h24v24H0z') || dAttr.includes('0 0h24v24') || (vs.fill === 'none' && vs.stroke === 'none')) {
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
            const fHex = '#' + Math.round(pf.r*255).toString(16).padStart(2,'0') +
                               Math.round(pf.g*255).toString(16).padStart(2,'0') +
                               Math.round(pf.b*255).toString(16).padStart(2,'0');
            cv.setAttribute('fill', fHex);
            if (pf.a < 1) cv.setAttribute('fill-opacity', String(pf.a));
          }
        } else {
          // Icono puramente sólido (ej. logo Banco Pichincha)
          const pf = parseColor(vFill, style.color) || cc;
          const fHex = '#' + Math.round(pf.r*255).toString(16).padStart(2,'0') +
                             Math.round(pf.g*255).toString(16).padStart(2,'0') +
                             Math.round(pf.b*255).toString(16).padStart(2,'0');
          cv.setAttribute('fill', fHex);
          if (pf.a < 1) cv.setAttribute('fill-opacity', String(pf.a));
        }
      } else {
        cv.setAttribute('fill', 'none');
      }

      if (hasStroke) {
        const strokeColorStr = (vStroke && vStroke !== 'none') ? vStroke : (svgCompStyle.stroke && svgCompStyle.stroke !== 'none' ? svgCompStyle.stroke : style.color);
        const ps = parseColor(strokeColorStr, style.color) || cc;
        const sHex = '#' + Math.round(ps.r*255).toString(16).padStart(2,'0') +
                           Math.round(ps.g*255).toString(16).padStart(2,'0') +
                           Math.round(ps.b*255).toString(16).padStart(2,'0');
        cv.setAttribute('stroke', sHex);
        if (ps.a < 1) cv.setAttribute('stroke-opacity', String(ps.a));
        cv.setAttribute('stroke-width', vs.strokeWidth && vs.strokeWidth !== '0px' ? vs.strokeWidth : (svgCompStyle.strokeWidth || '2'));
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
    if (!/viewBox/i.test(raw)) raw = raw.replace('<svg', '<svg viewBox="0 0 '+w+' '+h+'"');
    if (!/width=/i.test(raw)) raw = raw.replace('<svg', '<svg width="'+w+'"');
    if (!/height=/i.test(raw)) raw = raw.replace('<svg', '<svg height="'+h+'"');
    raw = raw.replace(/\\s+(ng-reflect-[a-z-]+|_ng[a-z]+-[a-z0-9-]+|data-mat-icon-[a-z]+|class)="[^"]*"/gi, '');

    return {
      id: currentId,
      name: getSemanticName(element, tagName, style, rect),
      type: 'SVG',
      layout: { mode: 'NONE', padding: {top:0,right:0,bottom:0,left:0}, itemSpacing: 0, width: w, height: h, x: relX, y: relY },
      styles: { fills: [] },
      svgContent: raw
    };
  }

  // ── 6. Canvas ──
  if (tagName === 'canvas') {
    try {
      const cd = element.toDataURL('image/png');
      if (cd) return {
        id: currentId, name: 'Chart / Canvas', type: 'FRAME',
        layout: { mode: 'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width: Math.round(rect.width)||300, height: Math.round(rect.height)||150, x: relX, y: relY },
        styles: { fills: [] }, imageData: cd, children: []
      };
    } catch(_e){}
  }

  // ── 7. IMG ──
  if (tagName === 'img') {
    try {
      if (element.complete && element.naturalWidth > 0) {
        const c = document.createElement('canvas');
        c.width = Math.min(element.naturalWidth, 400);
        c.height = Math.min(element.naturalHeight, 400);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(element, 0, 0, c.width, c.height);
          const d = c.toDataURL('image/png');
          return {
            id: currentId, name: 'Image / ' + (element.getAttribute('alt') || 'Img'), type: 'FRAME',
            layout: { mode: 'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width: Math.round(rect.width)||40, height: Math.round(rect.height)||40, x: relX, y: relY },
            styles: { fills: [], cornerRadius: parseFloat(style.borderRadius)||0 }, imageData: d, children: []
          };
        }
      }
    } catch(_e){}
  }

  // ── 8. Fills & Gradients ──
  const fills = [];
  const grad = parseGradient(style.backgroundImage);
  if (grad) {
    fills.push(grad);
  } else {
    const bgColor = parseColor(style.backgroundColor);
    if (bgColor && bgColor.a > 0.01) {
      fills.push(bgColor);
    }
  }

  // ── 9. Strokes & Borders en Cualquier Lado ──
  const topW = Math.round(parseFloat(style.borderTopWidth)||0);
  const rightBW = Math.round(parseFloat(style.borderRightWidth)||0);
  const bottomW = Math.round(parseFloat(style.borderBottomWidth)||0);
  const leftBW = Math.round(parseFloat(style.borderLeftWidth)||0);
  const hasBorder = (topW > 0 && style.borderTopStyle !== 'none') ||
                    (rightBW > 0 && style.borderRightStyle !== 'none') ||
                    (bottomW > 0 && style.borderBottomStyle !== 'none') ||
                    (leftBW > 0 && style.borderLeftStyle !== 'none');

  const strokeColor = parseColor(style.borderTopColor, style.color) ||
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
  const rtl = parseFloat(style.borderTopLeftRadius)||0;
  const rtr = parseFloat(style.borderTopRightRadius)||0;
  const rbr = parseFloat(style.borderBottomRightRadius)||0;
  const rbl = parseFloat(style.borderBottomLeftRadius)||0;
  const cornerRadius = (rtl===rtr && rtr===rbr && rbr===rbl) ? rtl : [rtl, rtr, rbr, rbl];

  // ── 11. Box Shadows & Glassmorphism Backdrop Blur ──
  const boxShadow = parseBoxShadow(style.boxShadow);
  let backdropBlur = undefined;
  const bFilter = style.backdropFilter || style.webkitBackdropFilter || '';
  if (bFilter && bFilter.includes('blur(')) {
    const m = bFilter.match(/blur\(([^)]+)\)/);
    if (m && m[1]) {
      const v = parseFloat(m[1]);
      if (!isNaN(v) && v > 0) backdropBlur = Math.round(v);
    }
  }

  // ── 12. Padding ──
  const padding = {
    top: Math.round(parseFloat(style.paddingTop)||0),
    right: Math.round(parseFloat(style.paddingRight)||0),
    bottom: Math.round(parseFloat(style.paddingBottom)||0),
    left: Math.round(parseFloat(style.paddingLeft)||0)
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
  } else if (tagName === 'button' || element.getAttribute('role') === 'button' || (element.className && typeof element.className === 'string' && element.className.includes('btn'))) {
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
  } else if (style.display === 'block' || style.display === 'flow-root' || ['form', 'section', 'article', 'fieldset'].includes(tagName)) {
    if (element.children.length >= 2) {
      mode = 'VERTICAL';
      itemSpacing = Math.round(parseFloat(style.gap) || 0);
    }
  }

  // ── Inferencia Geométrica Real basada en posición de hijos en el DOM ──
  // Si los hijos están uno al lado del otro en el mismo eje Y -> ES HORIZONTAL (ej. KPI cards, grids de Tailwind)
  // Si los hijos están uno debajo del otro y el CSS gap es 0 (porque usaron margin) -> descubrir itemSpacing real
  const visibleChildren = Array.from(element.children).filter(ch => {
    const cs = window.getComputedStyle(ch);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
  });

  if (visibleChildren.length >= 2 && !isWholePage) {
    const r0 = visibleChildren[0].getBoundingClientRect();
    const r1 = visibleChildren[1].getBoundingClientRect();
    const isHorizAligned = Math.abs(r0.top - r1.top) <= 12 && r1.left > (r0.left + 5);
    const isVertAligned = Math.abs(r0.left - r1.left) <= 12 && r1.top > (r0.top + 5);

    if (style.display.includes('grid')) {
      if (isHorizAligned) {
        mode = 'HORIZONTAL';
        layoutWrap = 'NO_WRAP';
        const measuredGap = Math.round(r1.left - (r0.left + r0.width));
        if (measuredGap >= 0 && measuredGap < 100) itemSpacing = measuredGap;
      } else if (isVertAligned) {
        mode = 'VERTICAL';
        const measuredGap = Math.round(r1.top - (r0.top + r0.height));
        if (measuredGap >= 0 && measuredGap < 100) itemSpacing = measuredGap;
      }
    } else if (mode === 'VERTICAL' && isVertAligned) {
      const dy = Math.round(r1.top - (r0.top + r0.height));
      if (dy > 0 && dy < 60 && (itemSpacing === 0 || dy > itemSpacing)) itemSpacing = dy;
    } else if (mode === 'HORIZONTAL' && isHorizAligned) {
      const dx = Math.round(r1.left - (r0.left + r0.width));
      if (dx > 0 && dx < 60 && (itemSpacing === 0 || dx > itemSpacing)) itemSpacing = dx;
    }
  }

  // Shells de aplicación y pantallas completas: SIEMPRE modo NONE para que el menú quede a la izquierda en x=0
  const cName = (typeof element.className === 'string' ? element.className : '').toLowerCase();
  const idAttr = (typeof element.id === 'string' ? element.id : '').toLowerCase();
  const isSearchContainer = cName.includes('search') || idAttr.includes('search');
  const isLayoutShell = isWholePage ||
    (['body', 'app-root', 'router-outlet'].includes(tagName) && isRoot);

  if (isLayoutShell) {
    mode = 'NONE';
  }

  // ── 14. Nombre Semántico ──
  const semanticName = getSemanticName(element, tagName, style, rect);

  // ── 15. Texto Terminal Puro ──
  const isDirectText = element.children.length === 0 && element.textContent && element.textContent.trim().length > 0;
  if (isDirectText && !fills.length && !strokes.length && padding.top === 0 && padding.bottom === 0 && tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
    const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
    let rawText = element.textContent.trim();
    if (style.textTransform === 'uppercase') rawText = rawText.toUpperCase();
    else if (style.textTransform === 'lowercase') rawText = rawText.toLowerCase();

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
    const isMultiline = measuredH > (effLineHeight * 1.35) || rawText.includes('\n');

    // Letter-spacing con precisión decimal (ej. 0.231px o -0.374px)
    let parsedLetterSpacing = undefined;
    if (style.letterSpacing && style.letterSpacing !== 'normal') {
      const lsVal = parseFloat(style.letterSpacing);
      if (!isNaN(lsVal) && Math.abs(lsVal) > 0.005) {
        parsedLetterSpacing = Math.round(lsVal * 1000) / 1000;
      }
    }

    // Determinar dimensionamiento inteligente (FILL vs HUG vs FIXED):
    let textWidth = 'HUG';
    const isBlockTag = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'div', 'section', 'article'].includes(tagName);
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
        height: isMultiline ? 'HUG' : (measuredH > 0 ? measuredH : 'HUG'),
        measuredWidth: measuredW,
        measuredHeight: measuredH,
        x: relX,
        y: relY
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
        isMultiline
      }
    };
  }

  // ── 16. Dimensiones y Sizing (FILL vs HUG vs FIXED) ──
  const measuredW = Math.round(rect.width);
  const measuredH = Math.round(rect.height);

  let initialWidth;
  let initialHeight;

  if (isWholePage) {
    initialWidth = vpW || 1440;
    initialHeight = vpH || 900;
  } else if (isRoot) {
    initialWidth = measuredW > 0 ? measuredW : 'HUG';
    initialHeight = (mode !== 'NONE' && element.children.length > 0) ? 'HUG' : (measuredH > 0 ? measuredH : 'HUG');
  } else {
    initialWidth = measuredW;
    initialHeight = measuredH > 0 ? measuredH : 'HUG';
  }

  // Detección de Badges / Pills / Tags compactos
  const isBadge = (typeof element.className === 'string' && (element.className.includes('badge') || element.className.includes('pill') || element.className.includes('role') || element.className.includes('tag'))) ||
                  (parseFloat(style.borderRadius) >= 12 && measuredH <= 32 && measuredW < 200);

  // Si está dentro de Auto Layout Vertical del padre y ocupa el ancho del contenido del padre -> FILL
  if (parentLayout && parentLayout.mode === 'VERTICAL' && parentRect) {
    const parentContentW = parentRect.width - (parentLayout.padding?.left || 0) - (parentLayout.padding?.right || 0);
    if (!isBadge && (Math.abs(measuredW - parentContentW) <= 8 || style.width === '100%' || (style.display === 'block' && Math.abs(measuredW - parentContentW) <= 16))) {
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
  const isSearchOrFullWidth = initialWidth === 'FILL' ||
                              (parentRect && Math.abs(measuredW - (parentRect.width - (parentLayout?.padding?.left || 0) - (parentLayout?.padding?.right || 0))) <= 8) ||
                              (typeof element.className === 'string' && element.className.includes('search'));

  if ((tagName === 'button' || semanticName.startsWith('Button') || semanticName.startsWith('Badge') || isBadge) && !isSearchOrFullWidth && !style.width?.includes('%') && measuredW < 250) {
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
    mode, primaryAxisAlignItems: primaryAlign, counterAxisAlignItems: counterAlign,
    padding, itemSpacing, width: initialWidth, height: initialHeight,
    measuredWidth: Math.round(rect.width),
    measuredHeight: Math.round(rect.height),
    positioning: (style.position === 'absolute' || style.position === 'fixed') ? 'ABSOLUTE' : 'AUTO',
    layoutWrap, x: relX, y: relY
  };

  const node = {
    id: currentId,
    name: semanticName,
    type: 'FRAME',
    layout: currentLayout,
    styles: { fills, strokes, borderSides, cornerRadius, opacity: parseFloat(style.opacity)||1, boxShadow, backdropBlur },
    children: [],
    clipsContent: isWholePage || style.overflow === 'hidden' ? true : undefined
  };

  // ── 17. Form Elements: Inputs & Selects con Contenido Real ──
  if (element.children.length === 0) {
    let txt = (element.textContent||'').trim();
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
        : (parseColor(style.color) || { r: 0.15, g: 0.2, b: 0.25, a: 1 });

      node.children.push({
        id: currentId+'_val',
        name: isPlaceholder ? 'Placeholder / ' + val : 'Value / ' + val.slice(0, 15),
        type: 'TEXT',
        layout: { mode: 'NONE', padding: {top:0,right:0,bottom:0,left:0}, itemSpacing:0, width: 'HUG', height: 'HUG', x: padding.left || 12, y: 0 },
        styles: { fills: [tc] },
        textData: {
          characters: val,
          fontSize: Math.round(parseFloat(style.fontSize)||14),
          fontWeight: 400,
          fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter'
        }
      });
    } else if (tagName === 'select') {
      const selTxt = (element.options && element.selectedIndex>=0 && element.options[element.selectedIndex]) ? element.options[element.selectedIndex].text.trim() : 'Seleccionar...';
      const tc = parseColor(style.color) || { r: 0.2, g: 0.25, b: 0.3, a: 1 };
      node.children.push({
        id: currentId+'_sel',
        name: 'Selected / ' + selTxt,
        type: 'TEXT',
        layout: { mode: 'NONE', padding: {top:0,right:0,bottom:0,left:0}, itemSpacing:0, width: 'FILL', height: 'HUG', x: padding.left || 12, y: 0 },
        styles: { fills: [tc] },
        textData: { characters: selTxt, fontSize: Math.round(parseFloat(style.fontSize)||14), fontWeight: 400, fontFamily: 'Inter' }
      });
      // Icono Chevron Down
      node.children.push({
        id: currentId+'_chevron',
        name: 'Icon / ChevronDown',
        type: 'SVG',
        layout: { mode: 'NONE', padding: {top:0,right:0,bottom:0,left:0}, itemSpacing:0, width: 16, height: 16, x: 0, y: 0 },
        styles: { fills: [] },
        svgContent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'
      });
    } else if (txt.length > 0) {
      const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };

      // Asegurar Auto Layout en frames contenedores de texto (badges, pills, botones, versión)
      if (node.layout.mode === 'NONE' && (padding.top > 0 || padding.left > 0 || fills.length > 0 || strokes.length > 0 || isBadge || style.textAlign.includes('center'))) {
        node.layout.mode = 'HORIZONTAL';
        node.layout.counterAxisAlignItems = 'CENTER';
        if (style.textAlign.includes('center') || isBadge) {
          node.layout.primaryAxisAlignItems = 'CENTER';
        }
      }

      let textAlignment = 'LEFT';
      if (style.textAlign.includes('center')) textAlignment = 'CENTER';
      else if (style.textAlign.includes('right')) textAlignment = 'RIGHT';

      node.children.push({
        id: currentId+'_text',
        name: isBadge ? 'Badge / ' + txt : 'Label',
        type: 'TEXT',
        layout: { mode: 'NONE', padding: {top:0,right:0,bottom:0,left:0}, itemSpacing:0, width: 'HUG', height: 'HUG', x: 0, y: 0 },
        styles: { fills: [tc] },
        textData: {
          characters: txt,
          fontSize: Math.round(parseFloat(style.fontSize)||14),
          fontWeight: style.fontWeight || 500,
          fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter',
          textAlign: textAlignment
        }
      });
    }
  } else {
    // ── 17.5 Pseudo-elemento ::before ──
    const beforeNode = extractPseudoElement(element, '::before', rect, currentLayout, counter);
    if (beforeNode) node.children.push(beforeNode);

    // ── 18. Hijos Recursivos ──
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const cn = extractNodeTree(child, counter, rect, currentLayout);
        if (cn) node.children.push(cn);
      } else if (child.nodeType === Node.TEXT_NODE) {
        let raw = (child.textContent||'').trim();
        if (raw.length > 0) {
          if (style.textTransform === 'uppercase') raw = raw.toUpperCase();
          const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
          let tx = 0, ty = 0;
          let tw = 0, th = 0;
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
          } catch(_e){}

          const nodeFontSize = parseFloat(style.fontSize) || 14;
          let nodeLh = undefined;
          if (style.lineHeight && style.lineHeight !== 'normal') {
            const lhV = parseFloat(style.lineHeight);
            if (!isNaN(lhV)) nodeLh = style.lineHeight.endsWith('px') ? Math.round(lhV) : Math.round(lhV * nodeFontSize);
          }
          const effLh = nodeLh || Math.round(nodeFontSize * 1.3);
          const isNodeMulti = th > (effLh * 1.35) || raw.includes('\n');

          let nodeLs = undefined;
          if (style.letterSpacing && style.letterSpacing !== 'normal') {
            const lsV = parseFloat(style.letterSpacing);
            if (!isNaN(lsV) && Math.abs(lsV) > 0.005) nodeLs = Math.round(lsV * 1000) / 1000;
          }

          let childWidth = 'HUG';
          if (currentLayout && currentLayout.mode === 'VERTICAL') {
            if (isNodeMulti || (rect.width > 0 && Math.abs(tw - rect.width) <= 24)) {
              childWidth = 'FILL';
            }
          } else if (isNodeMulti && tw > 0) {
            childWidth = tw;
          }

          node.children.push({
            id: currentId+'_txt_'+(++counter.id),
            name: 'Text / ' + raw.slice(0, 15),
            type: 'TEXT',
            layout: {
              mode: 'NONE',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: childWidth,
              height: isNodeMulti ? 'HUG' : (th > 0 ? th : 'HUG'),
              measuredWidth: tw,
              measuredHeight: th,
              x: tx,
              y: ty
            },
            styles: { fills: [tc] },
            textData: {
              characters: raw,
              fontSize: Math.round(nodeFontSize),
              fontWeight: style.fontWeight || 400,
              fontFamily: style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter',
              lineHeight: nodeLh,
              letterSpacing: nodeLs,
              textAlign: style.textAlign.includes('center') ? 'CENTER' : (style.textAlign.includes('right') ? 'RIGHT' : 'LEFT'),
              isMultiline: isNodeMulti
            }
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
    if (mode === 'HORIZONTAL') {
      node.children.sort((a, b) => (a.layout?.x || 0) - (b.layout?.x || 0));
      // Si el último hijo está empujado hacia la derecha (ej. chevron o botón de acción o shortcut CTRL K), el elemento central debe ser FILL
      if (node.children.length === 3) {
        const c1 = node.children[1];
        const c2 = node.children[2];
        const pW = typeof node.layout.width === 'number' ? node.layout.width : (node.layout.measuredWidth || 200);
        const c2W = typeof c2.layout?.width === 'number' ? c2.layout.width : (c2.layout?.measuredWidth || 20);
        const c2Right = (c2.layout?.x || 0) + c2W;
        if ((c2.layout?.x || 0) > pW - 60 || c2Right >= pW - 35) {
          c1.layout.width = 'FILL';
        }
      }
    } else if (mode === 'VERTICAL') {
      node.children.sort((a, b) => (a.layout?.y || 0) - (b.layout?.y || 0));
    }
  }

  // ── 21. Flattening de Wrappers Transparentes de Frameworks (Angular/React) ──
  const isFrameworkWrapper = (!isSearchContainer) && (
    ['app-root', 'router-outlet', 'app-login', 'ng-component', 'ng-container'].includes(tagName) ||
    (tagName.startsWith('app-') && fills.length === 0 && strokes.length === 0 && padding.top === 0 && padding.left === 0 && boxShadow.length === 0) ||
    (tagName === 'div' && fills.length === 0 && strokes.length === 0 && padding.top === 0 && padding.left === 0 && boxShadow.length === 0 && node.children.length === 1 && node.children[0].type !== 'TEXT')
  );

  if (!isRoot && isFrameworkWrapper && node.children.length === 1) {
    const singleChild = node.children[0];
    if (singleChild.layout) {
      singleChild.layout.x = (singleChild.layout.x || 0) + (node.layout?.x || 0);
      singleChild.layout.y = (singleChild.layout.y || 0) + (node.layout?.y || 0);
    }
    if ((singleChild.name === 'DIV' || singleChild.name.startsWith('Frame')) && node.name && !node.name.startsWith('Frame')) {
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

// ── 21. Extractor Automático de Design Tokens (CSS Variables) ──
function extractDesignTokens() {
  const colors = {};
  const radii = {};

  function parseTokenColor(str) {
    if (!str || str === 'transparent' || str === 'inherit' || str === 'initial') return null;
    str = str.trim();
    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        };
      }
    }
    if (str.startsWith('rgb')) {
      const nums = str.match(/[\d.]+/g);
      if (nums && nums.length >= 3) {
        return {
          r: parseFloat(nums[0]) / 255,
          g: parseFloat(nums[1]) / 255,
          b: parseFloat(nums[2]) / 255,
          a: nums[3] !== undefined ? parseFloat(nums[3]) : 1
        };
      }
    }
    return null;
  }

  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.selectorText && (rule.selectorText === ':root' || rule.selectorText === 'html' || rule.selectorText === 'body' || rule.selectorText.includes(':root'))) {
            const st = rule.style;
            for (let i = 0; i < st.length; i++) {
              const prop = st[i];
              if (prop && prop.startsWith('--')) {
                const val = st.getPropertyValue(prop).trim();
                if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl')) {
                  const parsed = parseTokenColor(val);
                  if (parsed) colors[prop] = parsed;
                } else if (val.endsWith('px') && prop.toLowerCase().includes('radius')) {
                  const r = parseFloat(val);
                  if (!isNaN(r)) radii[prop] = r;
                }
              }
            }
          }
        }
      } catch (_sheetErr) {}
    }
  } catch (_e) {}

  return { colors, radii };
}
`;
//# sourceMappingURL=dom-to-node.js.map