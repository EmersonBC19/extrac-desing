/**
 * Tablero tipo design system: Página completa → Secciones → Componentes → Estilos.
 */
import { setBoardCtx, type BoardContext } from './context';
import { loadFontSafely } from '../fonts';
import { countNodes, buildFigmaNode } from '../render';
import {
  boardColorKey,
  boardDetectComponents,
  boardCollect,
  boardMergeSimilarColors,
  boardVariantFamilies,
  type PaletteEntry,
} from './pure';
import {
  boundSolidPaint,
  collectNumericTokens,
  colorVariable,
  newCollection,
  numberVariable,
  variablesAvailable,
  type NumericUse,
} from './variables';
import { base64ToBytes } from '../paint';

/** Crea una instancia del maestro y le aplica el contenido propio (textos, imágenes, tamaño) */
export async function buildBoardInstance(nodeData: any, master: ComponentNode): Promise<InstanceNode> {
  const inst = master.createInstance();
  inst.name = nodeData.name || master.name;

  // Textos: emparejados en orden DFS (misma firma ⇒ misma estructura)
  const dataTexts = boardCollect(nodeData, (x: any) => x.type === 'TEXT');
  const figTexts = inst.findAll(n => n.type === 'TEXT') as TextNode[];
  if (dataTexts.length === figTexts.length) {
    for (let i = 0; i < figTexts.length; i++) {
      const want = dataTexts[i].textData?.characters ?? '';
      const tn = figTexts[i];
      if (tn.characters === want) continue;
      try {
        const fonts = tn.characters.length
          ? tn.getRangeAllFontNames(0, tn.characters.length)
          : [tn.fontName as FontName];
        for (const f of fonts) await figma.loadFontAsync(f);
        tn.characters = want || ' ';
      } catch (_e) {}
    }
  }

  // Imágenes: emparejadas en orden DFS
  const dataImgs = boardCollect(nodeData, (x: any) => !!x.imageData);
  const figImgs = inst.findAll(
    n => 'fills' in n && Array.isArray((n as any).fills) && ((n as any).fills as Paint[]).some(p => p.type === 'IMAGE'),
  ) as (SceneNode & MinimalFillsMixin)[];
  if (dataImgs.length === figImgs.length) {
    for (let i = 0; i < figImgs.length; i++) {
      try {
        const image = figma.createImage(base64ToBytes(dataImgs[i].imageData));
        figImgs[i].fills = (figImgs[i].fills as Paint[]).map(p =>
          p.type === 'IMAGE' ? { ...(p as ImagePaint), imageHash: image.hash } : p,
        );
      } catch (_e) {}
    }
  }

  const w =
    nodeData.layout?.measuredWidth ?? (typeof nodeData.layout?.width === 'number' ? nodeData.layout.width : inst.width);
  const h =
    nodeData.layout?.measuredHeight ??
    (typeof nodeData.layout?.height === 'number' ? nodeData.layout.height : inst.height);
  try {
    if (w > 0 && h > 0) inst.resize(w, h);
  } catch (_e) {}
  return inst;
}

/**
 * Elige los bloques principales (header, hero, cada sección, footer…) para mostrarlos como
 * sub-vistas. Un bloque alto que contiene varias secciones (ej. <main> con 9 <section>) se
 * reemplaza por sus secciones, para no mandar media página como una sola sub-vista.
 */
