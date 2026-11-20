"use strict";
// Code to Figma Native Painter Sandbox
// Iniciar UI flotante para WebSocket con nuevo tamaño Studio & Receiver
figma.showUI(__html__, {
    width: 470,
    height: 630,
    title: "⚡ Code to Figma AI — Studio & Receiver"
});
// Notificar cambio de página activa al UI
figma.on('currentpagechange', () => {
    try {
        figma.ui.postMessage({
            type: 'PAGE_INFO',
            pageName: figma.currentPage.name
        });
    }
    catch (_e) { }
});
// Cache de fuentes disponibles en el entorno Figma del usuario
let availableFontsCache = null;
const fontLookupMap = new Map();
async function initFontCache() {
    if (availableFontsCache && fontLookupMap.size > 0)
        return;
    try {
        if (typeof figma.listAvailableFontsAsync === 'function') {
            availableFontsCache = await figma.listAvailableFontsAsync();
            fontLookupMap.clear();
            for (const f of availableFontsCache) {
                const famLower = f.fontName.family.toLowerCase();
                if (!fontLookupMap.has(famLower)) {
                    fontLookupMap.set(famLower, []);
                }
                fontLookupMap.get(famLower).push(f.fontName);
            }
        }
    }
    catch (err) {
        console.warn('Advertencia: No se pudo obtener la lista de fuentes disponibles:', err);
    }
}
// Normalizador seguro de fuentes tipográficas para Figma con preservación de peso y soporte Apple/Windows/Web
function resolveFontWeight(weight) {
    const num = typeof weight === 'string' ? parseInt(weight, 10) : weight;
    if (isNaN(num)) {
        const lower = String(weight).toLowerCase();
        if (lower.includes('black') || lower.includes('900'))
            return 'Black';
        if ((lower.includes('extra') && lower.includes('bold')) || lower.includes('800'))
            return 'Extra Bold';
        if (lower.includes('bold') || lower.includes('700'))
            return 'Bold';
        if (lower.includes('semibold') || lower.includes('semi-bold') || lower.includes('600'))
            return 'Semi Bold';
        if (lower.includes('medium') || lower.includes('500'))
            return 'Medium';
        if (lower.includes('light') || lower.includes('300'))
            return 'Light';
        if (lower.includes('thin') || lower.includes('100'))
            return 'Thin';
        return 'Regular';
    }
    if (num >= 900)
        return 'Black';
    if (num >= 800)
        return 'Extra Bold';
    if (num >= 700)
        return 'Bold';
    if (num >= 600)
        return 'Semi Bold';
    if (num >= 500)
        return 'Medium';
    if (num >= 400)
        return 'Regular';
    if (num >= 300)
        return 'Light';
    return 'Regular';
}
async function loadFontSafely(fontFamily, fontWeight) {
    // Asegurar siempre Inter Regular en memoria primero para que figma.createText() nunca falle
    try {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    }
    catch (_e) { }
    await initFontCache();
    const rawFamily = (fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
    const targetStyle = resolveFontWeight(fontWeight);
    // Familias candidatas en orden de prioridad según el ecosistema
    const isApple = /^(sf pro|-apple-system|blinkmacsystemfont|apple)/i.test(rawFamily);
    const candidates = isApple
        ? [rawFamily, 'SF Pro Display', 'SF Pro Text', 'SF Pro', 'Segoe UI', 'Inter', 'Helvetica Neue', 'Arial', 'Roboto']
        : [rawFamily, 'Inter', 'Segoe UI', 'Roboto', 'Arial'];
    // Variantes de ortografía del estilo tipográfico
    const styleVariants = [targetStyle];
    if (targetStyle === 'Semi Bold')
        styleVariants.push('Semibold', 'Semi-Bold', 'Demibold');
    else if (targetStyle === 'Extra Bold')
        styleVariants.push('Extrabold', 'Extra-Bold');
    else if (targetStyle === 'Bold')
        styleVariants.push('Bold');
    else if (targetStyle === 'Medium')
        styleVariants.push('Medium');
    else if (targetStyle === 'Regular')
        styleVariants.push('Regular');
    if (!styleVariants.includes('Regular'))
        styleVariants.push('Regular');
    // Si tenemos el mapa de fuentes de Figma, buscar la coincidencia EXACTA que sabemos que existe en el sistema
    if (fontLookupMap.size > 0) {
        for (const cand of candidates) {
            const availableStyles = fontLookupMap.get(cand.toLowerCase());
            if (availableStyles && availableStyles.length > 0) {
                // 1. Buscar coincidencia exacta con el estilo / peso deseado
                for (const wantStyle of styleVariants) {
                    const match = availableStyles.find(s => s.style.toLowerCase() === wantStyle.toLowerCase());
                    if (match) {
                        try {
                            await figma.loadFontAsync(match);
                            return match;
                        }
                        catch (_e) { }
                    }
                }
                // 2. Si no coincide el estilo específico, usar el estilo Regular o el primero disponible
                const regularMatch = availableStyles.find(s => s.style.toLowerCase() === 'regular') || availableStyles[0];
                try {
                    await figma.loadFontAsync(regularMatch);
                    return regularMatch;
                }
                catch (_e) { }
            }
        }
    }
    // Fallbacks universales garantizados
    const interVariants = [targetStyle, 'Regular'];
    for (const st of interVariants) {
        try {
            const f = { family: "Inter", style: st };
            await figma.loadFontAsync(f);
            return f;
        }
        catch (_e) { }
    }
    return { family: "Inter", style: "Regular" };
}
// Optimización: Pre-calentamiento / carga por lote de todas las fuentes del árbol en paralelo
async function prewarmFonts(node) {
    try {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    }
    catch (_e) { }
    await initFontCache();
    const fontsToLoad = new Set();
    function traverse(n) {
        if (n.type === 'TEXT' && n.textData) {
            const fam = n.textData.fontFamily || 'Inter';
            const weight = n.textData.fontWeight || 400;
            fontsToLoad.add(`${fam}:::${weight}`);
        }
        if (n.children) {
            for (const child of n.children)
                traverse(child);
        }
    }
    traverse(node);
    await Promise.all(Array.from(fontsToLoad).map(async (key) => {
        const [family, weight] = key.split(':::');
        await loadFontSafely(family, weight);
    }));
}
function countNodes(node) {
    let count = 1;
    if (node.children) {
        for (const child of node.children)
            count += countNodes(child);
    }
    return count;
}
// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN BOARD: organiza una extracción grande (landing completa / multi-selección)
// como un design system: Página completa → Secciones → Componentes → Estilos.
// ═══════════════════════════════════════════════════════════════════════════════
// @@BOARD_PURE_START — lógica pura (sin API de Figma), probada fuera del plugin
function boardHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++)
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}
function boardColorKey(f) {
    if (!f)
        return '-';
    if (f.type && f.type !== 'SOLID') {
        return f.type + '(' + (f.stops || []).map((s) => boardColorKey(s.color)).join(',') + ')';
    }
    const c = (v) => Math.round((v || 0) * 255).toString(16).padStart(2, '0');
    return '#' + c(f.r) + c(f.g) + c(f.b) + (f.a !== undefined && f.a < 0.995 ? '/' + Math.round(f.a * 100) : '');
}
/**
 * Firma estructural + de estilo de un nodo. Dos bloques con la misma firma se ven igual salvo
 * por su contenido (textos, imágenes) y su ancho → pueden ser instancias del mismo componente.
 */
function boardSignature(n, memo) {
    if (memo.has(n))
        return memo.get(n);
    let sig;
    const L = n.layout || {};
    const S = n.styles || {};
    if (n.type === 'TEXT') {
        const t = n.textData || {};
        sig = ['T', t.fontFamily, t.fontSize, t.fontWeight, t.textAlign, (S.fills || []).map(boardColorKey).join(',')].join('|');
    }
    else if (n.type === 'SVG') {
        sig = 'S|' + boardHash(n.svgContent || '') + '|' + L.width + 'x' + L.height;
    }
    else {
        const pad = L.padding || {};
        const style = [
            L.mode, L.primaryAxisAlignItems, L.counterAxisAlignItems, L.itemSpacing,
            [pad.top, pad.right, pad.bottom, pad.left].join(','),
            (S.fills || []).map(boardColorKey).join(','),
            (S.strokes || []).map((s) => boardColorKey(s) + '@' + s.width).join(','),
            JSON.stringify(S.cornerRadius ?? 0), S.opacity ?? 1, (S.boxShadow || []).length,
            n.imageData ? 'IMG:' + (S.imageScaleMode || 'FILL') : ''
        ].join('|');
        const h = Math.round(L.measuredHeight ?? (typeof L.height === 'number' ? L.height : 0));
        sig = 'F|' + style + '|h' + h + '[' + (n.children || []).map((c) => boardSignature(c, memo)).join(';') + ']';
    }
    memo.set(n, sig);
    return sig;
}
function boardCountNodes(n) {
    let c = 1;
    for (const ch of n.children || [])
        c += boardCountNodes(ch);
    return c;
}
/**
 * Nombre legible para un componente a partir del nombre de capa extraído:
 * "Primer_Brand__Text-module__Text___XeGJJ Primer…" → "Text"
 * "Button / Primary (Más información)"               → "Button / Primary"
 * "Media-gallery-item theme-dark current"            → "Media Gallery Item"
 */
