/**
 * QA de diseño contra producción: el comando. El payload trae la extracción de la web (al ancho del
 * frame de diseño) y `compare.targetNodeId`, el frame con el que se compara. Resultado:
 *  - anotaciones sobre los nodos del diseño (las de Dev Mode; si el archivo no las admite, solo el informe);
 *  - el bloque de producción dibujado al lado del diseño, para verlo;
 *  - un informe en el lienzo ("QA · …") con cada diferencia, de la más grave a la menos;
 *  - el resumen en RENDER_SUCCESS (la extensión lo muestra).
 */
import type { Logger, PluginSandboxMessage } from '@code-to-figma/contracts';
import { compareTrees, hex, type CompareResult, type Finding } from './qa-compare';
import { buildFigmaNode } from './render';
import { base64ToBytes } from './paint';
import { loadFontSafely, prewarmFonts } from './fonts';
import { variablesAvailable } from './board/variables';

const QA_PREFIX = 'QA · ';

const SEVERITY_COLOR: Record<string, RGB> = {
  alta: { r: 0.86, g: 0.15, b: 0.15 },
  media: { r: 0.85, g: 0.47, b: 0.02 },
  baja: { r: 0.28, g: 0.4, b: 0.6 },
  info: { r: 0.45, g: 0.45, b: 0.5 },
};

/** Colores de las Variables del archivo (cualquier modo), para avisar valores fuera del sistema */
async function variableColors(): Promise<Set<string>> {
  const out = new Set<string>();
  if (!variablesAvailable()) return out;
  try {
    const V: any = figma.variables;
    const vars =
      typeof V.getLocalVariablesAsync === 'function'
        ? await V.getLocalVariablesAsync('COLOR')
        : V.getLocalVariables('COLOR');
    for (const v of vars) {
      const values = v.valuesByMode || v._values || {};
      for (const val of Object.values(values) as any[]) {
        if (val && typeof val.r === 'number') out.add(hex({ r: val.r, g: val.g, b: val.b, a: 1 }).slice(1));
      }
    }
  } catch (_e) {}
  return out;
}

function absolutePosition(node: SceneNode): { x: number; y: number } {
  const bb = (node as any).absoluteBoundingBox;
  if (bb && typeof bb.x === 'number') return { x: bb.x, y: bb.y };
  let x = 0;
  let y = 0;
  for (let n: any = node; n && n.type !== 'PAGE' && n.type !== 'DOCUMENT'; n = n.parent) {
    x += n.x || 0;
    y += n.y || 0;
  }
  return { x, y };
}

/** Quita las anotaciones de una comparación anterior (las que empiezan por "QA · ") */
function clearQaAnnotations(root: SceneNode) {
  const walk = (n: any) => {
    try {
      if (Array.isArray(n.annotations) && n.annotations.some((a: any) => String(a.label || '').startsWith(QA_PREFIX))) {
        n.annotations = n.annotations.filter((a: any) => !String(a.label || '').startsWith(QA_PREFIX));
      }
    } catch (_e) {}
    for (const c of n.children || []) walk(c);
  };
  walk(root);
}

/** Una anotación por nodo del diseño con todas sus diferencias. Devuelve cuántos nodos se anotaron */
async function annotate(findings: Finding[]): Promise<number> {
  const byNode = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!f.designId || f.severity === 'info') continue;
    const list = byNode.get(f.designId) || [];
    list.push(f);
    byNode.set(f.designId, list);
  }
  let count = 0;
  for (const [id, list] of byNode) {
    try {
      const node: any = await figma.getNodeByIdAsync(id);
      if (!node || !('annotations' in node || 'children' in node || node.type === 'TEXT')) continue;
      const label = QA_PREFIX + list.map(f => f.message).join('\n');
      const keep = Array.isArray(node.annotations) ? node.annotations : [];
      node.annotations = [...keep, { label }];
      count++;
    } catch (_e) {
      // Anotaciones no disponibles (plan o tipo de nodo): el informe en el lienzo lo cubre
    }
  }
  return count;
}

const MAX_REPORT_ROWS = 60;

export interface FindingGroup {
  severity: Finding['severity'];
  message: string;
  where: string;
  count: number;
}

/**
 * Una fila por diferencia, no por capa: "la misma tipografía distinta en 40 textos" es un problema (una
 * regla CSS), no 40. Se agrupa por gravedad y mensaje, conservando el orden (más grave primero).
 */