export function boardPickSections(root: SceneNode): SceneNode[] {
  const bigKids = (n: SceneNode): SceneNode[] => {
    if (!('children' in n)) return [];
    return (n as ChildrenMixin & SceneNode).children
      .filter(c => c.visible !== false && c.type !== 'TEXT' && c.height >= 60 && c.width >= n.width * 0.4)
      .sort((a, b) => a.y - b.y);
  };
  const SECTION_MAX_H = 1400; // más alto que esto y con varias secciones dentro → se divide

  function expand(n: SceneNode, depth: number): SceneNode[] {
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
  for (let depth = 0; top.length === 1 && depth < 5; depth++) top = bigKids(top[0]);
  return top.flatMap(k => expand(k, 0));
}

/** Titular de un bloque: el texto de mayor tamaño entre los primeros textos (para titular la sub-vista) */
export function boardHeadingOf(n: SceneNode): string {
  if (!('findAll' in n)) return '';
  const texts = (n as ChildrenMixin).findAll(c => c.type === 'TEXT').slice(0, 12) as TextNode[];
  let best: TextNode | null = null;
  for (const t of texts) {
    const fs = typeof t.fontSize === 'number' ? t.fontSize : 0;
    const bestFs = best && typeof best.fontSize === 'number' ? best.fontSize : -1;
    if (t.characters.trim().length > 2 && fs > bestFs) best = t;
  }
  const s = best ? best.characters.replace(/\s+/g, ' ').trim() : '';
  return s.length > 48 ? s.slice(0, 47) + '…' : s;
}

export async function boardLabel(
  text: string,
  size: number,
  weight: number,
  color: RGB,
  opacity = 1,
): Promise<TextNode> {
  const font = await loadFontSafely('Inter', weight);
  const t = figma.createText();
  t.fontName = font;
  t.characters = text;
  t.fontSize = size;
  t.fills = [{ type: 'SOLID', color, opacity }];
  return t;
}

export function boardNewSection(name: string): SectionNode | FrameNode {
  if (typeof (figma as any).createSection === 'function') {
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
export function boardFitSection(sec: SectionNode | FrameNode, pad = 100) {
  const kids = sec.children as SceneNode[];
  if (!kids.length) {
    try {
      (sec as any).resizeWithoutConstraints(400, 200);
    } catch (_e) {}
    return;
  }
  const maxR = Math.max(...kids.map(k => k.x + k.width));
  const maxB = Math.max(...kids.map(k => k.y + k.height));
  try {
    (sec as any).resizeWithoutConstraints(Math.max(400, maxR + pad), Math.max(200, maxB + pad));
  } catch (_e) {
    try {
      (sec as FrameNode).resize(Math.max(400, maxR + pad), Math.max(200, maxB + pad));
    } catch (_e2) {}
  }
}

export function insideInstance(n: BaseNode): boolean {
  for (let p = n.parent; p; p = p.parent) if (p.type === 'INSTANCE') return true;
  return false;
}

/**
 * Crea estilos de texto y de color A PARTIR DE LO QUE SE DIBUJÓ (fuentes ya resueltas en Figma),
 * los vincula a las capas y genera muestras visuales en la Section de estilos.
 */
export async function boardBuildStyles(scope: SceneNode[], stylesSec: SectionNode | FrameNode, prefix: string) {
  const PAD = 100;
  const textNodes: TextNode[] = [];
  const fillNodes: (SceneNode & MinimalFillsMixin)[] = [];
  for (const s of scope) {
    // La raíz también cuenta (fondo de la página, de cada sección y de cada componente)
    const nodes = [s, ...('findAll' in s ? (s as ChildrenMixin).findAll(() => true) : [])];
    for (const n of nodes) {
      if (n.type === 'INSTANCE' || insideInstance(n)) continue; // las instancias heredan del maestro
      if (n.type === 'COMPONENT_SET') continue; // el marco del set no es parte del diseño
      if (n.type === 'TEXT') textNodes.push(n as TextNode);
      else if ('fills' in n && (n as any).fills !== figma.mixed) fillNodes.push(n as any);
    }
  }

  // ── Tipografía: agrupar por fuente + tamaño + interlineado ──
  const tGroups = new Map<string, { font: FontName; size: number; lh: LineHeight; nodes: TextNode[] }>();
  for (const tn of textNodes) {
    if (tn.fontName === figma.mixed || tn.fontSize === figma.mixed || tn.lineHeight === figma.mixed) continue;
    const f = tn.fontName as FontName;
    const lh = tn.lineHeight as LineHeight;
    const lhKey = lh.unit === 'AUTO' ? 'auto' : Math.round(lh.value);
    const key = `${f.family}|${f.style}|${tn.fontSize}|${lhKey}`;
    if (!tGroups.has(key)) tGroups.set(key, { font: f, size: tn.fontSize as number, lh, nodes: [] });
    tGroups.get(key)!.nodes.push(tn);
  }
  const typeScale = [...tGroups.values()]
    .sort((a, b) => b.size - a.size || b.nodes.length - a.nodes.length)
    .slice(0, 24);

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
        } catch (_e) {}
      }
      const sample = figma.createText();
      sample.fontName = g.font;
      sample.characters = `${Math.round(g.size)} · ${g.font.family} ${g.font.style} — Aa Bb 123`;
      sample.fontSize = Math.min(g.size, 72);
      try {
        sample.textStyleId = st.id;
      } catch (_e) {}
      sample.fontSize = Math.min(g.size, 72);
      stylesSec.appendChild(sample);
      sample.x = PAD;
      sample.y = y;
      const meta = await boardLabel(`${st.name.split('/').slice(-1)[0]} · ${g.nodes.length} usos`, 12, 400, {
        r: 0.45,
        g: 0.45,
        b: 0.5,
      });
      stylesSec.appendChild(meta);
      meta.x = PAD;
      meta.y = y + sample.height + 6;
      y += sample.height + 48;
    } catch (_e) {}
  }

  // ── Colores sólidos (fases 6.2 y 6.3) ──
  // Agrupados por diferencia perceptual (colores que el ojo no distingue → uno) y convertidos en
  // Variables de Figma vinculadas a las capas. Sin API de Variables: Paint Styles, como antes.
  const exact = new Map<string, PaletteEntry<SceneNode & MinimalFillsMixin>>();
  for (const n of [...fillNodes, ...textNodes]) {
    const fills = (n as any).fills;
    if (!Array.isArray(fills) || fills.length !== 1 || fills[0].type !== 'SOLID' || fills[0].visible === false)
      continue;
    const p = fills[0] as SolidPaint;
    const alpha = p.opacity ?? 1;
    const key = boardColorKey({ ...p.color, a: alpha });
    if (!exact.has(key)) exact.set(key, { color: p.color, alpha, items: [] });
    exact.get(key)!.items.push(n as any);
  }
  const palette = boardMergeSimilarColors([...exact.values()]).slice(0, 48);
  const useVariables = variablesAvailable();
  let vars: { collection: VariableCollection; modeId: string } | null = null;
  if (useVariables) {
    try {
      vars = newCollection(prefix);
    } catch (varErr: any) {
      figma.ui.postMessage({
        type: 'LOG',
        level: 'warn',
        message: `Variables no disponibles en este archivo (${varErr?.message || varErr}): se usan estilos de color.`,
      });
    }
  }

  const cx = 1100;
  let cy = PAD;
  const ctitle = await boardLabel(vars ? 'Colores · Variables' : 'Colores', 32, 700, { r: 0.1, g: 0.1, b: 0.12 });
  stylesSec.appendChild(ctitle);
  ctitle.x = cx;
  ctitle.y = cy;
  cy += 70;
  let col = 0;
  for (const g of palette) {
    try {
      const hex = boardColorKey({ ...g.color, a: g.alpha });
      const base: SolidPaint = { type: 'SOLID', color: g.color, opacity: g.alpha };
      let paint: SolidPaint = base;
      let bindNode: (n: SceneNode & MinimalFillsMixin) => void;
      if (vars) {
        const variable = colorVariable(vars.collection, vars.modeId, `Color/${hex.replace('#', '')}`, g.color);
        paint = boundSolidPaint(base, variable);
        bindNode = n => {
          (n as any).fills = [paint];
        };
      } else {
        const st = figma.createPaintStyle();
        st.name = `${prefix}/Color/${hex}`;
        st.paints = [base];
        bindNode = n => {
          (n as any).fillStyleId = st.id;
        };
      }
      for (const n of g.items) {
        try {
          bindNode(n);
        } catch (_e) {}
      }
      const sw = figma.createRectangle();
      sw.resize(120, 120);
      sw.cornerRadius = 12;
      sw.fills = [paint];
      sw.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];
      const x = cx + col * 150,
        yy = cy;
      stylesSec.appendChild(sw);
      sw.x = x;
      sw.y = yy;
      const lbl = await boardLabel(`${hex}\n${g.items.length} usos`, 11, 500, { r: 0.3, g: 0.3, b: 0.35 });
      stylesSec.appendChild(lbl);
      lbl.x = x;
      lbl.y = yy + 128;
      col++;
      if (col === 6) {
        col = 0;
        cy += 190;
      }
    } catch (_e) {}
  }
  if (col > 0) cy += 190;

  // ── Espaciados y radios repetidos → Variables numéricas vinculadas (fase 6.2) ──
  if (vars) {
    const frames: SceneNode[] = [];
    for (const s of scope) {
      if ((s as any).layoutMode !== undefined && !insideInstance(s)) frames.push(s);
      if ('findAll' in s)
        for (const n of (s as ChildrenMixin).findAll(x => x.type === 'FRAME' || x.type === 'COMPONENT'))
          if (!insideInstance(n)) frames.push(n);
    }
    const { spacing, radius } = collectNumericTokens(frames);
    const groups: [string, [number, NumericUse[]][], VariableScope[]][] = [
      ['Espaciado', spacing.slice(0, 16), ['GAP']],
      ['Radio', radius.slice(0, 12), ['CORNER_RADIUS']],
    ];
    for (const [label, entries, scopes] of groups) {
      if (!entries.length) continue;
      cy += 40;
      const t = await boardLabel(`${label} · Variables`, 24, 700, { r: 0.1, g: 0.1, b: 0.12 });
      stylesSec.appendChild(t);
      t.x = cx;
      t.y = cy;
      cy += 50;
      for (const [value, uses] of entries) {
        try {
          const v = numberVariable(vars.collection, vars.modeId, `${label}/${value}`, value, scopes);
          for (const u of uses) {
            try {
              (u.node as any).setBoundVariable(u.field, v);
            } catch (_e) {}
          }
          const row = await boardLabel(`${label}/${value}  ·  ${value} px  ·  ${uses.length} usos`, 13, 500, {
            r: 0.3,
            g: 0.3,
            b: 0.35,
          });
          stylesSec.appendChild(row);
          row.x = cx;
          row.y = cy;
          cy += 26;
        } catch (_e) {}
      }
    }
  }
}