function boardCleanName(raw) {
    let s = String(raw || '').split('(')[0].trim();
    if (s.includes('/'))
        return s.replace(/\s+/g, ' '); // ya es semántico (Button / Primary)
    if (!/[-_]/.test(s))
        return s.replace(/\s+/g, ' ') || 'Componente'; // legible (Input Group)
    s = s.split(/\s+/)[0] || s; // primera clase CSS
    // Hash de CSS Modules / styled-components: tiene dígitos o varias mayúsculas internas (XeGJJ, bCyRk, 3A2TYk)
    const isHash = (p) => /^[A-Za-z0-9]{4,8}$/.test(p) && (/\d/.test(p) || /[A-Z].*[A-Z]/.test(p.slice(1)) || /^[a-z][A-Z]/.test(p));
    const parts = s.split(/__|--/).map(p => p.replace(/^_+|_+$/g, ''))
        .filter(p => p && !isHash(p))
        .filter(p => !/-module$/i.test(p));
    let core = parts.length ? parts[parts.length - 1] : s;
    if (parts.length >= 2 && core.length <= 6)
        core = parts[parts.length - 2] + " " + core;
    core = core.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return core ? core.replace(/\b\w/g, c => c.toUpperCase()) : 'Componente';
}
/**
 * Detecta bloques repetidos (botones, tarjetas, tiles) y los marca con __cg = id de grupo.
 * Solo los bloques MÁS EXTERNOS: si una tarjeta se repite, la tarjeta es el componente,
 * no el botón que lleva dentro. Requiere ≥ 2 apariciones con firma idéntica.
 */
function boardDetectComponents(root) {
    const memo = new Map();
    boardSignature(root, memo);
    const rootArea = Math.max(1, (root.layout?.measuredWidth || 1) * (root.layout?.measuredHeight || 1));
    const eligible = (n) => {
        if (n === root || n.type === 'TEXT' || n.type === 'SVG')
            return false;
        if (!n.children || n.children.length === 0)
            return false; // imagen/caja suelta: no es componente
        if (boardCountNodes(n) < 3)
            return false; // demasiado trivial
        const area = (n.layout?.measuredWidth || 0) * (n.layout?.measuredHeight || 0);
        return area > 0 && area / rootArea < 0.35; // secciones enteras no
    };
    const counts = new Map();
    (function count(n) {
        if (eligible(n))
            counts.set(memo.get(n), (counts.get(memo.get(n)) || 0) + 1);
        (n.children || []).forEach(count);
    })(root);
    let allowed = new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([s]) => s));
    let assigned = new Map();
    for (let iter = 0; iter < 4; iter++) {
        assigned = new Map();
        (function pick(n) {
            const s = memo.get(n);
            if (eligible(n) && allowed.has(s)) {
                if (!assigned.has(s))
                    assigned.set(s, []);
                assigned.get(s).push(n);
                return; // el más externo gana: no descender
            }
            (n.children || []).forEach(pick);
        })(root);
        const next = new Set([...assigned.entries()].filter(([, occ]) => occ.length >= 2).map(([s]) => s));
        if (next.size === allowed.size)
            break;
        allowed = next;
    }
    const groups = [];
    const usedNames = new Map();
    for (const [, occ] of assigned) {
        if (occ.length < 2)
            continue;
        const base = boardCleanName(occ[0].name);
        const k = (usedNames.get(base) || 0) + 1;
        usedNames.set(base, k);
        const id = 'cg_' + groups.length;
        groups.push({ id, name: k > 1 ? `${base} ${k}` : base, occurrences: occ });
        for (const o of occ)
            o.__cg = id;
    }
    return groups;
}
/** Nodos de un subárbol en orden DFS (pre-orden), igual que el orden de construcción en Figma */
function boardCollect(n, pred, out = []) {
    if (pred(n))
        out.push(n);
    for (const c of n.children || [])
        boardCollect(c, pred, out);
    return out;
}
// @@BOARD_PURE_END
function base64ToBytes(dataUrl) {
    const clean = dataUrl.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++)
        lookup[chars.charCodeAt(i)] = i;
    let len = Math.floor(clean.length * 0.75);
    if (clean.endsWith('=='))
        len -= 2;
    else if (clean.endsWith('='))
        len -= 1;
    const bytes = new Uint8Array(len);
    let p = 0;
    for (let i = 0; i < clean.length; i += 4) {
        const e1 = lookup[clean.charCodeAt(i)], e2 = lookup[clean.charCodeAt(i + 1)];
        const e3 = lookup[clean.charCodeAt(i + 2)], e4 = lookup[clean.charCodeAt(i + 3)];
        bytes[p++] = (e1 << 2) | (e2 >> 4);
        if (clean[i + 2] !== '=')
            bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
        if (clean[i + 3] !== '=')
            bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
    }
    return bytes;
}
/** Contexto del tablero en construcción: componentes maestros por id de grupo */
let BOARD_CTX = null;
/** Crea una instancia del maestro y le aplica el contenido propio (textos, imágenes, tamaño) */
async function buildBoardInstance(nodeData, master) {
    const inst = master.createInstance();
    inst.name = nodeData.name || master.name;
    // Textos: emparejados en orden DFS (misma firma ⇒ misma estructura)
    const dataTexts = boardCollect(nodeData, (x) => x.type === 'TEXT');
    const figTexts = inst.findAll(n => n.type === 'TEXT');
    if (dataTexts.length === figTexts.length) {
        for (let i = 0; i < figTexts.length; i++) {
            const want = dataTexts[i].textData?.characters ?? '';
            const tn = figTexts[i];
            if (tn.characters === want)
                continue;
            try {
                const fonts = tn.characters.length ? tn.getRangeAllFontNames(0, tn.characters.length) : [tn.fontName];
                for (const f of fonts)
                    await figma.loadFontAsync(f);
                tn.characters = want || ' ';
            }
            catch (_e) { }
        }
    }
    // Imágenes: emparejadas en orden DFS
    const dataImgs = boardCollect(nodeData, (x) => !!x.imageData);
    const figImgs = inst.findAll(n => 'fills' in n && Array.isArray(n.fills) &&
        n.fills.some(p => p.type === 'IMAGE'));
    if (dataImgs.length === figImgs.length) {
        for (let i = 0; i < figImgs.length; i++) {
            try {
                const image = figma.createImage(base64ToBytes(dataImgs[i].imageData));
                figImgs[i].fills = figImgs[i].fills.map(p => p.type === 'IMAGE' ? { ...p, imageHash: image.hash } : p);
            }
            catch (_e) { }
        }
    }
    const w = nodeData.layout?.measuredWidth ?? (typeof nodeData.layout?.width === 'number' ? nodeData.layout.width : inst.width);
    const h = nodeData.layout?.measuredHeight ?? (typeof nodeData.layout?.height === 'number' ? nodeData.layout.height : inst.height);
    try {
        if (w > 0 && h > 0)
            inst.resize(w, h);
    }
    catch (_e) { }
    return inst;
}
/**
 * Elige los bloques principales (header, hero, cada sección, footer…) para mostrarlos como
 * sub-vistas. Un bloque alto que contiene varias secciones (ej. <main> con 9 <section>) se
 * reemplaza por sus secciones, para no mandar media página como una sola sub-vista.
 */
function boardPickSections(root) {
    const bigKids = (n) => {
        if (!('children' in n))
            return [];
        return n.children
            .filter(c => c.visible !== false && c.type !== 'TEXT' && c.height >= 60 && c.width >= n.width * 0.4)
            .sort((a, b) => a.y - b.y);
    };
    const SECTION_MAX_H = 1400; // más alto que esto y con varias secciones dentro → se divide
    function expand(n, depth) {
        const kids = bigKids(n);
        if (depth < 4 && n.height > SECTION_MAX_H && kids.length >= 2) {
            return kids.flatMap(k => expand(k, depth + 1));
        }
        // Un solo envoltorio que ocupa casi todo el bloque: mirar dentro
        if (depth < 4 && kids.length === 1 && kids[0].height >= n.height * 0.9 && n.height > SECTION_MAX_H) {
            return expand(kids[0], depth + 1);
        }
        return [n];
    }
    let top = bigKids(root);
    // La raíz es solo un envoltorio (body > #app > …): descender
    for (let depth = 0; top.length === 1 && depth < 5; depth++)
        top = bigKids(top[0]);
    return top.flatMap(k => expand(k, 0));
}
/** Titular de un bloque: el texto de mayor tamaño entre los primeros textos (para titular la sub-vista) */
function boardHeadingOf(n) {
    if (!('findAll' in n))
        return '';
    const texts = n.findAll(c => c.type === 'TEXT').slice(0, 12);
    let best = null;
    for (const t of texts) {
        const fs = typeof t.fontSize === 'number' ? t.fontSize : 0;
        const bestFs = best && typeof best.fontSize === 'number' ? best.fontSize : -1;
        if (t.characters.trim().length > 2 && fs > bestFs)
            best = t;
    }
    const s = best ? best.characters.replace(/\s+/g, ' ').trim() : '';
    return s.length > 48 ? s.slice(0, 47) + '…' : s;
}
async function boardLabel(text, size, weight, color, opacity = 1) {
    const font = await loadFontSafely('Inter', weight);
    const t = figma.createText();
    t.fontName = font;
    t.characters = text;
    t.fontSize = size;
    t.fills = [{ type: 'SOLID', color, opacity }];
    return t;
}
function boardNewSection(name) {
    if (typeof figma.createSection === 'function') {
        const s = figma.createSection();
        s.name = name;
        return s;
    }
    const f = figma.createFrame(); // fallback para versiones sin Sections
    f.name = name;
    f.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
    return f;
}
/** Ajusta el tamaño de la Section a su contenido + margen interno */
function boardFitSection(sec, pad = 100) {
    const kids = sec.children;
    if (!kids.length) {
        try {
            sec.resizeWithoutConstraints(400, 200);
        }
        catch (_e) { }
        return;
    }
    const maxR = Math.max(...kids.map(k => k.x + k.width));
    const maxB = Math.max(...kids.map(k => k.y + k.height));
    try {
        sec.resizeWithoutConstraints(Math.max(400, maxR + pad), Math.max(200, maxB + pad));
    }
    catch (_e) {
        try {
            sec.resize(Math.max(400, maxR + pad), Math.max(200, maxB + pad));
        }
        catch (_e2) { }
    }
}
function insideInstance(n) {
    for (let p = n.parent; p; p = p.parent)
        if (p.type === 'INSTANCE')
            return true;
    return false;
}
/**
 * Crea estilos de texto y de color A PARTIR DE LO QUE SE DIBUJÓ (fuentes ya resueltas en Figma),
 * los vincula a las capas y genera muestras visuales en la Section de estilos.
 */