export function groupFindings(findings: Finding[]): FindingGroup[] {
  const byKey = new Map<string, { severity: Finding['severity']; message: string; labels: string[] }>();
  for (const f of findings) {
    const key = f.severity + '|' + f.message;
    const g = byKey.get(key) || { severity: f.severity, message: f.message, labels: [] };
    g.labels.push(f.label);
    byKey.set(key, g);
  }
  return [...byKey.values()].map(g => {
    const leaf = (l: string) => l.split(' › ').pop() || l;
    const where =
      g.labels.length === 1
        ? g.labels[0]
        : `${g.labels.length} capas: ${g.labels.slice(0, 3).map(leaf).join(', ')}${g.labels.length > 3 ? '…' : ''}`;
    return { severity: g.severity, message: g.message, where, count: g.labels.length };
  });
}

/**
 * La fuente con la que Figma dibujaría cada texto de producción (la misma elección que al dibujar). Un
 * diseño hecho en este Figma con una fuente que no está lleva esa sustituta, y no es un error del código.
 */
async function figmaFonts(prodRoot: any) {
  const out = new Map<string, { family: string; style: string }>();
  const walk = async (n: any) => {
    if (!n) return;
    const td = n.type === 'TEXT' ? n.textData : null;
    if (td) {
      try {
        const f = await loadFontSafely(td.fontStack || td.fontFamily || 'Inter', td.fontWeight || 400);
        out.set(String(n.id), { family: f.family, style: f.style });
      } catch (_e) {}
    }
    for (const c of n.children || []) await walk(c);
  };
  await walk(prodRoot);
  return out;
}

async function reportFrame(title: string, subtitle: string, result: CompareResult): Promise<FrameNode> {
  const bold = await loadFontSafely('Inter', 700);
  const regular = await loadFontSafely('Inter', 400);
  const frame = figma.createFrame();
  frame.name = `${QA_PREFIX}${title}`;
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(520, 100);
  frame.paddingTop = frame.paddingBottom = 24;
  frame.paddingLeft = frame.paddingRight = 24;
  frame.itemSpacing = 10;
  frame.cornerRadius = 12;
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.9 } }];
  const text = (chars: string, font: FontName, size: number, color: RGB) => {
    const t = figma.createText();
    t.fontName = font;
    t.characters = chars;
    t.fontSize = size;
    t.fills = [{ type: 'SOLID', color }];
    frame.appendChild(t);
    try {
      t.textAutoResize = 'HEIGHT';
      t.resize(472, t.height || size * 1.4);
    } catch (_e) {}
    return t;
  };
  text(`${QA_PREFIX}${title}`, bold, 18, { r: 0.1, g: 0.1, b: 0.12 });
  text(subtitle, regular, 12, { r: 0.4, g: 0.4, b: 0.45 });
  if (!result.findings.some(f => f.severity !== 'info'))
    text('Sin diferencias medibles: producción coincide con el diseño.', regular, 13, { r: 0.05, g: 0.55, b: 0.3 });
  const groups = groupFindings(result.findings);
  const shown = groups.slice(0, MAX_REPORT_ROWS);
  for (const g of shown) {
    const row = text(
      `● ${g.severity.toUpperCase()} · ${g.where}\n${g.message}`,
      regular,
      12,
      SEVERITY_COLOR[g.severity],
    );
    row.name = g.severity;
  }
  if (groups.length > shown.length) {
    const rest = groups.slice(shown.length).reduce((n, g) => n + g.count, 0);
    text(
      `…y ${rest} más (${groups.length - shown.length} tipos de diferencia). Cada capa del diseño lleva las suyas en Dev Mode.`,
      regular,
      12,
      SEVERITY_COLOR.info,
    );
  }
  return frame;
}

/**
 * Imágenes: el hash de Figma de cada una de producción (createImage no duplica: es el mismo que tendrá
 * al dibujarla) y la proporción del archivo de todas, para saber si es otra imagen.
 */
async function imageInfo(target: SceneNode, prodRoot: any) {
  const prodImageHashes = new Map<string, string>();
  const hashes = new Set<string>();
  (function walk(n: any) {
    if (!n) return;
    if (typeof n.imageData === 'string' && n.imageData) {
      try {
        const h = figma.createImage(base64ToBytes(n.imageData)).hash;
        prodImageHashes.set(String(n.id), h);
        hashes.add(h);
      } catch (_e) {}
    }
    for (const c of n.children || []) walk(c);
  })(prodRoot);
  (function walk(n: any) {
    const fills = 'fills' in n && Array.isArray(n.fills) ? n.fills : [];
    for (const f of fills) if (f && f.type === 'IMAGE' && f.imageHash) hashes.add(f.imageHash);
    if ('children' in n) for (const c of n.children) walk(c);
  })(target);
  const imageRatios = new Map<string, number>();
  for (const h of hashes) {
    try {
      const img = figma.getImageByHash(h);
      const size = img ? await img.getSizeAsync() : null;
      if (size && size.width > 0 && size.height > 0) imageRatios.set(h, size.width / size.height);
    } catch (_e) {}
  }
  return { prodImageHashes, imageRatios };
}

