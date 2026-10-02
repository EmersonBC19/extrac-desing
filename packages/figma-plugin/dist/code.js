"use strict";
// Code to Figma Native Painter Sandbox
// Iniciar UI flotante para WebSocket con nuevo tamaño
figma.showUI(__html__, {
    width: 340,
    height: 380,
    title: "⚡ Code to Figma AI Bridge"
});
// Normalizador seguro de fuentes tipográficas para Figma
const DEFAULT_FALLBACK_FONT = { family: "Inter", style: "Regular" };
function resolveFontWeight(weight) {
    const num = typeof weight === 'string' ? parseInt(weight, 10) : weight;
    if (isNaN(num)) {
        const lower = String(weight).toLowerCase();
        if (lower.includes('bold'))
            return 'Bold';
        if (lower.includes('medium'))
            return 'Medium';
        if (lower.includes('semibold'))
            return 'Semi Bold';
        if (lower.includes('light'))
            return 'Light';
        return 'Regular';
    }
    if (num >= 800)
        return 'Extra Bold';
    if (num >= 700)
        return 'Bold';
    if (num >= 600)
        return 'Semi Bold';
    if (num >= 500)
        return 'Medium';
    if (num >= 300)
        return 'Light';
    return 'Regular';
}
async function loadFontSafely(fontFamily, fontWeight) {
    const cleanFamily = fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
    const style = resolveFontWeight(fontWeight);
    const primaryTarget = { family: cleanFamily, style };
    try {
        await figma.loadFontAsync(primaryTarget);
        return primaryTarget;
    }
    catch (_e) {
        try {
            const regularTarget = { family: cleanFamily, style: "Regular" };
            await figma.loadFontAsync(regularTarget);
            return regularTarget;
        }
        catch (_e2) {
            try {
                await figma.loadFontAsync(DEFAULT_FALLBACK_FONT);
                return DEFAULT_FALLBACK_FONT;
            }
            catch (_e3) {
                const roboto = { family: "Roboto", style: "Regular" };
                await figma.loadFontAsync(roboto);
                return roboto;
            }
        }
    }
}
// Optimización: Pre-calentamiento / carga por lote de todas las fuentes del árbol en paralelo
async function prewarmFonts(node) {
    const fontsToLoad = new Set();
    function traverse(n) {
        if (n.type === 'TEXT' && n.textData) {
            const fam = n.textData.fontFamily?.split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
            const style = resolveFontWeight(n.textData.fontWeight || 400);
            fontsToLoad.add(`${fam}:::${style}`);
        }
        if (n.children) {
            for (const child of n.children)
                traverse(child);
        }
    }
    traverse(node);
    await Promise.all(Array.from(fontsToLoad).map(async (key) => {
        const [family, style] = key.split(':::');
        await loadFontSafely(family, style);
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
// Función recursiva constructora de nodos Figma
async function buildFigmaNode(nodeData) {
    let createdNode = null;
    try {
        if (nodeData.type === 'TEXT' && nodeData.textData) {
            const textNode = figma.createText();
            const font = await loadFontSafely(nodeData.textData.fontFamily, nodeData.textData.fontWeight);
            textNode.fontName = font;
            textNode.characters = nodeData.textData.characters || ' ';
            textNode.fontSize = Math.max(1, nodeData.textData.fontSize || 14);
            if (nodeData.textData.lineHeight && nodeData.textData.lineHeight > 0) {
                textNode.lineHeight = { value: nodeData.textData.lineHeight, unit: 'PIXELS' };
            }
            if (nodeData.textData.textAlign) {
                const alignMap = {
                    LEFT: 'LEFT',
                    CENTER: 'CENTER',
                    RIGHT: 'RIGHT',
                    JUSTIFIED: 'JUSTIFIED'
                };
                textNode.textAlignHorizontal = alignMap[nodeData.textData.textAlign] || 'LEFT';
            }
            // Fills de texto
            if (nodeData.styles?.fills && nodeData.styles.fills.length > 0) {
                textNode.fills = nodeData.styles.fills.map(f => ({
                    type: 'SOLID',
                    color: { r: f.r, g: f.g, b: f.b },
                    opacity: f.a !== undefined ? f.a : 1
                }));
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
                }
            }
            // Estilos de Relleno (Fills) e Imágenes Base64
            if (nodeData.imageData) {
                try {
                    const clean = nodeData.imageData.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                    const lookup = new Uint8Array(256);
                    for (let i = 0; i < chars.length; i++)
                        lookup[chars.charCodeAt(i)] = i;
                    let bufferLength = Math.floor(clean.length * 0.75);
                    if (clean.endsWith('=='))
                        bufferLength -= 2;
                    else if (clean.endsWith('='))
                        bufferLength -= 1;
                    const bytes = new Uint8Array(bufferLength);
                    let p = 0;
                    for (let i = 0; i < clean.length; i += 4) {
                        const encoded1 = lookup[clean.charCodeAt(i)];
                        const encoded2 = lookup[clean.charCodeAt(i + 1)];
                        const encoded3 = lookup[clean.charCodeAt(i + 2)];
                        const encoded4 = lookup[clean.charCodeAt(i + 3)];
                        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
                        if (clean[i + 2] !== '=')
                            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
                        if (clean[i + 3] !== '=')
                            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
                    }
                    const image = figma.createImage(bytes);
                    frame.fills = [{
                            type: 'IMAGE',
                            scaleMode: 'FILL',
                            imageHash: image.hash
                        }];
                }
                catch (_imgErr) {
                    console.warn('Error decodificando imagen base64:', _imgErr);
                }
            }
            else if (nodeData.styles?.fills) {
                frame.fills = nodeData.styles.fills.map(f => ({
                    type: 'SOLID',
                    color: { r: f.r, g: f.g, b: f.b },
                    opacity: f.a !== undefined ? f.a : 1
                }));
            }
            // Bordes (Strokes) y lados individuales
            if (nodeData.styles?.strokes && nodeData.styles.strokes.length > 0) {
                const stroke = nodeData.styles.strokes[0];
                frame.strokes = [{
                        type: 'SOLID',
                        color: { r: stroke.r, g: stroke.g, b: stroke.b },
                        opacity: stroke.a !== undefined ? stroke.a : 1
                    }];
                frame.strokeWeight = Math.max(1, stroke.width || 1);
                if (stroke.align) {
                    frame.strokeAlign = stroke.align;
                }
                // Lados individuales de borde si aplican
                if (nodeData.styles?.borderSides) {
                    const bs = nodeData.styles.borderSides;
                    if (typeof bs.top === 'number')
                        frame.strokeTopWeight = bs.top;
                    if (typeof bs.right === 'number')
                        frame.strokeRightWeight = bs.right;
                    if (typeof bs.bottom === 'number')
                        frame.strokeBottomWeight = bs.bottom;
                    if (typeof bs.left === 'number')
                        frame.strokeLeftWeight = bs.left;
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
            // Efectos (Box Shadows)
            if (nodeData.styles?.boxShadow && nodeData.styles.boxShadow.length > 0) {
                const effects = nodeData.styles.boxShadow.map(shadow => ({
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
                }));
                frame.effects = effects;
            }
            // Dimensiones iniciales si son fijas
            const initW = typeof nodeData.layout?.width === 'number' ? nodeData.layout.width : 100;
            const initH = typeof nodeData.layout?.height === 'number' ? nodeData.layout.height : 40;
            frame.resize(Math.max(1, initW), Math.max(1, initH));
            // Habilitar Clip Content en frames raíz para evitar desbordamiento de hijos
            if (nodeData.clipsContent) {
                frame.clipsContent = true;
            }
            // Procesar hijos recursivamente
            if (nodeData.children && nodeData.children.length > 0) {
                for (const childData of nodeData.children) {
                    const childNode = await buildFigmaNode(childData);
                    if (childNode) {
                        frame.appendChild(childNode);
                        // Ajustar sizing del hijo dentro del padre con Auto Layout
                        if (frame.layoutMode !== 'NONE') {
                            const layoutChild = childNode;
                            if (childData.layout?.width === 'FILL' && 'layoutSizingHorizontal' in layoutChild) {
                                layoutChild.layoutSizingHorizontal = 'FILL';
                            }
                            else if (childData.layout?.width === 'HUG' && 'layoutSizingHorizontal' in layoutChild) {
                                layoutChild.layoutSizingHorizontal = 'HUG';
                            }
                            if (childData.layout?.height === 'FILL' && 'layoutSizingVertical' in layoutChild) {
                                layoutChild.layoutSizingVertical = 'FILL';
                            }
                            else if (childData.layout?.height === 'HUG' && 'layoutSizingVertical' in layoutChild) {
                                layoutChild.layoutSizingVertical = 'HUG';
                            }
                            if (childData.layout?.positioning === 'ABSOLUTE' && 'layoutPositioning' in layoutChild) {
                                layoutChild.layoutPositioning = 'ABSOLUTE';
                                if (typeof childData.layout.x === 'number')
                                    childNode.x = childData.layout.x;
                                if (typeof childData.layout.y === 'number')
                                    childNode.y = childData.layout.y;
                            }
                        }
                        else {
                            // Posicionamiento en modo canvas libre (NONE)
                            if (typeof childData.layout?.x === 'number')
                                childNode.x = childData.layout.x;
                            if (typeof childData.layout?.y === 'number')
                                childNode.y = childData.layout.y;
                        }
                    }
                }
            }
            // Configurar Sizing del propio frame padre
            if (frame.layoutMode !== 'NONE') {
                if (nodeData.layout?.width === 'HUG') {
                    frame.layoutSizingHorizontal = 'HUG';
                }
                if (nodeData.layout?.height === 'HUG') {
                    frame.layoutSizingVertical = 'HUG';
                }
            }
            createdNode = frame;
        }
        if (createdNode) {
            createdNode.name = nodeData.name || createdNode.name;
        }
    }
    catch (error) {
        console.error('Error creando nodo Figma:', error);
    }
    return createdNode;
}
// Receptor de eventos de Figma UI
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'CLEAR_PAGE') {
        for (const child of figma.currentPage.children) {
            child.remove();
        }
        return;
    }
    if (msg.type === 'ZOOM_ALL') {
        if (figma.currentPage.children.length > 0) {
            figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
        }
        return;
    }
    if (msg.type === 'RENDER_NODES') {
        try {
            const payload = msg.payload;
            if (!payload || !payload.rootNode) {
                throw new Error('Payload vacío o inválido');
            }
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
            // Opcional: limpiar selección o elementos previos
            if (payload.clearPage) {
                for (const child of targetPage.children) {
                    child.remove();
                }
            }
            // ⚡ Optimización Ultra-Lite: Pre-calentar fuentes tipográficas antes de pintar
            await prewarmFonts(payload.rootNode);
            const totalNodeCount = countNodes(payload.rootNode);
            const rootFigmaNode = await buildFigmaNode(payload.rootNode);
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
                    let rightmostX = 0;
                    for (const child of targetPage.children) {
                        if (child.id !== rootFigmaNode.id) {
                            rightmostX = Math.max(rightmostX, child.x + child.width);
                        }
                    }
                    if (rightmostX > 0) {
                        rootFigmaNode.x = rightmostX + 160;
                        rootFigmaNode.y = 0;
                    }
                    else {
                        const center = figma.viewport.center;
                        rootFigmaNode.x = center.x - (rootFigmaNode.width / 2);
                        rootFigmaNode.y = center.y - (rootFigmaNode.height / 2);
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
                    pageName: targetPage.name
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