async function boardBuildStyles(scope, stylesSec, prefix) {
    const PAD = 100;
    const textNodes = [];
    const fillNodes = [];
    for (const s of scope) {
        if ('findAll' in s) {
            for (const n of s.findAll(() => true)) {
                if (insideInstance(n))
                    continue; // las instancias heredan del maestro
                if (n.type === 'TEXT')
                    textNodes.push(n);
                else if ('fills' in n && n.fills !== figma.mixed)
                    fillNodes.push(n);
            }
        }
    }
    // ── Tipografía: agrupar por fuente + tamaño + interlineado ──
    const tGroups = new Map();
    for (const tn of textNodes) {
        if (tn.fontName === figma.mixed || tn.fontSize === figma.mixed || tn.lineHeight === figma.mixed)
            continue;
        const f = tn.fontName;
        const lh = tn.lineHeight;
        const lhKey = lh.unit === 'AUTO' ? 'auto' : Math.round(lh.value);
        const key = `${f.family}|${f.style}|${tn.fontSize}|${lhKey}`;
        if (!tGroups.has(key))
            tGroups.set(key, { font: f, size: tn.fontSize, lh, nodes: [] });
        tGroups.get(key).nodes.push(tn);
    }
    const typeScale = [...tGroups.values()].sort((a, b) => b.size - a.size || b.nodes.length - a.nodes.length).slice(0, 24);
    let y = PAD;
    const title = await boardLabel('Tipografía', 32, 700, { r: 0.1, g: 0.1, b: 0.12 });
    stylesSec.appendChild(title);
    title.x = PAD;
    title.y = y;
    y += 70;
    for (const g of typeScale) {
        try {
            const st = figma.createTextStyle();
            st.name = `${prefix}/Texto/${Math.round(g.size)} ${g.font.style}`;
            st.fontName = g.font;
            st.fontSize = g.size;
            st.lineHeight = g.lh;
            for (const tn of g.nodes) {
                try {
                    tn.textStyleId = st.id;
                }
                catch (_e) { }
            }
            const sample = figma.createText();
            sample.fontName = g.font;
            sample.characters = `${Math.round(g.size)} · ${g.font.family} ${g.font.style} — Aa Bb 123`;
            sample.fontSize = Math.min(g.size, 72);
            try {
                sample.textStyleId = st.id;
            }
            catch (_e) { }
            sample.fontSize = Math.min(g.size, 72);
            stylesSec.appendChild(sample);
            sample.x = PAD;
            sample.y = y;
            const meta = await boardLabel(`${st.name.split('/').slice(-1)[0]} · ${g.nodes.length} usos`, 12, 400, { r: 0.45, g: 0.45, b: 0.5 });
            stylesSec.appendChild(meta);
            meta.x = PAD;
            meta.y = y + sample.height + 6;
            y += sample.height + 48;
        }
        catch (_e) { }
    }
    // ── Colores sólidos: frecuencia de uso ──
    const cGroups = new Map();
    for (const n of [...fillNodes, ...textNodes]) {
        const fills = n.fills;
        if (!Array.isArray(fills) || fills.length !== 1 || fills[0].type !== 'SOLID' || fills[0].visible === false)
            continue;
        const p = fills[0];
        const key = boardColorKey({ ...p.color, a: p.opacity ?? 1 });
        if (!cGroups.has(key))
            cGroups.set(key, { paint: p, nodes: [] });
        cGroups.get(key).nodes.push(n);
    }
    const palette = [...cGroups.entries()].sort((a, b) => b[1].nodes.length - a[1].nodes.length).slice(0, 32);
    let cx = 1100;
    let cy = PAD;
    const ctitle = await boardLabel('Colores', 32, 700, { r: 0.1, g: 0.1, b: 0.12 });
    stylesSec.appendChild(ctitle);
    ctitle.x = cx;
    ctitle.y = cy;
    cy += 70;
    let col = 0;
    for (const [hex, g] of palette) {
        try {
            const st = figma.createPaintStyle();
            st.name = `${prefix}/Color/${hex}`;
            st.paints = [g.paint];
            for (const n of g.nodes) {
                try {
                    n.fillStyleId = st.id;
                }
                catch (_e) { }
            }
            const sw = figma.createRectangle();
            sw.resize(120, 120);
            sw.cornerRadius = 12;
            sw.fills = [g.paint];
            sw.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];
            try {
                sw.fillStyleId = st.id;
            }
            catch (_e) { }
            const x = cx + col * 150, yy = cy;
            stylesSec.appendChild(sw);
            sw.x = x;
            sw.y = yy;
            const lbl = await boardLabel(`${hex}\n${g.nodes.length} usos`, 11, 500, { r: 0.3, g: 0.3, b: 0.35 });
            stylesSec.appendChild(lbl);
            lbl.x = x;
            lbl.y = yy + 128;
            col++;
            if (col === 6) {
                col = 0;
                cy += 190;
            }
        }
        catch (_e) { }
    }
}
/**
 * Construye el tablero completo. Devuelve el nodo de la vista completa (para el mensaje de éxito).
 */
async function buildDesignBoard(payload) {
    const root = payload.rootNode;
    root.type = 'FRAME'; // el tablero gestiona sus propios componentes
    let host = 'Landing';
    try {
        host = new URL(payload.source?.url || '').hostname.replace(/^www\./, '') || host;
    }
    catch (_e) { }
    const prefix = host;
    // El tablero se arma en la PÁGINA ACTUAL, a la derecha de lo que ya hay. No se crean ni se
    // cambian páginas: el plan gratuito limita las páginas por archivo, y Figma crea los nodos
    // nuevos (createX, clone) en la página actual; cambiar de página dejaba copias sueltas.
    const page = figma.currentPage;
    const others = page.children;
    const originX = others.length ? Math.round(Math.max(...others.map(c => c.x + c.width)) + 400) : 0;
    const originY = others.length ? Math.round(Math.min(...others.map(c => c.y))) : 0;
    const progress = (message) => figma.ui.postMessage({ type: 'LOG', level: 'info', message: `Tablero · ${message}` });
    // 1. Detectar componentes repetidos y construir los maestros
    const groups = boardDetectComponents(root);
    const compSec = boardNewSection('03 · Componentes');
    page.appendChild(compSec);
    BOARD_CTX = { masters: new Map() };
    let gx = 100, gy = 100, rowH = 0;
    const MAX_ROW = 2600;
    for (const g of groups) {
        let built = null;
        try {
            const data = JSON.parse(JSON.stringify(g.occurrences[0]));
            (function strip(n) { delete n.__cg; (n.children || []).forEach(strip); })(data);
            data.type = 'COMPONENT';
            data.name = g.name;
            data.layout = { ...data.layout, positioning: 'AUTO', x: 0, y: 0 };
            built = await buildFigmaNode(data);
            if (!built || built.type !== 'COMPONENT')
                throw new Error('no se generó como componente');
            const master = built;
            compSec.appendChild(master);
            master.description = `${g.occurrences.length} usos en ${host}`;
            if (gx > 100 && gx + master.width > MAX_ROW) {
                gx = 100;
                gy += rowH + 140;
                rowH = 0;
            }
            master.x = gx;
            master.y = gy + 40;
            const lbl = await boardLabel(`${g.name} · ${g.occurrences.length} usos`, 16, 600, { r: 0.33, g: 0.2, b: 0.8 });
            compSec.appendChild(lbl);
            lbl.x = gx;
            lbl.y = gy;
            gx += master.width + 120;
            rowH = Math.max(rowH, master.height + 40);
            BOARD_CTX.masters.set(g.id, master);
        }
        catch (compErr) {
            // Sin maestro, sus usos se dibujan como copias normales
            if (built && !built.removed) {
                try {
                    built.remove();
                }
                catch (_e) { }
            }
            figma.ui.postMessage({ type: 'LOG', level: 'warn', message: `Componente "${g.name}" omitido: ${compErr?.message || compErr}` });
        }
    }
    progress(`${BOARD_CTX.masters.size} componentes creados`);
    // 2. Vista completa (usa instancias de los maestros)
    const fullSec = boardNewSection('01 · Página completa');
    page.appendChild(fullSec);
    const full = await buildFigmaNode(root);
    const componentCount = BOARD_CTX.masters.size;
    BOARD_CTX = null;
    if (!full)
        throw new Error('No se pudo generar la vista completa');
    fullSec.appendChild(full);
    full.x = 100;
    full.y = 100;
    progress(`vista completa lista (${Math.round(full.width)}×${Math.round(full.height)})`);
    // 3. Sub-vistas: cada bloque principal, en columna con su título
    const subSec = boardNewSection('02 · Secciones');
    page.appendChild(subSec);
    let sy = 100;
    // Multi-selección: cada componente elegido es su propia sub-vista
    const isMulti = String(root.id || '').startsWith('multi_selection_bundle') && 'children' in full;
    const picked = isMulti ? [...full.children] : boardPickSections(full);
    let subOk = 0;
    for (let i = 0; i < picked.length; i++) {
        let clone = null;
        try {
            // Título primero; la copia se mete en la Section en cuanto se crea (nunca queda suelta)
            const heading = boardHeadingOf(picked[i]);
            const title = `${String(i + 1).padStart(2, '0')} · ${picked[i].name}` + (heading ? ` — ${heading}` : '');
            const lbl = await boardLabel(title, 20, 600, { r: 0.1, g: 0.1, b: 0.12 });
            subSec.appendChild(lbl);
            lbl.x = 100;
            lbl.y = sy;
            clone = picked[i].clone();
            subSec.appendChild(clone);
            clone.x = 100;
            clone.y = sy + 44;
            sy += 44 + clone.height + 140;
            subOk++;
        }
        catch (subErr) {
            if (clone && clone.parent !== subSec) {
                try {
                    clone.remove();
                }
                catch (_e) { }
            }
            figma.ui.postMessage({ type: 'LOG', level: 'warn', message: `Sub-vista "${picked[i].name}" omitida: ${subErr?.message || subErr}` });
        }
    }
    progress(`${subOk}/${picked.length} sub-vistas`);
    // 4. Estilos (texto + color) vinculados a las capas
    const stylesSec = boardNewSection('04 · Estilos');
    page.appendChild(stylesSec);
    await boardBuildStyles([full, ...compSec.children.filter(c => c.type === 'COMPONENT')], stylesSec, prefix);
    // 5. Disposición horizontal: 01 → 02 → 03 → 04
    const order = [fullSec, subSec, compSec, stylesSec];
    for (const s of order)
        boardFitSection(s);
    let x = originX;
    for (const s of order) {
        if (s.children.length === 0) {
            s.remove();
            continue;
        }
        s.x = x;
        s.y = originY;
        x += s.width + 240;
    }
    figma.viewport.scrollAndZoomIntoView(order.filter(s => !s.removed));
    return { main: full, nodeCount: countNodes(root), components: componentCount, page };
}
/**
 * Validación del payload antes de tocar el lienzo (plan de mejoras, fase 1.3).
 * Cubre lo que no pasa por el hub (p. ej. "Pegar JSON"). Mismas reglas y límites que
 * `validateRenderPayload` de @code-to-figma/contracts (Zod); el plugin aún se compila sin
 * empaquetador, así que se duplica aquí hasta la fase 3 (bundler), donde se usará el esquema.
 */