export async function runDesignQa(payload: any, post: (m: PluginSandboxMessage) => void, log: Logger): Promise<void> {
  const t0 = Date.now();
  const targetId = String(payload.compare?.targetNodeId || '');
  const target = (await figma.getNodeByIdAsync(targetId)) as SceneNode | null;
  if (!target || !('width' in target)) {
    throw new Error('El frame de diseño ya no existe: selecciónalo de nuevo en Figma y vuelve a comparar');
  }
  const prodRoot = payload.rootNode;

  const result = compareTrees(target, prodRoot, {
    variableColors: await variableColors(),
    figmaFonts: await figmaFonts(prodRoot),
    ...(await imageInfo(target, prodRoot)),
  });
  // Pantalla completa capturada a otro ancho de ventana (no debería pasar: la extensión usa el del frame)
  const viewport = Number(payload.compare?.viewportWidth) || 0;
  if (viewport && Math.abs(viewport - (target as any).width) > 2 && payload.compare?.fullWidth) {
    result.findings.unshift({
      severity: 'info',
      category: 'ancho',
      designId: target.id,
      label: target.name,
      message: `El diseño mide ${Math.round((target as any).width)} px y la web se capturó con una ventana de ${Math.round(viewport)} px`,
    });
  }

  clearQaAnnotations(target);
  const annotated = await annotate(result.findings);

  // Producción al lado del diseño
  await prewarmFonts(prodRoot);
  const pos = absolutePosition(target);
  const prod = await buildFigmaNode({ ...prodRoot, layout: { ...prodRoot.layout, positioning: 'AUTO', x: 0, y: 0 } });
  const page = figma.currentPage;
  const placed: SceneNode[] = [];
  if (prod) {
    prod.name = `Producción · ${target.name}`;
    page.appendChild(prod);
    prod.x = Math.round(pos.x + (target as any).width + 120);
    prod.y = Math.round(pos.y);
    placed.push(prod);
  }
  const counts = { alta: 0, media: 0, baja: 0, info: 0 } as Record<string, number>;
  for (const f of result.findings) counts[f.severity]++;
  const total = counts.alta + counts.media + counts.baja;
  const s = result.stats;
  const groups = groupFindings(result.findings).filter(g => g.severity !== 'info');
  const subtitle =
    `${total} diferencia${total === 1 ? '' : 's'} (${counts.alta} altas, ${counts.media} medias, ${counts.baja} bajas)` +
    (total > groups.length ? ` de ${groups.length} tipo${groups.length === 1 ? '' : 's'}` : '') +
    (counts.info ? ` · ${counts.info} avisos` : '') +
    ` · ${s.matchedTexts}/${s.designTexts} textos y ${s.matchedNodes}/${s.designNodes} capas del diseño emparejadas`;
  const report = await reportFrame(target.name, subtitle, result);
  page.appendChild(report);
  report.x = Math.round(prod ? prod.x + prod.width + 120 : pos.x + (target as any).width + 120);
  report.y = Math.round(pos.y);
  placed.push(report);

  post({ type: 'LOG', level: total ? 'warn' : 'success', message: `QA de "${target.name}": ${subtitle}` });
  for (const g of groups.slice(0, 8)) {
    post({ type: 'LOG', level: g.severity === 'alta' ? 'error' : 'warn', message: `${g.where}: ${g.message}` });
  }
  if (annotated) post({ type: 'LOG', level: 'info', message: `${annotated} capas del diseño anotadas (Dev Mode)` });
  figma.viewport.scrollAndZoomIntoView([target, ...placed]);
  page.selection = [report];
  log.info('QA de diseño', { diferencias: total, anotadas: annotated });

  post({
    type: 'RENDER_SUCCESS',
    nodeId: report.id,
    nodeIds: placed.map(n => n.id),
    name: report.name,
    nodeCount: placed.length,
    pageName: page.name,
    width: Math.round(report.width),
    height: Math.round(report.height),
    nodeType: report.type,
    durationMs: Date.now() - t0,
    qa: {
      total,
      groups: groups.length,
      ...counts,
      annotated,
      matchedTexts: s.matchedTexts,
      designTexts: s.designTexts,
      matchedNodes: s.matchedNodes,
      designNodes: s.designNodes,
      top: groups.slice(0, 5).map(g => `${g.where}: ${g.message}`),
    },
  });
}
