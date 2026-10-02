import type {
  UINode,
  RGBAColor,
  BoxShadow,
  StrokeStyle,
  BorderSides,
  LayoutMode,
  PrimaryAxisAlign,
  CounterAxisAlign
} from '@code-to-figma/contracts';

/**
 * Función que corre en el contexto de Chromium para parsear colores CSS
 */
export function parseCssColor(colorStr: string): RGBAColor | null {
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
export function parseBoxShadow(shadowStr: string): BoxShadow[] {
  if (!shadowStr || shadowStr === 'none') return [];
  const shadows: BoxShadow[] = [];
  const parts = shadowStr.split(/,(?![^(]*\))/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
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
 * Script serializable para inyectar en Chromium mediante page.evaluate()
 * CORREGIDO: altura fija al viewport, clipping de hijos, parseColor robusto
 */
export const browserDomExtractorScript = `
function extractNodeTree(element, counter = { id: 0 }, parentRect = null) {
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

  // 1. Descartar elementos colapsados (acordeones cerrados con max-height:0 o height:0)
  const isZeroClipped = (rect.height <= 0.5) &&
    (style.overflow === 'hidden' || style.overflowY === 'hidden') &&
    (style.maxHeight === '0px' || style.height === '0px');
  if (isZeroClipped) return null;

  // Filtrado de elementos fuera de pantalla
  if (element.children.length === 0) {
    if (rect.width <= 0 && rect.height <= 0 && (!element.textContent || !element.textContent.trim())) return null;
    if (parentRect !== null && (rect.left >= vpW + 100 || rect.right <= -100)) return null;
    // Ignorar hojas que estén excesivamente abajo
    if (parentRect !== null && rect.top >= 3500) return null;
  } else {
    // Para contenedores con hijos: NUNCA descartar por rect.width <= 0 o rect.height <= 0
    // (en Angular y HTML5, elementos personalizados como <app-users> tienen display:inline con rect 0x0)
    if (parentRect !== null && rect.right < -400) return null;
  }

  const currentId = 'node_' + (++counter.id);
  const relX = parentRect ? Math.round(rect.left - parentRect.left) : 0;
  const relY = parentRect ? Math.round(rect.top - parentRect.top) : 0;

  // ── parseColor robusto: rgb/rgba (espacio o coma), hex (3,4,6,8), fallback con canvas GPU compartido ──
  let _sharedCanvas = null;
  let _sharedCtx = null;
  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'inherit' || str === 'initial' || str === 'currentcolor') return null;
    str = str.trim();
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

  // ── 1. SVG (con inlining de colores exactos computados por vector) ──
  if (tagName === 'svg') {
    const svgClone = element.cloneNode(true);
    const cc = parseColor(style.color) || { r: 0.2, g: 0.25, b: 0.35, a: 1 };
    const ccHex = '#' + Math.round(cc.r*255).toString(16).padStart(2,'0') +
                        Math.round(cc.g*255).toString(16).padStart(2,'0') +
                        Math.round(cc.b*255).toString(16).padStart(2,'0');

    // Hornear estilos CSS computados en cada vector hijo para que Figma los lea como vectores nativos
    const origVectors = element.querySelectorAll('path, circle, rect, polygon, line, ellipse');
    const cloneVectors = svgClone.querySelectorAll('path, circle, rect, polygon, line, ellipse');
    for (let vi = 0; vi < origVectors.length; vi++) {
      const ov = origVectors[vi];
      const cv = cloneVectors[vi];
      if (!cv) continue;
      const vs = window.getComputedStyle(ov);

      // Fill computado
      const vFill = vs.fill;
      if (vFill && vFill !== 'none') {
        const pf = parseColor(vFill) || cc;
        const fHex = '#' + Math.round(pf.r*255).toString(16).padStart(2,'0') +
                           Math.round(pf.g*255).toString(16).padStart(2,'0') +
                           Math.round(pf.b*255).toString(16).padStart(2,'0');
        cv.setAttribute('fill', fHex);
        if (pf.a < 1) cv.setAttribute('fill-opacity', String(pf.a));
      } else if (!cv.getAttribute('fill') && !cv.getAttribute('stroke')) {
        cv.setAttribute('fill', ccHex);
      }

      // Stroke computado
      const vStroke = vs.stroke;
      if (vStroke && vStroke !== 'none') {
        const ps = parseColor(vStroke) || cc;
        const sHex = '#' + Math.round(ps.r*255).toString(16).padStart(2,'0') +
                           Math.round(ps.g*255).toString(16).padStart(2,'0') +
                           Math.round(ps.b*255).toString(16).padStart(2,'0');
        cv.setAttribute('stroke', sHex);
        if (ps.a < 1) cv.setAttribute('stroke-opacity', String(ps.a));
        cv.setAttribute('stroke-width', vs.strokeWidth || '1.5');
      }
    }

    let raw = svgClone.outerHTML;
    raw = raw.replace(/currentColor/gi, ccHex);
    const w = Math.max(1, Math.round(rect.width) || 24);
    const h = Math.max(1, Math.round(rect.height) || 24);
    if (!/viewBox/i.test(raw)) raw = raw.replace('<svg', '<svg viewBox="0 0 '+w+' '+h+'"');
    if (!/width=/i.test(raw)) raw = raw.replace('<svg', '<svg width="'+w+'"');
    if (!/height=/i.test(raw)) raw = raw.replace('<svg', '<svg height="'+h+'"');
    raw = raw.replace(/\\s+(ng-reflect-[a-z-]+|_ng[a-z]+-[a-z0-9-]+|data-mat-icon-[a-z]+|class)="[^"]*"/gi, '');

    return {
      id: currentId,
      name: 'Icon / ' + (element.getAttribute('aria-label') || element.getAttribute('data-icon') || element.getAttribute('fontIcon') || 'Svg'),
      type: 'SVG',
      layout: { mode: 'NONE', padding: {top:0,right:0,bottom:0,left:0}, itemSpacing: 0, width: w, height: h, x: relX, y: relY },
      styles: { fills: [] },
      svgContent: raw
    };
  }

  // ── 2. Canvas (Charts) ──
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

  // ── 3. IMG ──
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

  // ── 4. Checkbox / Radio ──
  if (tagName === 'input' && (element.type === 'checkbox' || element.type === 'radio')) {
    const checked = element.checked;
    const radio = element.type === 'radio';
    const sz = Math.max(16, Math.round(rect.width)||16);
    const brand = { r:0.23, g:0.51, b:0.96, a:1 };
    const node = {
      id: currentId, name: (radio?'Radio':'Checkbox')+(checked?' / On':' / Off'), type: 'FRAME',
      layout: { mode:'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width:sz, height:sz, x:relX, y:relY },
      styles: { fills: checked ? [brand] : [{r:1,g:1,b:1,a:1}], strokes: [{...(checked?brand:{r:0.75,g:0.78,b:0.82,a:1}), width:1.5, align:'INSIDE'}], cornerRadius: radio ? sz/2 : 3 },
      children: []
    };
    return node;
  }

  // ── 5. Fills ──
  const fills = [];
  const bgColor = parseColor(style.backgroundColor);
  if (bgColor && bgColor.a > 0.01) {
    fills.push(bgColor);
  } else if (style.backgroundImage && style.backgroundImage.includes('gradient')) {
    const gm = style.backgroundImage.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/gi);
    if (gm && gm.length > 0) { const gc = parseColor(gm[0]); if (gc) fills.push(gc); }
  }

  // ── 6. Strokes ──
  const topW = Math.round(parseFloat(style.borderTopWidth)||0);
  const rightBW = Math.round(parseFloat(style.borderRightWidth)||0);
  const bottomW = Math.round(parseFloat(style.borderBottomWidth)||0);
  const leftBW = Math.round(parseFloat(style.borderLeftWidth)||0);
  const strokeColor = parseColor(style.borderTopColor) || parseColor(style.borderBottomColor);
  const strokes = [];
  let borderSides = undefined;
  const maxBW = Math.max(topW, rightBW, bottomW, leftBW);
  if (maxBW > 0 && strokeColor && strokeColor.a > 0.01 && style.borderTopStyle !== 'none') {
    strokes.push({ ...strokeColor, width: maxBW, align: 'INSIDE' });
    if (topW !== rightBW || topW !== bottomW || topW !== leftBW) {
      borderSides = { top: topW, right: rightBW, bottom: bottomW, left: leftBW };
    }
  }

  // ── 7. Corner Radius ──
  const rtl = parseFloat(style.borderTopLeftRadius)||0;
  const rtr = parseFloat(style.borderTopRightRadius)||0;
  const rbr = parseFloat(style.borderBottomRightRadius)||0;
  const rbl = parseFloat(style.borderBottomLeftRadius)||0;
  const cornerRadius = (rtl===rtr && rtr===rbr && rbr===rbl) ? rtl : [rtl, rtr, rbr, rbl];

  // ── 8. Padding ──
  const padding = {
    top: Math.round(parseFloat(style.paddingTop)||0),
    right: Math.round(parseFloat(style.paddingRight)||0),
    bottom: Math.round(parseFloat(style.paddingBottom)||0),
    left: Math.round(parseFloat(style.paddingLeft)||0)
  };

  // ── 9. Layout ──
  let mode = 'NONE';
  let itemSpacing = 0;
  let primaryAlign = 'MIN';
  let counterAlign = 'MIN';
  if (style.display.includes('flex')) {
    mode = style.flexDirection.includes('column') ? 'VERTICAL' : 'HORIZONTAL';
    itemSpacing = Math.round(parseFloat(style.gap || style.rowGap || style.columnGap)||0);
    const jc = style.justifyContent;
    if (jc.includes('center')) primaryAlign = 'CENTER';
    else if (jc.includes('space-between')) primaryAlign = 'SPACE_BETWEEN';
    else if (jc.includes('end')) primaryAlign = 'MAX';
    const ai = style.alignItems;
    if (ai.includes('center')) counterAlign = 'CENTER';
    else if (ai.includes('end')) counterAlign = 'MAX';
  } else if (tagName === 'tr' || style.display === 'table-row') {
    mode = 'HORIZONTAL'; itemSpacing = 4; counterAlign = 'CENTER';
  } else if (['tbody','table','thead','tfoot'].includes(tagName) || style.display.includes('table')) {
    mode = 'VERTICAL';
  }

  // ── 10. Nombre ──
  const componentName = element.getAttribute('data-component-name') ||
    element.getAttribute('data-testid') ||
    (element.className && typeof element.className === 'string' ? element.className.split(' ')[0] : null) ||
    tagName;

  // ── 11. Texto terminal puro ──
  const isDirectText = element.children.length === 0 && element.textContent && element.textContent.trim().length > 0;
  if (isDirectText && !fills.length && !strokes.length && padding.top === 0 && padding.bottom === 0 && tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
    const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
    return {
      id: currentId, name: 'Text / ' + (componentName||'Span'), type: 'TEXT',
      layout: { mode: 'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width:'HUG', height:'HUG', x: relX, y: relY },
      styles: { fills: [tc] },
      textData: {
        characters: element.textContent.trim(),
        fontSize: Math.round(parseFloat(style.fontSize)||14),
        fontWeight: style.fontWeight || 400,
        fontFamily: style.fontFamily || 'Inter',
        lineHeight: parseFloat(style.lineHeight) ? Math.round(parseFloat(style.lineHeight)) : undefined
      }
    };
  }

  // ── 12. Frame raíz: FIJAR al viewport, NO al scrollHeight ──
  const isRoot = parentRect === null;
  const rootW = isRoot ? (vpW || 1440) : null;
  const rootH = isRoot ? (vpH || 900) : null;

  const measuredW = Math.round(rect.width);
  const measuredH = Math.round(rect.height);
  const initialWidth = isRoot ? rootW : (measuredW > 0 ? measuredW : 'HUG');
  const initialHeight = isRoot ? rootH : (measuredH > 0 ? measuredH : 'HUG');

  if (isRoot && fills.length === 0) {
    const htmlBg = parseColor(window.getComputedStyle(document.documentElement).backgroundColor);
    fills.push(htmlBg && htmlBg.a > 0 ? htmlBg : { r: 0.98, g: 0.98, b: 0.99, a: 1 });
  }

  const node = {
    id: currentId,
    name: componentName.charAt(0).toUpperCase() + componentName.slice(1),
    type: 'FRAME',
    layout: {
      mode, primaryAxisAlignItems: primaryAlign, counterAxisAlignItems: counterAlign,
      padding, itemSpacing, width: initialWidth, height: initialHeight,
      positioning: (style.position === 'absolute' || style.position === 'fixed') ? 'ABSOLUTE' : 'AUTO',
      x: relX, y: relY
    },
    styles: { fills, strokes, borderSides, cornerRadius, opacity: parseFloat(style.opacity)||1 },
    children: [],
    clipsContent: isRoot ? true : undefined
  };

  // ── 13. Hijos ──
  if (element.children.length === 0) {
    const txt = (element.textContent||'').trim();
    if (txt.length > 0) {
      const tc = parseColor(style.color) || { r:0.1, g:0.1, b:0.1, a:1 };
      node.children.push({
        id: currentId+'_text', name: 'Label', type: 'TEXT',
        layout: { mode:'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width:'HUG', height:'HUG', x:0, y:0 },
        styles: { fills: [tc] },
        textData: { characters: txt, fontSize: Math.round(parseFloat(style.fontSize)||14), fontWeight: style.fontWeight||500, fontFamily: style.fontFamily||'Inter' }
      });
    } else if (tagName === 'input' || tagName === 'textarea') {
      const val = (element.type==='password' && element.value) ? '••••••••' : (element.value || element.placeholder || '').trim();
      if (val.length > 0) {
        const tc = parseColor(style.color) || { r:0.3,g:0.3,b:0.3,a:1 };
        node.children.push({
          id: currentId+'_input', name: 'Value / '+val.slice(0,15), type: 'TEXT',
          layout: { mode:'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width:'HUG', height:'HUG', x:8, y: Math.max(0, Math.round((rect.height-(parseFloat(style.fontSize)||14))/2)) },
          styles: { fills: [tc] },
          textData: { characters: val, fontSize: Math.round(parseFloat(style.fontSize)||14), fontWeight:400, fontFamily: style.fontFamily||'Inter' }
        });
      }
    } else if (tagName === 'select') {
      const selTxt = (element.options && element.selectedIndex>=0 && element.options[element.selectedIndex]) ? element.options[element.selectedIndex].text.trim() : (element.value||'...');
      const tc = parseColor(style.color) || { r:0.2,g:0.2,b:0.2,a:1 };
      node.children.push({
        id: currentId+'_sel', name: 'Selected', type: 'TEXT',
        layout: { mode:'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width:'HUG', height:'HUG', x:8, y: Math.max(0, Math.round((rect.height-(parseFloat(style.fontSize)||14))/2)) },
        styles: { fills: [tc] },
        textData: { characters: selTxt, fontSize: Math.round(parseFloat(style.fontSize)||14), fontWeight:400, fontFamily: style.fontFamily||'Inter' }
      });
    }
  } else {
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const cn = extractNodeTree(child, counter, rect);
        if (cn) node.children.push(cn);
      } else if (child.nodeType === Node.TEXT_NODE) {
        const raw = (child.textContent||'').trim();
        if (raw.length > 0) {
          const tc = parseColor(style.color) || { r:0.1,g:0.1,b:0.1,a:1 };
          let tx=0, ty=0;
          try { const r = document.createRange(); r.selectNodeContents(child); const tr=r.getBoundingClientRect(); if(tr.width>0) { tx=Math.round(tr.left-rect.left); ty=Math.round(tr.top-rect.top); } } catch(_e){}
          node.children.push({
            id: currentId+'_txt_'+(++counter.id), name: 'Text / '+raw.slice(0,15), type: 'TEXT',
            layout: { mode:'NONE', padding:{top:0,right:0,bottom:0,left:0}, itemSpacing:0, width:'HUG', height:'HUG', x: tx, y: ty },
            styles: { fills: [tc] },
            textData: { characters: raw, fontSize: Math.round(parseFloat(style.fontSize)||14), fontWeight: style.fontWeight||400, fontFamily: style.fontFamily||'Inter' }
          });
        }
      }
    }
  }

  // ── 14. Fix dimensiones colapsadas ──
  if (node.children.length > 0) {
    if (typeof node.layout.height === 'number' && node.layout.height <= 0) {
      let mb = 0;
      for (const ch of node.children) { const cy=ch.layout?.y||0; const ch2=ch.layout?.height||40; if(cy+ch2>mb) mb=cy+ch2; }
      if (mb > 0) node.layout.height = mb;
    }
    if (typeof node.layout.width === 'number' && node.layout.width <= 0) {
      let mr = 0;
      for (const ch of node.children) { const cx=ch.layout?.x||0; const cw=ch.layout?.width||40; if(cx+cw>mr) mr=cx+cw; }
      if (mr > 0) node.layout.width = mr;
    }
  }

  // ── 15. CLIPPING: asegurar que elementos no se dispersen al infinito ──
  if (isRoot && node.children.length > 0) {
    node.children = node.children.filter(ch => {
      const cx = typeof ch.layout?.x === 'number' ? ch.layout.x : 0;
      const cy = typeof ch.layout?.y === 'number' ? ch.layout.y : 0;
      return cx < 3500 && cy < 4500;
    });
  }

  return node;
}
`;