const PLUGIN_PAYLOAD_LIMITS = { maxDepth: 400, maxNodes: 150000, maxImageChars: 40 * 1024 * 1024, maxSvgChars: 2 * 1024 * 1024, maxTextChars: 200000 };
const VALID_NODE_TYPES = ['FRAME', 'TEXT', 'SVG', 'COMPONENT', 'INSTANCE'];
function guardRenderPayload(root) {
    const isNum = (v) => v === undefined || (typeof v === 'number' && isFinite(v));
    const stack = [{ n: root, d: 0 }];
    let count = 0;
    while (stack.length) {
        const { n, d } = stack.pop();
        if (d > PLUGIN_PAYLOAD_LIMITS.maxDepth)
            return `árbol demasiado profundo (> ${PLUGIN_PAYLOAD_LIMITS.maxDepth} niveles)`;
        if (++count > PLUGIN_PAYLOAD_LIMITS.maxNodes)
            return `demasiados nodos (> ${PLUGIN_PAYLOAD_LIMITS.maxNodes})`;
        if (!n || typeof n !== 'object' || Array.isArray(n))
            return 'nodo que no es un objeto';
        if (!VALID_NODE_TYPES.includes(n.type))
            return `tipo de nodo inválido: ${String(n.type).slice(0, 40)}`;
        const L = n.layout;
        if (L !== undefined && (typeof L !== 'object' || !isNum(L.x) || !isNum(L.y) || !isNum(L.measuredWidth) || !isNum(L.measuredHeight))) {
            return `layout inválido en "${String(n.name || n.type).slice(0, 40)}"`;
        }
        if (n.imageData !== undefined && (typeof n.imageData !== 'string' || n.imageData.length > PLUGIN_PAYLOAD_LIMITS.maxImageChars ||
            !/^data:image\/[a-z0-9.+-]+;base64,/i.test(n.imageData))) {
            return 'imageData debe ser data:image/...;base64';
        }
        if (n.svgContent !== undefined && (typeof n.svgContent !== 'string' || n.svgContent.length > PLUGIN_PAYLOAD_LIMITS.maxSvgChars ||
            /<script[\s>]/i.test(n.svgContent) || /javascript:/i.test(n.svgContent))) {
            return 'SVG inválido (script, javascript: o demasiado grande)';
        }
        if (n.textData !== undefined && (typeof n.textData?.characters !== 'string' || n.textData.characters.length > PLUGIN_PAYLOAD_LIMITS.maxTextChars)) {
            return 'textData inválido';
        }
        if (n.children !== undefined) {
            if (!Array.isArray(n.children))
                return 'children debe ser una lista';
            for (let i = n.children.length - 1; i >= 0; i--)
                stack.push({ n: n.children[i], d: d + 1 });
        }
    }
    return null;
}
// Aplica estilos por rango (fuente/peso, tamaño, color, decoración) a un TextNode
async function applyTextSegments(tn, segments) {
    const len = tn.characters.length;
    for (const seg of segments) {
        const start = Math.max(0, Math.min(len, seg.start));
        const end = Math.max(start, Math.min(len, seg.end));
        if (end <= start)
            continue;
        try {
            if (seg.fontFamily || seg.fontWeight) {
                const f = await loadFontSafely(seg.fontFamily || 'Inter', seg.fontWeight || 400);
                tn.setRangeFontName(start, end, f);
            }
            if (seg.fontSize && seg.fontSize > 0)
                tn.setRangeFontSize(start, end, seg.fontSize);
            if (seg.color) {
                tn.setRangeFills(start, end, [{
                        type: 'SOLID',
                        color: { r: seg.color.r, g: seg.color.g, b: seg.color.b },
                        opacity: seg.color.a !== undefined ? seg.color.a : 1
                    }]);
            }
            if (seg.underline)
                tn.setRangeTextDecoration(start, end, 'UNDERLINE');
            else if (seg.strike)
                tn.setRangeTextDecoration(start, end, 'STRIKETHROUGH');
        }
        catch (err) {
            console.warn('No se pudo aplicar tramo de texto:', err?.message || err);
        }
    }
}
/**
 * Dimensiona un texto cuyos saltos de línea ya vienen del navegador (noWrap).
 * Figma usa otra fuente si falta la original (SF Pro → Inter, más ancha); si se le deja
 * ancho fijo, re-parte las líneas, el texto crece y pisa lo que hay debajo.
 * Estrategia: mantener el ancho medido; si alguna línea no cabe, pasar a WIDTH_AND_HEIGHT
 * y compensar la posición según la alineación para que siga centrado / a la derecha.
 */