/** Primer relleno sólido visible de un ancestro: el fondo que la sección hereda en la página */
function inheritedBackground(n: SceneNode): Paint[] | null {
  for (let p = n.parent; p && p.type !== 'PAGE' && p.type !== 'SECTION'; p = p.parent) {
    const fills = (p as any).fills;
    if (
      Array.isArray(fills) &&
      fills.some((f: Paint) => f.visible !== false && (f.type !== 'SOLID' || (f.opacity ?? 1) > 0.05))
    )
      return fills.filter((f: Paint) => f.visible !== false);
  }
  return null;
}

/**
 * Convierte la copia de una sección en componente y pone una instancia en el lugar del bloque
 * original de la vista completa (misma posición, tamaño y comportamiento en el Auto Layout).
 * Devuelve el componente, o null si no se pudo (la copia queda tal cual).
 */
function sectionToComponent(original: SceneNode, copy: SceneNode, title: string): ComponentNode | null {
  if (typeof (figma as any).createComponentFromNode !== 'function') return null;
  if (original.type !== 'FRAME' || copy.type !== 'FRAME' || insideInstance(original)) return null;
  const parent = original.parent as (BaseNode & ChildrenMixin) | null;
  if (!parent || !('children' in parent)) return null;
  try {
    // QA-2: sin fondo propio, la sección se veía transparente fuera de la página → fondo heredado
    const own = (copy as FrameNode).fills;
    if (Array.isArray(own) && !own.some(f => f.visible !== false)) {
      const bg = inheritedBackground(original);
      if (bg) (copy as FrameNode).fills = bg;
    }
    const comp = figma.createComponentFromNode(copy);
    comp.name = `Sección / ${title}`.slice(0, 120);
    const inst = comp.createInstance();
    parent.insertChild(parent.children.indexOf(original), inst);
    const o = original as FrameNode;
    inst.x = o.x;
    inst.y = o.y;
    try {
      inst.resize(o.width, o.height); // primero el tamaño: resize deja el sizing en FIXED
    } catch (_e) {}
    try {
      if ('layoutPositioning' in o) inst.layoutPositioning = o.layoutPositioning;
      const auto = (parent as any).layoutMode && (parent as any).layoutMode !== 'NONE';
      if (auto && o.layoutPositioning !== 'ABSOLUTE') {
        inst.layoutSizingHorizontal = o.layoutSizingHorizontal === 'HUG' ? 'FIXED' : o.layoutSizingHorizontal;
        inst.layoutSizingVertical = o.layoutSizingVertical === 'HUG' ? 'FIXED' : o.layoutSizingVertical;
      }
    } catch (_e) {}
    original.remove();
    return comp;
  } catch (_e) {
    return null;
  }
}

/**
 * Construye el tablero completo. Devuelve el nodo de la vista completa (para el mensaje de éxito).
 */
export async function buildDesignBoard(
  payload: any,
): Promise<{ main: SceneNode; nodeCount: number; components: number; page: PageNode }> {
  const root = payload.rootNode;
  root.type = 'FRAME'; // el tablero gestiona sus propios componentes
  let host = 'Landing';
  try {
    host = new URL(payload.source?.url || '').hostname.replace(/^www\./, '') || host;
  } catch (_e) {}
  const prefix = host;

  // El tablero se arma en la PÁGINA ACTUAL, a la derecha de lo que ya hay. No se crean ni se
  // cambian páginas: el plan gratuito limita las páginas por archivo, y Figma crea los nodos
  // nuevos (createX, clone) en la página actual; cambiar de página dejaba copias sueltas.
  const page: PageNode = figma.currentPage;
  const others = page.children;
  const originX = others.length ? Math.round(Math.max(...others.map(c => c.x + c.width)) + 400) : 0;
  const originY = others.length ? Math.round(Math.min(...others.map(c => c.y))) : 0;
  const progress = (message: string) =>
    figma.ui.postMessage({ type: 'LOG', level: 'info', message: `Tablero · ${message}` });

  // 1. Detectar componentes repetidos y construir los maestros
  const groups = boardDetectComponents(root);
  const compSec = boardNewSection('03 · Componentes');
  page.appendChild(compSec);
  const ctx: BoardContext = { masters: new Map() };
  setBoardCtx(ctx);
  const usesOf = new Map<string, number>();
  for (const g of groups) {
    let built: SceneNode | null = null;
    try {
      const data = JSON.parse(JSON.stringify(g.occurrences[0]));
      (function strip(n: any) {
        delete n.__cg;
        (n.children || []).forEach(strip);
      })(data);
      data.type = 'COMPONENT';
      data.name = g.name;
      data.layout = { ...data.layout, positioning: 'AUTO', x: 0, y: 0 };
      built = await buildFigmaNode(data);
      if (!built || built.type !== 'COMPONENT') throw new Error('no se generó como componente');
      const master = built as ComponentNode;
      compSec.appendChild(master);
      master.description = `${g.occurrences.length} usos en ${host}`;
      usesOf.set(g.id, g.occurrences.length);
      ctx.masters.set(g.id, master);
    } catch (compErr: any) {
      // Sin maestro, sus usos se dibujan como copias normales
      if (built && !built.removed) {
        try {
          built.remove();
        } catch (_e) {}
      }
      figma.ui.postMessage({
        type: 'LOG',
        level: 'warn',
        message: `Componente "${g.name}" omitido: ${compErr?.message || compErr}`,
      });
    }
  }

  // 1b. Variantes (fase 6.1): "Tile", "Tile 2", "Tile 3" con la misma forma → un Component Set
  const items: { node: SceneNode; label: string }[] = [];
  const inSet = new Set<string>();
  let variantSets = 0;
  for (const fam of boardVariantFamilies(groups)) {
    const members = fam.members.filter(m => ctx.masters.has(m.groupId));
    if (members.length < 2 || typeof (figma as any).combineAsVariants !== 'function') continue;
    try {
      const masters = members.map(m => {
        const master = ctx.masters.get(m.groupId)!;
        master.name = `${fam.property}=${m.value}`;
        return master;
      });
      const set = figma.combineAsVariants(masters, compSec);
      set.name = fam.name;
      // Variantes en fila, con aire, como las presenta un design system
      set.layoutMode = 'HORIZONTAL';
      set.primaryAxisSizingMode = 'AUTO';
      set.counterAxisSizingMode = 'AUTO';
      set.counterAxisAlignItems = 'CENTER';
      set.itemSpacing = 40;
      set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 32;
      const uses = members.reduce((a, m) => a + (usesOf.get(m.groupId) || 0), 0);
      items.push({ node: set, label: `${fam.name} · ${members.length} variantes (${fam.property}) · ${uses} usos` });
      members.forEach(m => inSet.add(m.groupId));
      variantSets++;
    } catch (setErr: any) {
      figma.ui.postMessage({
        type: 'LOG',
        level: 'warn',
        message: `Variantes de "${fam.name}" no agrupadas: ${setErr?.message || setErr}`,
      });
    }
  }
  for (const g of groups) {
    const master = ctx.masters.get(g.id);
    if (master && !inSet.has(g.id)) items.push({ node: master, label: `${g.name} · ${usesOf.get(g.id) || 0} usos` });
  }

  // 1c. Grilla de 03 · Componentes: cada componente (o set de variantes) con su etiqueta
  let gx = 100,
    gy = 100,
    rowH = 0;
  const MAX_ROW = 2600;
  for (const item of items) {
    const n = item.node;
    if (gx > 100 && gx + n.width > MAX_ROW) {
      gx = 100;
      gy += rowH + 140;
      rowH = 0;
    }
    n.x = gx;
    n.y = gy + 40;
    const lbl = await boardLabel(item.label, 16, 600, { r: 0.33, g: 0.2, b: 0.8 });
    compSec.appendChild(lbl);
    lbl.x = gx;
    lbl.y = gy;
    gx += n.width + 120;
    rowH = Math.max(rowH, n.height + 40);
  }

  progress(
    `${ctx.masters.size} componentes creados` + (variantSets ? `, ${variantSets} agrupados como variantes` : ''),
  );

  // 2. Vista completa (usa instancias de los maestros)
  const fullSec = boardNewSection('01 · Página completa');
  page.appendChild(fullSec);
  const full = await buildFigmaNode(root);
  const componentCount = ctx.masters.size;
  setBoardCtx(null);
  if (!full) throw new Error('No se pudo generar la vista completa');
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
  const picked = isMulti ? [...(full as FrameNode).children] : boardPickSections(full);
  let subOk = 0;
  const sectionComponents: ComponentNode[] = [];
  for (let i = 0; i < picked.length; i++) {
    let clone: SceneNode | null = null;
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
      // Sección como componente + instancia en la vista completa: editar la sección en 02 actualiza
      // la página completa (fase 6.3). Si no se puede (API antigua, ya es instancia…), queda la copia.
      const asComponent = sectionToComponent(picked[i], clone, heading || picked[i].name);
      if (asComponent) {
        clone = asComponent;
        sectionComponents.push(asComponent);
      }
      sy += 44 + clone.height + 140;
      subOk++;
    } catch (subErr: any) {
      if (clone && clone.parent !== subSec) {
        try {
          clone.remove();
        } catch (_e) {}
      }
      figma.ui.postMessage({
        type: 'LOG',
        level: 'warn',
        message: `Sub-vista "${picked[i].name}" omitida: ${subErr?.message || subErr}`,
      });
    }
  }
  progress(`${subOk}/${picked.length} sub-vistas`);

  // 4. Estilos (texto + color) vinculados a las capas
  const stylesSec = boardNewSection('04 · Estilos');
  page.appendChild(stylesSec);
  await boardBuildStyles(
    [
      full,
      // Las secciones convertidas en componente: su contenido vive en el maestro, no en la instancia
      ...sectionComponents,
      ...(compSec.children.filter(c => c.type === 'COMPONENT' || c.type === 'COMPONENT_SET') as SceneNode[]),
    ],
    stylesSec,
    prefix,
  );

  // 5. Disposición horizontal: 01 → 02 → 03 → 04
  const order = [fullSec, subSec, compSec, stylesSec];
  for (const s of order) boardFitSection(s);
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