function applyNoWrapSizing(tn, data, parentIsAutoLayout) {
    const td = data.textData;
    const measuredW = data.layout?.measuredWidth || (typeof data.layout?.width === 'number' ? data.layout.width : 0);
    // 1. Ancho natural sin partir líneas
    tn.textAutoResize = 'WIDTH_AND_HEIGHT';
    const naturalW = tn.width;
    const fitsMeasured = measuredW > 0 && naturalW <= measuredW + 0.5;
    if (parentIsAutoLayout) {
        if (data.layout?.width === 'FILL' && fitsMeasured) {
            try {
                tn.layoutSizingHorizontal = 'FILL';
                tn.textAutoResize = 'HEIGHT';
            }
            catch (_e) { }
        }
        else if (typeof data.layout?.width === 'number' && fitsMeasured) {
            try {
                tn.resize(Math.max(1, data.layout.width), tn.height);
                tn.textAutoResize = 'HEIGHT';
            }
            catch (_e) { }
        }
        // Si no cabe: queda HUG (WIDTH_AND_HEIGHT) y el padre lo alinea; nunca se re-parte.
        return;
    }
    // Padre sin Auto Layout: posición absoluta
    if (measuredW > 0 && fitsMeasured) {
        try {
            tn.resize(measuredW, tn.height);
            tn.textAutoResize = 'HEIGHT';
        }
        catch (_e) { }
    }
    else if (measuredW > 0) {
        // Más ancho que en la web: anclar según la alineación del texto
        const extra = naturalW - measuredW;
        if (td.textAlign === 'CENTER')
            tn.x = tn.x - extra / 2;
        else if (td.textAlign === 'RIGHT')
            tn.x = tn.x - extra;
    }
}
// Función recursiva constructora de nodos Figma
// Convierte un fill CSS extraído (SOLID / GRADIENT_*) a Paint de Figma
function cssFillToPaint(f) {
    if (f.type === 'GRADIENT_RADIAL') {
        const transform = [
            [0.5, 0, 0.5],
            [0, 0.5, 0.5]
        ];
        return {
            type: 'GRADIENT_RADIAL',
            gradientTransform: transform,
            gradientStops: (f.stops || []).map((s) => ({
                position: Math.max(0, Math.min(1, s.position)),
                color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== undefined ? s.color.a : 1 }
            }))
        };
    }
    if (f.type === 'GRADIENT_LINEAR') {
        const angleDeg = typeof f.angle === 'number' ? f.angle : 180;
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const x1 = 0.5 - 0.5 * cos;
        const y1 = 0.5 - 0.5 * sin;
        const x2 = 0.5 + 0.5 * cos;
        const y2 = 0.5 + 0.5 * sin;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const transform = [
            [dx, dy, x1],
            [-dy, dx, y1]
        ];
        return {
            type: 'GRADIENT_LINEAR',
            gradientTransform: transform,
            gradientStops: (f.stops || []).map((s) => ({
                position: Math.max(0, Math.min(1, s.position)),
                color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== undefined ? s.color.a : 1 }
            }))
        };
    }
    return {
        type: 'SOLID',
        color: { r: f.r, g: f.g, b: f.b },
        opacity: f.a !== undefined ? f.a : 1
    };
}
async function buildFigmaNode(nodeData) {
    let createdNode = null;
    // Tablero de design system: un bloque repetido se dibuja como instancia de su componente
    const cg = nodeData.__cg;
    if (BOARD_CTX && cg && BOARD_CTX.masters.has(cg)) {
        try {
            return await buildBoardInstance(nodeData, BOARD_CTX.masters.get(cg));
        }
        catch (instErr) {
            figma.ui.postMessage({ type: 'LOG', level: 'warn', message: `Instancia "${nodeData.name}" no creada, se dibuja como copia: ${instErr?.message || instErr}` });
        }
    }
    try {
        if (nodeData.type === 'TEXT' && nodeData.textData) {
            // 1. Cargar obligatoriamente Inter Regular primero para que figma.createText() nunca falle
            try {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            }
            catch (_e) { }
            // 2. Cargar la fuente deseada preservando peso visual
            const font = await loadFontSafely(nodeData.textData.fontFamily, nodeData.textData.fontWeight);
            // 3. Crear el nodo de texto (garantizado libre de excepciones)
            const textNode = figma.createText();
            // 4. Asignar fuente
            try {
                textNode.fontName = font;
            }
            catch (_fErr) {
                try {
                    textNode.fontName = { family: "Inter", style: "Regular" };
                }
                catch (_fErr2) { }
            }
            // 5. Asignar caracteres
            textNode.characters = nodeData.textData.characters || ' ';
            // 6. Asignar fontSize
            try {
                textNode.fontSize = Math.max(1, nodeData.textData.fontSize || 14);
            }
            catch (_e) { }
            // 7. Asignar lineHeight
            if (nodeData.textData.lineHeight && nodeData.textData.lineHeight > 0) {
                try {
                    textNode.lineHeight = { value: nodeData.textData.lineHeight, unit: 'PIXELS' };
                }
                catch (_e) { }
            }
            // 8. Asignar letterSpacing
            if (nodeData.textData.letterSpacing !== undefined && nodeData.textData.letterSpacing !== 0) {
                try {
                    textNode.letterSpacing = { value: nodeData.textData.letterSpacing, unit: 'PIXELS' };
                }
                catch (_e) { }
            }
            // 9. Asignar alineación horizontal
            if (nodeData.textData.textAlign) {
                try {
                    const alignMap = {
                        LEFT: 'LEFT',
                        CENTER: 'CENTER',
                        RIGHT: 'RIGHT',
                        JUSTIFIED: 'JUSTIFIED'
                    };
                    textNode.textAlignHorizontal = alignMap[nodeData.textData.textAlign] || 'LEFT';
                }
                catch (_e) { }
            }
            // 10. Fills de texto
            if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
                try {
                    textNode.fills = nodeData.styles.fills.map((f) => ({
                        type: 'SOLID',
                        color: { r: f.r, g: f.g, b: f.b },
                        opacity: f.a !== undefined ? f.a : 1
                    }));
                }
                catch (_e) { }
            }
            // 11. Tramos con estilo propio (links, negritas, <sup>…) dentro del mismo texto
            if (Array.isArray(nodeData.textData.segments) && nodeData.textData.segments.length > 0) {
                await applyTextSegments(textNode, nodeData.textData.segments);
            }
            // 12. Texto con saltos de línea medidos en el navegador: no dejar que Figma lo re-acomode.
            //     El dimensionado final lo ajusta el padre (applyNoWrapSizing).
            if (nodeData.textData.noWrap) {
                try {
                    textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
                }
                catch (_e) { }
            }
            createdNode = textNode;
        }
        else if (nodeData.type === 'SVG' && nodeData.svgContent) {
            try {
                const svgNode = figma.createNodeFromSvg(nodeData.svgContent);
                const targetW = typeof nodeData.layout?.width === 'number' ? nodeData.layout.width : 24;
                const targetH = typeof nodeData.layout?.height === 'number' ? nodeData.layout.height : 24;
                if (targetW > 0 && targetH > 0) {
                    svgNode.resize(targetW, targetH);
                }
                createdNode = svgNode;
            }
            catch (err) {
                console.warn('No se pudo crear SVG, creando placeholder frame:', err);
                const fallback = figma.createFrame();
                fallback.resize(24, 24);
                createdNode = fallback;
            }
        }
        else {
            // FRAME o COMPONENT
            const frame = nodeData.type === 'COMPONENT'
                ? figma.createComponent()
                : figma.createFrame();
            // Registrar desde ya: si algo falla más abajo, el frame parcial se devuelve y se anida
            // en su padre en vez de quedar huérfano en la raíz de la página (detrás del diseño).
            createdNode = frame;
            frame.name = nodeData.name || 'Frame';
            // Auto Layout
            const mode = nodeData.layout?.mode || 'NONE';
            if (mode === 'HORIZONTAL') {
                frame.layoutMode = 'HORIZONTAL';
            }
            else if (mode === 'VERTICAL') {
                frame.layoutMode = 'VERTICAL';
            }
            else {
                frame.layoutMode = 'NONE';
            }
            if (frame.layoutMode !== 'NONE') {
                // Spacing y Padding
                frame.itemSpacing = Math.max(0, nodeData.layout?.itemSpacing || 0);
                const pad = nodeData.layout?.padding || { top: 0, right: 0, bottom: 0, left: 0 };
                frame.paddingTop = Math.max(0, pad.top || 0);
                frame.paddingRight = Math.max(0, pad.right || 0);
                frame.paddingBottom = Math.max(0, pad.bottom || 0);
                frame.paddingLeft = Math.max(0, pad.left || 0);
                // Alineación de ejes
                if (nodeData.layout?.primaryAxisAlignItems) {
                    const mapPrimary = {
                        MIN: 'MIN',
                        CENTER: 'CENTER',
                        MAX: 'MAX',
                        SPACE_BETWEEN: 'SPACE_BETWEEN'
                    };
                    frame.primaryAxisAlignItems = mapPrimary[nodeData.layout.primaryAxisAlignItems] || 'MIN';
                }
                if (nodeData.layout?.counterAxisAlignItems) {
                    const mapCounter = {
                        MIN: 'MIN',
                        CENTER: 'CENTER',
                        MAX: 'MAX',
                        BASELINE: 'BASELINE'
                    };
                    frame.counterAxisAlignItems = mapCounter[nodeData.layout.counterAxisAlignItems] || 'MIN';
                }
                if (nodeData.layout?.layoutWrap === 'WRAP') {
                    frame.layoutWrap = 'WRAP';
                    // Separación entre filas medida en el navegador
                    const cas = nodeData.layout.counterAxisSpacing;
                    if (typeof cas === 'number' && cas >= 0) {
                        try {
                            frame.counterAxisSpacing = cas;
                        }
                        catch (_e) { }
                    }
                }
            }
            // Estilos de Relleno (Fills) e Imágenes Base64
            if (nodeData.imageData) {
                try {
                    const image = figma.createImage(base64ToBytes(nodeData.imageData));
                    // Orden CSS → Figma: color de fondo abajo, imagen en medio, degradados (overlays) arriba
                    const baseFills = (nodeData.styles?.fills || []).filter((f) => !f.type || f.type === 'SOLID');
                    const overlayFills = (nodeData.styles?.fills || []).filter((f) => f.type && f.type !== 'SOLID');
                    const imagePaint = {
                        type: 'IMAGE',
                        scaleMode: nodeData.styles?.imageScaleMode || 'FILL',
                        imageHash: image.hash
                    };
                    frame.fills = [
                        ...baseFills.map(cssFillToPaint),
                        imagePaint,
                        ...overlayFills.map(cssFillToPaint)
                    ];
                }
                catch (_imgErr) {
                    console.warn('Error decodificando imagen base64:', _imgErr);
                    figma.ui.postMessage({
                        type: 'LOG',
                        level: 'error',
                        message: `Imagen no aplicada en "${nodeData.name}": ${_imgErr?.message || _imgErr}`
                    });
                    // Placeholder visible para que la capa no quede "vacía" sin aviso
                    frame.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }];
                }
            }
            else if (nodeData.styles?.fills) {
                frame.fills = nodeData.styles.fills.map(cssFillToPaint);
            }
            // Bordes (Strokes) y lados individuales
            if (nodeData.styles?.strokes && nodeData.styles.strokes.length > 0) {
                const stroke = nodeData.styles.strokes[0];
                frame.strokes = [{
                        type: 'SOLID',
                        color: { r: stroke.r, g: stroke.g, b: stroke.b },
                        opacity: stroke.a !== undefined ? stroke.a : 1
                    }];
                frame.strokeAlign = 'INSIDE';
                // Lados individuales de borde si aplican
                if (nodeData.styles?.borderSides) {
                    const bs = nodeData.styles.borderSides;
                    try {
                        frame.strokeTopWeight = Math.max(0, bs.top ?? 0);
                        frame.strokeRightWeight = Math.max(0, bs.right ?? 0);
                        frame.strokeBottomWeight = Math.max(0, bs.bottom ?? 0);
                        frame.strokeLeftWeight = Math.max(0, bs.left ?? 0);
                    }
                    catch (_e) {
                        frame.strokeWeight = Math.max(1, stroke.width || 1);
                    }
                }
                else {
                    frame.strokeWeight = Math.max(1, stroke.width || 1);
                }
            }
            // Border Radius (Corner Radius)
            if (nodeData.styles?.cornerRadius !== undefined) {
                if (typeof nodeData.styles.cornerRadius === 'number') {
                    frame.cornerRadius = Math.max(0, nodeData.styles.cornerRadius);
                }
                else if (Array.isArray(nodeData.styles.cornerRadius) && nodeData.styles.cornerRadius.length === 4) {
                    const [tl, tr, br, bl] = nodeData.styles.cornerRadius;
                    frame.topLeftRadius = Math.max(0, tl);
                    frame.topRightRadius = Math.max(0, tr);
                    frame.bottomRightRadius = Math.max(0, br);
                    frame.bottomLeftRadius = Math.max(0, bl);
                }
            }
            // Opacity
            if (typeof nodeData.styles?.opacity === 'number') {
                frame.opacity = Math.max(0, Math.min(1, nodeData.styles.opacity));
            }
            // Efectos: Box Shadows & Glassmorphism Backdrop Blur
            const effects = [];
            if (nodeData.styles?.boxShadow && nodeData.styles.boxShadow.length > 0) {
                for (const shadow of nodeData.styles.boxShadow) {
                    effects.push({
                        type: 'DROP_SHADOW',
                        color: {
                            r: shadow.color.r,
                            g: shadow.color.g,
                            b: shadow.color.b,
                            a: shadow.color.a
                        },
                        offset: { x: shadow.offset.x, y: shadow.offset.y },
                        radius: Math.max(0, shadow.radius),
                        spread: shadow.spread || 0,
                        visible: true,
                        blendMode: 'NORMAL'
                    });
                }
            }
            if (typeof nodeData.styles?.backdropBlur === 'number' && nodeData.styles.backdropBlur > 0) {
                effects.push({
                    type: 'BACKGROUND_BLUR',
                    radius: Math.max(1, nodeData.styles.backdropBlur),
                    visible: true
                });
            }
            if (effects.length > 0) {
                frame.effects = effects;
            }
            // Dimensiones iniciales (usar width explícito o measuredWidth del DOM real)
            // Ojo: measured 0 es un valor real (elemento colapsado), no "desconocido"
            const initW = typeof nodeData.layout?.width === 'number'
                ? nodeData.layout.width
                : (typeof nodeData.layout?.measuredWidth === 'number' ? nodeData.layout.measuredWidth : 100);
            const initH = typeof nodeData.layout?.height === 'number'
                ? nodeData.layout.height
                : (typeof nodeData.layout?.measuredHeight === 'number' ? nodeData.layout.measuredHeight : 40);
            frame.resize(Math.max(1, initW), Math.max(1, initH));
            // Asegurar modo de dimensionamiento inicial FIXED en Auto Layout para permitir hijos con FILL
            if (frame.layoutMode !== 'NONE') {
                try {
                    frame.layoutSizingHorizontal = 'FIXED';
                    frame.layoutSizingVertical = 'FIXED';
                }
                catch (_e) { }
            }
            // Habilitar Clip Content en frames raíz o frames con fondo y esquinas redondeadas
            const hasRoundCorners = typeof frame.cornerRadius === 'number' ? frame.cornerRadius > 0 : false;
            const hasFills = Array.isArray(frame.fills) && frame.fills.length > 0;
            // createFrame() recorta por defecto: fijarlo explícitamente según el CSS (overflow),
            // si no, contenido desplazado (slides, overlays) desaparece en vez de verse.
            frame.clipsContent = !!(nodeData.clipsContent || (hasRoundCorners && hasFills));
            // Procesar hijos recursivamente
            if (nodeData.children && nodeData.children.length > 0) {
                for (const childData of nodeData.children) {
                    const childNode = await buildFigmaNode(childData);
                    if (childNode)
                        try {
                            frame.appendChild(childNode);
                            // Ajustar sizing del hijo dentro del padre con Auto Layout
                            if (frame.layoutMode !== 'NONE') {
                                const layoutChild = childNode;
                                if (childData.layout?.positioning === 'ABSOLUTE') {
                                    try {
                                        // 1. En Figma un nodo ABSOLUTE no puede tener layoutSizingHorizontal = 'FILL'.
                                        // Debe tener dimensiones explícitas fijas en píxeles.
                                        const targetW = typeof childData.layout.width === 'number' && childData.layout.width > 0
                                            ? childData.layout.width
                                            : (childData.layout.measuredWidth || layoutChild.width || 100);
                                        const targetH = typeof childData.layout.height === 'number' && childData.layout.height > 0
                                            ? childData.layout.height
                                            : (childData.layout.measuredHeight || layoutChild.height || 100);
                                        if (targetW > 0 && targetH > 0 && typeof layoutChild.resize === 'function') {
                                            try {
                                                layoutChild.resize(targetW, targetH);
                                            }
                                            catch (_resErr) { }
                                        }
                                        // 2. Establecer layoutPositioning a ABSOLUTE en Figma
                                        if ('layoutPositioning' in layoutChild) {
                                            layoutChild.layoutPositioning = 'ABSOLUTE';
                                        }
                                        // 3. Posicionar en coordenadas exactas relativas al padre
                                        if (typeof childData.layout.x === 'number')
                                            childNode.x = childData.layout.x;
                                        if (typeof childData.layout.y === 'number')
                                            childNode.y = childData.layout.y;
                                    }
                                    catch (absErr) {
                                        console.warn('Error configurando layoutPositioning ABSOLUTE:', absErr);
                                    }
                                }
                                else {
                                    // Si el hijo es texto dentro de Auto Layout
                                    if (childNode.type === 'TEXT' && childData.textData?.noWrap) {
                                        applyNoWrapSizing(childNode, childData, true);
                                    }
                                    else if (childNode.type === 'TEXT') {
                                        const tn = childNode;
                                        const isMulti = childData.textData?.isMultiline || (childData.textData?.characters && childData.textData.characters.includes('\n'));
                                        if (childData.layout?.width === 'FILL') {
                                            // Texto que se expande al ancho del contenedor y envuelve en altura
                                            tn.textAutoResize = 'HEIGHT';
                                            try {
                                                tn.layoutSizingHorizontal = 'FILL';
                                            }
                                            catch (_e) {
                                                const fallbackW = childData.layout?.measuredWidth || frame.width;
                                                if (fallbackW > 0) {
                                                    try {
                                                        tn.resize(fallbackW, tn.height);
                                                    }
                                                    catch (_r) { }
                                                }
                                            }
                                        }
                                        else if (childData.layout?.width === 'HUG') {
                                            if (isMulti && frame.layoutMode === 'VERTICAL') {
                                                // Texto multilínea en contenedor vertical: FILL para que no se trunque horizontalmente
                                                tn.textAutoResize = 'HEIGHT';
                                                try {
                                                    tn.layoutSizingHorizontal = 'FILL';
                                                }
                                                catch (_e) {
                                                    const fallbackW = childData.layout?.measuredWidth || frame.width;
                                                    if (fallbackW > 0) {
                                                        try {
                                                            tn.resize(fallbackW, tn.height);
                                                        }
                                                        catch (_r) { }
                                                    }
                                                }
                                            }
                                            else {
                                                // Texto de una línea (etiquetas de botón, badges, links cortos)
                                                tn.textAutoResize = 'WIDTH_AND_HEIGHT';
                                            }
                                        }
                                        else if (typeof childData.layout?.width === 'number') {
                                            try {
                                                tn.resize(Math.max(1, childData.layout.width), tn.height);
                                            }
                                            catch (_e) { }
                                            tn.textAutoResize = 'HEIGHT';
                                        }
                                    }
                                    else {
                                        // Si el hijo es Frame u otro nodo con Auto Layout
                                        // Primero redimensionar dimensiones fijas explícitas para no sobreescribir FILL/HUG después
                                        const hasFixedW = typeof childData.layout?.width === 'number';
                                        const hasFixedH = typeof childData.layout?.height === 'number';
                                        if (hasFixedW || hasFixedH) {
                                            const targetW = hasFixedW ? Math.max(1, childData.layout.width) : layoutChild.width;
                                            const targetH = hasFixedH ? Math.max(1, childData.layout.height) : layoutChild.height;
                                            try {
                                                layoutChild.resize(targetW, targetH);
                                            }
                                            catch (_e) { }
                                        }
                                        // LUEGO asignar layoutSizing para que resize no lo resetee a FIXED
                                        try {
                                            if (childData.layout?.width === 'FILL' && 'layoutSizingHorizontal' in layoutChild) {
                                                layoutChild.layoutSizingHorizontal = 'FILL';
                                            }
                                            else if (childData.layout?.width === 'HUG' && 'layoutSizingHorizontal' in layoutChild) {
                                                layoutChild.layoutSizingHorizontal = 'HUG';
                                            }
                                            else if (hasFixedW && 'layoutSizingHorizontal' in layoutChild) {
                                                layoutChild.layoutSizingHorizontal = 'FIXED';
                                            }
                                        }
                                        catch (_e) { }
                                        try {
                                            if (childData.layout?.height === 'FILL' && 'layoutSizingVertical' in layoutChild) {
                                                layoutChild.layoutSizingVertical = 'FILL';
                                            }
                                            else if (childData.layout?.height === 'HUG' && 'layoutSizingVertical' in layoutChild) {
                                                layoutChild.layoutSizingVertical = 'HUG';
                                            }
                                            else if (hasFixedH && 'layoutSizingVertical' in layoutChild) {
                                                layoutChild.layoutSizingVertical = 'FIXED';
                                            }
                                        }
                                        catch (_e) { }
                                    }
                                }
                            }
                            else {
                                // Posicionamiento en modo canvas libre (NONE)
                                if (typeof childData.layout?.x === 'number')
                                    childNode.x = childData.layout.x;
                                if (typeof childData.layout?.y === 'number')
                                    childNode.y = childData.layout.y;
                                if (childNode.type === 'FRAME' || childNode.type === 'COMPONENT') {
                                    const targetW = (typeof childData.layout?.width === 'number' ? childData.layout.width : childData.layout?.measuredWidth) || childNode.width;
                                    const targetH = (typeof childData.layout?.height === 'number' ? childData.layout.height : childData.layout?.measuredHeight) || childNode.height;
                                    if (targetW > 0 && targetH > 0 && (targetW !== childNode.width || targetH !== childNode.height)) {
                                        childNode.resize(targetW, targetH);
                                    }
                                }
                                else if (childNode.type === 'TEXT' && childData.textData?.noWrap) {
                                    applyNoWrapSizing(childNode, childData, false);
                                }
                                else if (childNode.type === 'TEXT') {
                                    const tn = childNode;
                                    const isMulti = childData.textData?.isMultiline || (childData.textData?.characters && childData.textData.characters.includes('\n'));
                                    const targetW = typeof childData.layout?.width === 'number' && childData.layout.width > 0
                                        ? childData.layout.width
                                        : (childData.layout?.measuredWidth || 0);
                                    if (targetW > 0 && (isMulti || childData.layout?.width !== 'HUG')) {
                                        tn.resize(targetW, tn.height);
                                        tn.textAutoResize = 'HEIGHT';
                                    }
                                    else {
                                        tn.textAutoResize = 'WIDTH_AND_HEIGHT';
                                    }
                                }
                            }
                        }
                        catch (childErr) {
                            // Un hijo con error de dimensionado no debe abortar a sus hermanos
                            figma.ui.postMessage({
                                type: 'LOG',
                                level: 'warn',
                                message: `Ajuste de capa "${childData.name}" incompleto: ${childErr?.message || childErr}`
                            });
                        }
                }
            }
            // Configurar Sizing del propio frame padre
            const hasSelfFixedW = typeof nodeData.layout?.width === 'number' && nodeData.layout.width > 0;
            const hasSelfFixedH = typeof nodeData.layout?.height === 'number' && nodeData.layout.height > 0;
            const targetFrameW = hasSelfFixedW ? nodeData.layout.width : (nodeData.layout?.measuredWidth || frame.width);
            const targetFrameH = hasSelfFixedH ? nodeData.layout.height : (nodeData.layout?.measuredHeight || frame.height);
            if (targetFrameW > 0 && targetFrameH > 0 && (targetFrameW !== frame.width || targetFrameH !== frame.height)) {
                try {
                    frame.resize(targetFrameW, targetFrameH);
                }
                catch (_e) { }
            }
            if (frame.layoutMode !== 'NONE') {
                try {
                    if (nodeData.layout?.width === 'HUG') {
                        frame.layoutSizingHorizontal = 'HUG';
                    }
                    else if (nodeData.layout?.width === 'FILL') {
                        frame.layoutSizingHorizontal = 'FILL';
                    }
                    else if (hasSelfFixedW) {
                        frame.layoutSizingHorizontal = 'FIXED';
                    }
                }
                catch (_e) { }
                try {
                    if (nodeData.layout?.height === 'HUG') {
                        frame.layoutSizingVertical = 'HUG';
                    }
                    else if (nodeData.layout?.height === 'FILL') {
                        frame.layoutSizingVertical = 'FILL';
                    }
                    else if (hasSelfFixedH) {
                        frame.layoutSizingVertical = 'FIXED';
                    }
                }
                catch (_e) { }
            }
            createdNode = frame;
        }
        if (createdNode) {
            createdNode.name = nodeData.name || createdNode.name;
        }
    }
    catch (error) {
        console.error('Error creando nodo Figma:', error);
        try {
            figma.ui.postMessage({
                type: 'LOG',
                level: 'error',
                message: `Error en capa "${nodeData.name}": ${error?.message || error}`
            });
        }
        catch (_logErr) { }
        // Safety Net: si falló la creación de un texto por fuentes o métricas, intentar crearlo con Inter Regular
        if (nodeData.type === 'TEXT' && nodeData.textData && !createdNode) {
            try {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
                const fb = figma.createText();
                fb.name = nodeData.name || 'Text';
                fb.characters = nodeData.textData.characters || ' ';
                fb.fontSize = nodeData.textData.fontSize || 14;
                if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
                    fb.fills = nodeData.styles.fills.map((f) => ({
                        type: 'SOLID',
                        color: { r: f.r, g: f.g, b: f.b },
                        opacity: f.a !== undefined ? f.a : 1
                    }));
                }
                else {
                    fb.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 }, opacity: 1 }];
                }
                createdNode = fb;
            }
            catch (_fbErr) {
                console.error('Fallback de texto también falló:', _fbErr);
            }
        }
    }
    return createdNode;
}
// Receptor de eventos de Figma UI
figma.ui.onmessage = async (msg) => {
    // Código de vinculación con el hub: se pide una vez y se guarda en el almacenamiento local de Figma
    if (msg.type === 'GET_PAIRING_CODE') {
        let code = '';
        try {
            code = (await figma.clientStorage.getAsync('hubPairingCode')) || '';
        }
        catch (_e) { }
        figma.ui.postMessage({ type: 'PAIRING_CODE', code });
        return;
    }
    if (msg.type === 'SET_PAIRING_CODE') {
        try {
            await figma.clientStorage.setAsync('hubPairingCode', String(msg.code || ''));
        }
        catch (_e) { }
        return;
    }
    if (msg.type === 'CLEAR_PAGE') {
        for (const child of figma.currentPage.children) {
            child.remove();
        }
        return;
    }
    if (msg.type === 'DELETE_NODE' && msg.nodeId) {
        try {
            const node = figma.getNodeById(msg.nodeId);
            if (node && !node.removed) {
                const name = node.name;
                node.remove();
                figma.ui.postMessage({
                    type: 'LOG',
                    message: `"${name}" eliminado del lienzo de Figma`,
                    level: 'info'
                });
            }
        }
        catch (delErr) {
            console.warn('Error al borrar nodo:', delErr);
        }
        return;
    }
    if (msg.type === 'DELETE_MULTIPLE_NODES' && Array.isArray(msg.nodeIds)) {
        try {
            let count = 0;
            for (const id of msg.nodeIds) {
                const node = figma.getNodeById(id);
                if (node && !node.removed) {
                    node.remove();
                    count++;
                }
            }
            figma.ui.postMessage({
                type: 'LOG',
                message: `${count} componentes eliminados del lienzo de Figma`,
                level: 'info'
            });
        }
        catch (batchDelErr) {
            console.warn('Error al borrar nodos múltiples:', batchDelErr);
        }
        return;
    }
    if (msg.type === 'ZOOM_ALL') {
        if (figma.currentPage.children.length > 0) {
            figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
        }
        return;
    }
    if (msg.type === 'GET_PAGE_INFO') {
        figma.ui.postMessage({
            type: 'PAGE_INFO',
            pageName: figma.currentPage.name
        });
        return;
    }
    if (msg.type === 'FOCUS_NODE' && msg.nodeId) {
        try {
            const node = figma.getNodeById(msg.nodeId);
            if (node) {
                figma.currentPage.selection = [node];
                figma.viewport.scrollAndZoomIntoView([node]);
            }
        }
        catch (_e) { }
        return;
    }
    if (msg.type === 'CONVERT_TO_COMPONENT' && msg.nodeId) {
        try {
            const node = figma.getNodeById(msg.nodeId);
            if (node && node.type === 'FRAME') {
                const comp = figma.createComponent();
                comp.name = node.name;
                comp.x = node.x;
                comp.y = node.y;
                comp.resize(node.width, node.height);
                comp.layoutMode = node.layoutMode;
                comp.primaryAxisAlignItems = node.primaryAxisAlignItems;
                comp.counterAxisAlignItems = node.counterAxisAlignItems;
                comp.itemSpacing = node.itemSpacing;
                comp.paddingTop = node.paddingTop;
                comp.paddingRight = node.paddingRight;
                comp.paddingBottom = node.paddingBottom;
                comp.paddingLeft = node.paddingLeft;
                comp.fills = node.fills;
                comp.strokes = node.strokes;
                comp.strokeWeight = node.strokeWeight;
                comp.cornerRadius = node.cornerRadius;
                comp.effects = node.effects;
                while (node.children.length > 0) {
                    comp.appendChild(node.children[0]);
                }
                node.parent?.appendChild(comp);
                node.remove();
                figma.currentPage.selection = [comp];
                figma.viewport.scrollAndZoomIntoView([comp]);
                figma.ui.postMessage({
                    type: 'LOG',
                    message: `Frame "${comp.name}" convertido a Componente nativo de Figma`,
                    level: 'success'
                });
            }
        }
        catch (convErr) {
            figma.ui.postMessage({
                type: 'LOG',
                message: `Error al convertir a componente: ${convErr.message}`,
                level: 'error'
            });
        }
        return;
    }
    if (msg.type === 'RENDER_NODES') {
        try {
            const payload = msg.payload;
            const rootNode = payload?.rootNode || (Array.isArray(payload?.nodes) ? payload.nodes[0] : null);
            if (!payload || !rootNode) {
                throw new Error('Payload vacío o inválido (se esperaba rootNode o nodes[0])');
            }
            payload.rootNode = rootNode;
            const invalid = guardRenderPayload(rootNode);
            if (invalid)
                throw new Error(`Payload inválido: ${invalid}`);
            let targetPage = figma.currentPage;
            // Soporte para crear o cambiar de página en Figma por pestaña
            if (payload.pageName) {
                const found = figma.root.children.find(p => p.name === payload.pageName);
                if (found) {
                    targetPage = found;
                }
                else {
                    const newPage = figma.createPage();
                    newPage.name = payload.pageName;
                    targetPage = newPage;
                }
                figma.currentPage = targetPage;
            }
            // Preservar elementos existentes en el canvas de Figma (no borrar el trabajo del usuario)
            if (false && payload.clearPage) {
                for (const child of targetPage.children) {
                    child.remove();
                }
            }
            // Si se solicita crear como componente raíz oficial de Figma
            if (payload.createAsComponent) {
                payload.rootNode.type = 'COMPONENT';
            }
            // 🎨 Extracción y Creación Automática de Design Tokens en Figma
            let createdTokensCount = 0;
            if (payload.tokens?.colors && typeof figma.createPaintStyle === 'function') {
                for (const [tokenName, rgba] of Object.entries(payload.tokens.colors)) {
                    try {
                        const cleanName = 'Token / ' + tokenName.replace(/^--/, '');
                        const existing = figma.getLocalPaintStyles().find(s => s.name === cleanName);
                        const style = existing || figma.createPaintStyle();
                        style.name = cleanName;
                        style.paints = [{
                                type: 'SOLID',
                                color: { r: rgba.r, g: rgba.g, b: rgba.b },
                                opacity: rgba.a !== undefined ? rgba.a : 1
                            }];
                        createdTokensCount++;
                    }
                    catch (_tokErr) { }
                }
            }
            // ⚡ Optimización Ultra-Lite: Pre-calentar fuentes tipográficas antes de pintar (Inter Regular siempre garantizada)
            try {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            }
            catch (_e) { }
            await prewarmFonts(payload.rootNode);
            // 🗂️ Landing completa / multi-selección → tablero tipo design system
            if (payload.board) {
                const boardStart = Date.now();
                const pageBefore = figma.currentPage;
                const nodesBefore = new Set(pageBefore.children.map(c => c.id));
                const pagesBefore = new Set(figma.root.children.map(p => p.id));
                let board = null;
                try {
                    board = await buildDesignBoard(payload);
                }
                catch (boardErr) {
                    // Exportar nunca debe quedar bloqueado: limpiar restos del tablero y dibujar en modo normal
                    BOARD_CTX = null;
                    try {
                        figma.currentPage = pageBefore;
                    }
                    catch (_e) {
                        try {
                            await figma.setCurrentPageAsync(pageBefore);
                        }
                        catch (_e2) { }
                    }
                    for (const p of [...figma.root.children]) {
                        if (!pagesBefore.has(p.id)) {
                            try {
                                p.remove();
                            }
                            catch (_e) { }
                        }
                    }
                    for (const c of [...pageBefore.children]) {
                        if (!nodesBefore.has(c.id)) {
                            try {
                                c.remove();
                            }
                            catch (_e) { }
                        }
                    }
                    console.error('Tablero falló:', boardErr);
                    figma.ui.postMessage({
                        type: 'LOG', level: 'error',
                        message: `No se pudo organizar como tablero (${boardErr?.message || boardErr}). Se dibuja en modo normal.`
                    });
                }
                if (board) {
                    figma.currentPage.selection = [board.main];
                    figma.ui.postMessage({
                        type: 'LOG',
                        level: 'success',
                        message: `Tablero creado en "${board.page.name}": ${board.components} componentes enlazados, secciones y estilos organizados`
                    });
                    figma.ui.postMessage({
                        type: 'RENDER_SUCCESS',
                        nodeId: board.main.id,
                        name: board.main.name,
                        nodeCount: board.nodeCount,
                        pageName: board.page.name,
                        width: Math.round(board.main.width),
                        height: Math.round(board.main.height),
                        nodeType: board.main.type,
                        tokensCount: createdTokensCount,
                        rawPayload: payload.rootNode,
                        durationMs: Date.now() - boardStart
                    });
                    return;
                }
            }
            const totalNodeCount = countNodes(payload.rootNode);
            const renderStartTime = Date.now();
            const rootFigmaNode = await buildFigmaNode(payload.rootNode);
            const durationMs = Date.now() - renderStartTime;
            if (rootFigmaNode) {
                targetPage.appendChild(rootFigmaNode);
                // Posicionamiento inteligente: coordenadas explícitas o al lado del último frame
                if (payload.targetCanvasPosition) {
                    rootFigmaNode.x = payload.targetCanvasPosition.x;
                    rootFigmaNode.y = payload.targetCanvasPosition.y;
                    // Sección header: título de grupo de menú de navegación (alejado del nombre nativo del frame)
                    if (payload.sectionTitle) {
                        try {
                            const headerFont = await loadFontSafely('Inter', 700);
                            const headerText = figma.createText();
                            headerText.fontName = headerFont;
                            headerText.characters = payload.sectionTitle;
                            headerText.fontSize = 18;
                            headerText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.5 }, opacity: 0.9 }];
                            headerText.x = payload.targetCanvasPosition.x;
                            headerText.y = payload.targetCanvasPosition.y - 65;
                            targetPage.appendChild(headerText);
                        }
                        catch (_hdrErr) { }
                    }
                }
                else {
                    // Posicionamiento inteligente: A su lado (Horizontal) o Debajo (Vertical)
                    const GAP = Number(payload.placementGap) || 120;
                    const placementMode = (payload.placementMode || 'SIDE').toUpperCase();
                    const otherChildren = targetPage.children.filter(child => child.id !== rootFigmaNode.id);
                    if (otherChildren.length === 0 || placementMode === 'CENTER') {
                        // Primer elemento en la página o centrado explícito
                        const center = figma.viewport.center;
                        rootFigmaNode.x = Math.round(center.x - (rootFigmaNode.width / 2));
                        rootFigmaNode.y = Math.round(center.y - (rootFigmaNode.height / 2));
                    }
                    else if (placementMode === 'BELOW') {
                        // Colocar DEBAJO (Vertical):
                        // Si el usuario tenía un elemento seleccionado antes de renderizar, colocar debajo de ese;
                        // de lo contrario, buscar el elemento con mayor y + height de la página.
                        const selected = targetPage.selection.find(s => s.id !== rootFigmaNode.id);
                        if (selected) {
                            rootFigmaNode.x = Math.round(selected.x);
                            rootFigmaNode.y = Math.round(selected.y + selected.height + GAP);
                        }
                        else {
                            let maxBottom = -Infinity;
                            let alignX = otherChildren[0].x;
                            for (const child of otherChildren) {
                                const bottom = child.y + child.height;
                                if (bottom > maxBottom) {
                                    maxBottom = bottom;
                                    alignX = child.x;
                                }
                            }
                            rootFigmaNode.x = Math.round(alignX);
                            rootFigmaNode.y = Math.round(maxBottom + GAP);
                        }
                    }
                    else {
                        // Colocar A SU LADO (Horizontal / SIDE - Predeterminado):
                        // Si el usuario tenía un elemento seleccionado, colocar a la derecha de ese elemento;
                        // de lo contrario, buscar el elemento con mayor x + width de la página.
                        const selected = targetPage.selection.find(s => s.id !== rootFigmaNode.id);
                        if (selected) {
                            rootFigmaNode.x = Math.round(selected.x + selected.width + GAP);
                            rootFigmaNode.y = Math.round(selected.y);
                        }
                        else {
                            let maxRight = -Infinity;
                            let alignY = otherChildren[0].y;
                            for (const child of otherChildren) {
                                const right = child.x + child.width;
                                if (right > maxRight) {
                                    maxRight = right;
                                    alignY = child.y;
                                }
                            }
                            rootFigmaNode.x = Math.round(maxRight + GAP);
                            rootFigmaNode.y = Math.round(alignY);
                        }
                    }
                }
                // Enfocar vista en el nuevo componente
                figma.viewport.scrollAndZoomIntoView([rootFigmaNode]);
                targetPage.selection = [rootFigmaNode];
                figma.ui.postMessage({
                    type: 'RENDER_SUCCESS',
                    nodeId: rootFigmaNode.id,
                    name: rootFigmaNode.name,
                    nodeCount: totalNodeCount,
                    pageName: targetPage.name,
                    width: Math.round(rootFigmaNode.width),
                    height: Math.round(rootFigmaNode.height),
                    nodeType: rootFigmaNode.type,
                    tokensCount: createdTokensCount,
                    rawPayload: payload.rootNode,
                    durationMs
                });
            }
            else {
                throw new Error('No se pudo generar el nodo raíz');
            }
        }
        catch (err) {
            console.error('Fallo en RENDER_NODES:', err);
            figma.ui.postMessage({
                type: 'RENDER_ERROR',
                error: err.message || String(err)
            });
        }
    }
};
