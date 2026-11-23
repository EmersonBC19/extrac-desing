/**
 * QA de diseño contra producción (Función B de la propuesta): compara un frame de Figma (el diseño)
 * con la extracción de la web real (UINode) y lista cada diferencia medible.
 *
 * Emparejar los dos árboles es el núcleo: los nombres de capa del diseño no coinciden con las clases
 * CSS y las posiciones cambian justo cuando hay diferencias, así que no se empareja por geometría:
 *  1. Textos iguales (normalizados) son anclas; los que no casan exactos se emparejan por parecido como
 *     "contenido distinto" (no cuenta como error).
 *  2. Contenedores por el conjunto de textos que contienen (Jaccard), del más interno al más externo.
 *  3. Lo que no tiene texto (iconos, imágenes, cajas) por orden dentro de su padre ya emparejado.
 * Se compara con lo DECLARADO en la web (fuente del CSS, no la sustituta que usaría Figma).
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

type Kind = 'TEXT' | 'FRAME' | 'IMAGE' | 'VECTOR';

export interface QNode {
  id: string;
  kind: Kind;
  name: string;
  text: string;
  rawText: string;
  w: number;
  h: number;
  depth: number;
  parent: QNode | null;
  children: QNode[];
  fill: RGBA | null;
  fillBound: boolean;
  stroke: { color: RGBA; weight: number } | null;
  radius: number | null;
  autoLayout: boolean;
  /** Distancia del borde exterior al contenido (lo que se ve), por lado */
  padding: [number, number, number, number] | null;
  /** Producción: grosor del borde CSS por lado (el padding visual lo incluye; el CSS no) */
  border: [number, number, number, number];
  gap: number | null;
  font: { family: string; weight: number; size: number; lineHeight: number | null; letterSpacing: number } | null;
  opacity: number;
  shadow: { blur: number; x: number; y: number } | null;
  /** Imagen: hash de Figma (null si no se conoce) y ajuste (FILL = cover, FIT = contain…) */
  image: { hash: string | null; scaleMode: string } | null;
  /** Ids de las parejas de texto que contiene (para emparejar contenedores) */
  textIds: Set<number>;
  subtree: number;
}

export type Severity = 'alta' | 'media' | 'baja' | 'info';

export interface Finding {
  severity: Severity;
  category: string;
  designId?: string;
  prodId?: string;
  label: string;
  message: string;
}

export interface CompareResult {
  findings: Finding[];
  pairs: Array<[QNode, QNode]>;
  stats: {
    designTexts: number;
    prodTexts: number;
    matchedTexts: number;
    designNodes: number;
    matchedNodes: number;
  };
}

// ── Utilidades ─────────────────────────────────────────────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  heavy: 800,
  black: 900,
};

export function styleWeight(style: string): number {
  const s = (style || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/italic|oblique/g, '');
  if (!s) return 400;
  for (const [k, v] of Object.entries(WEIGHTS).sort((a, b) => b[0].length - a[0].length)) if (s.includes(k)) return v;
  return 400;
}

function cssWeight(w: number | string | undefined): number {
  if (typeof w === 'number') return w;
  const n = parseInt(String(w || ''), 10);
  if (n) return n;
  return /bold/i.test(String(w)) ? 700 : 400;
}

function firstFamily(stack: string): string {
  return (stack || '')
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

export function normText(t: string): string {
  return (t || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function hex(c: RGBA | null): string {
  if (!c) return '—';
  const h = [c.r, c.g, c.b]
    .map(x =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
  return `#${h}${c.a < 0.995 ? ` ${Math.round(c.a * 100)} %` : ''}`;
}

/** Diferencia de color perceptible (CIE76 en Lab, sobre el color compuesto con su opacidad) */
export function deltaE(a: RGBA, b: RGBA): number {
  const lab = (c: RGBA) => {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    // La transparencia se compara aparte: aquí solo el tono
    const [r, g, bl] = [lin(c.r), lin(c.g), lin(c.b)];
    const x = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + bl * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2) + Math.abs(a.a - b.a) * 50;
}

const px = (n: number) => `${Math.round(n * 10) / 10} px`;

function emptyNode(id: string, kind: Kind, name: string, parent: QNode | null): QNode {
  return {
    id,
    kind,
    name,
    text: '',
    rawText: '',
    w: 0,
    h: 0,
    depth: parent ? parent.depth + 1 : 0,
    parent,
    children: [],
    fill: null,
    fillBound: false,
    stroke: null,
    radius: null,
    autoLayout: false,
    padding: null,
    border: [0, 0, 0, 0],
    gap: null,
    font: null,
    opacity: 1,
    shadow: null,
    image: null,
    textIds: new Set(),
    subtree: 1,
  };
}

function finishSubtree(n: QNode): number {
  n.subtree = 1 + n.children.reduce((s, c) => s + finishSubtree(c), 0);
  return n.subtree;
}

// ── Modelo del diseño (nodos de Figma) ────────────────────────────────────────────────────────

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON']);

function solidOf(paints: any): { color: RGBA; bound: boolean } | null {
  if (!Array.isArray(paints)) return null;
  const p = paints.find((x: any) => x && x.type === 'SOLID' && x.visible !== false);
  if (!p) return null;
  return {
    color: { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity !== undefined ? p.opacity : 1 },
    bound: !!(p.boundVariables && p.boundVariables.color),
  };
}

export function designModel(node: any, parent: QNode | null = null): QNode {
  const type = String(node.type);
  const fills = Array.isArray(node.fills) ? node.fills : [];
  const kind: Kind =
    type === 'TEXT'
      ? 'TEXT'
      : VECTOR_TYPES.has(type)
        ? 'VECTOR'
        : fills.some((f: any) => f && f.type === 'IMAGE' && f.visible !== false)
          ? 'IMAGE'
          : 'FRAME';
  const q = emptyNode(String(node.id), kind, String(node.name || ''), parent);
  if (kind === 'IMAGE') {
    const f = fills.find((x: any) => x && x.type === 'IMAGE' && x.visible !== false);
    q.image = { hash: f.imageHash || null, scaleMode: f.scaleMode || 'FILL' };
  }
  q.w = Number(node.width) || 0;
  q.h = Number(node.height) || 0;
  q.opacity = typeof node.opacity === 'number' ? node.opacity : 1;
  const solid = solidOf(fills);
  if (kind === 'TEXT') {
    q.rawText = String(node.characters || '');
    q.text = normText(q.rawText);
    q.fill = solid ? solid.color : null;
    q.fillBound = !!solid?.bound;
    const fn = node.fontName && node.fontName.family ? node.fontName : null;
    const size = typeof node.fontSize === 'number' ? node.fontSize : 0;
    if (fn && size) {
      const lh = node.lineHeight;
      const ls = node.letterSpacing;
      q.font = {
        family: fn.family,
        weight: styleWeight(fn.style),
        size,
        lineHeight:
          lh && lh.unit === 'PIXELS' ? lh.value : lh && lh.unit === 'PERCENT' ? (size * lh.value) / 100 : null,
        letterSpacing:
          ls && ls.unit === 'PIXELS' ? ls.value : ls && ls.unit === 'PERCENT' ? (size * ls.value) / 100 : 0,
      };
    }
  } else {
    q.fill = solid ? solid.color : null;
    q.fillBound = !!solid?.bound;
    const st = solidOf(node.strokes);
    // Bordes por lado (strokeWeight es figma.mixed): el más grueso; uno solo abajo también es borde
    const weight =
      typeof node.strokeWeight === 'number'
        ? node.strokeWeight
        : Math.max(
            ...['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'].map(
              k => Number(node[k]) || 0,
            ),
          );
    if (st && weight > 0) q.stroke = { color: st.color, weight };
    if (typeof node.cornerRadius === 'number') q.radius = node.cornerRadius;
    else if (typeof node.topLeftRadius === 'number') q.radius = node.topLeftRadius;
    q.autoLayout = !!node.layoutMode && node.layoutMode !== 'NONE';
    if (q.autoLayout) {
      q.padding = [node.paddingTop || 0, node.paddingRight || 0, node.paddingBottom || 0, node.paddingLeft || 0];
      q.gap = node.primaryAxisAlignItems === 'SPACE_BETWEEN' ? null : Number(node.itemSpacing) || 0;
    }
    const sh = Array.isArray(node.effects)
      ? node.effects.find((e: any) => e && e.type === 'DROP_SHADOW' && e.visible !== false)
      : null;
    if (sh) q.shadow = { blur: sh.radius || 0, x: sh.offset?.x || 0, y: sh.offset?.y || 0 };
  }
  if (kind !== 'TEXT' && kind !== 'VECTOR' && Array.isArray(node.children)) {
    for (const c of node.children) if (c && c.visible !== false) q.children.push(designModel(c, q));
  }
  if (!parent) finishSubtree(q);
  return q;
}

// ── Modelo de producción (UINode) ─────────────────────────────────────────────────────────────

const isSolid = (f: any) => !!f && (!f.type || f.type === 'SOLID') && typeof f.r === 'number';
const rgba = (f: any): RGBA => ({ r: f.r, g: f.g, b: f.b, a: f.a !== undefined ? f.a : 1 });

export function prodModel(node: any, parent: QNode | null = null): QNode {
  const kind: Kind =
    node.type === 'TEXT'
      ? 'TEXT'
      : node.svgContent || node.type === 'SVG' || node.type === 'VECTOR'
        ? 'VECTOR'
        : node.imageData || node.metadata?.imageOmitted // sin imágenes: queda un relleno de marcador
          ? 'IMAGE'
          : 'FRAME';
  const q = emptyNode(String(node.id), kind, String(node.name || ''), parent);
  const L = node.layout || {};
  q.w = Number(L.measuredWidth ?? (typeof L.width === 'number' ? L.width : 0)) || 0;
  q.h = Number(L.measuredHeight ?? (typeof L.height === 'number' ? L.height : 0)) || 0;
  const S = node.styles || {};
  q.opacity = typeof S.opacity === 'number' ? S.opacity : 1;
  // El hash lo pone compareTrees (opts.prodImageHashes): calcularlo necesita la API de Figma
  if (kind === 'IMAGE') q.image = { hash: null, scaleMode: S.imageScaleMode || 'FILL' };
  const fill = (S.fills || []).find(isSolid);
  q.fill = fill ? rgba(fill) : null;
  if (kind === 'TEXT' && node.textData) {
    const td = node.textData;
    q.rawText = String(td.characters || '');
    q.text = normText(q.rawText);
    const size = Number(td.fontSize) || 0;
    q.font = {
      family: firstFamily(td.fontFamily || td.fontStack || ''),
      weight: cssWeight(td.fontWeight),
      size,
      lineHeight: typeof td.lineHeight === 'number' && td.lineHeight > 0 ? td.lineHeight : null,
      letterSpacing: Number(td.letterSpacing) || 0,
    };
  } else {
    const st = (S.strokes || [])[0];
    if (st && st.width > 0) {
      q.stroke = { color: rgba(st), weight: st.width };
      const bs = S.borderSides;
      q.border = bs
        ? [bs.top || 0, bs.right || 0, bs.bottom || 0, bs.left || 0]
        : [st.width, st.width, st.width, st.width];
    }
    const cr = S.cornerRadius;
    q.radius = typeof cr === 'number' ? cr : Array.isArray(cr) ? cr[0] : null;
    q.autoLayout = L.mode === 'HORIZONTAL' || L.mode === 'VERTICAL';
    if (q.autoLayout) {
      const p = L.padding || {};
      q.padding = [p.top || 0, p.right || 0, p.bottom || 0, p.left || 0];
      q.gap = L.primaryAxisAlignItems === 'SPACE_BETWEEN' ? null : Number(L.itemSpacing) || 0;
    }
    const sh = (S.boxShadow || []).find((b: any) => b && !b.inset);
    if (sh) q.shadow = { blur: sh.radius || 0, x: sh.offset?.x || 0, y: sh.offset?.y || 0 };
    for (const c of node.children || []) q.children.push(prodModel(c, q));
  }
  if (!parent) finishSubtree(q);
  return q;
}

// ── Emparejamiento ────────────────────────────────────────────────────────────────────────────

function flatten(n: QNode, out: QNode[] = []): QNode[] {
  out.push(n);
  for (const c of n.children) flatten(c, out);
  return out;
}

/** Parecido entre dos textos (0..1): palabras en común, o caracteres si son cortos */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wa = new Set(a.split(' '));
  const wb = new Set(b.split(' '));
  const inter = [...wa].filter(w => wb.has(w)).length;
  const jac = inter / (wa.size + wb.size - inter);
  if (Math.max(a.length, b.length) > 24) return jac;
  // Distancia de edición normalizada para textos cortos ("$20" ↔ "$29")
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return Math.max(jac, 1 - dp[m][n] / Math.max(m, n));
}

function jaccard(a: Set<number>, b: Set<number>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function sizeSimilarity(a: QNode, b: QNode): number {
  const r = (x: number, y: number) => (x > 0 && y > 0 ? Math.min(x, y) / Math.max(x, y) : 0);
  return (r(a.w, b.w) + r(a.h, b.h)) / 2;
}

function collectTextIds(n: QNode): Set<number> {
  for (const c of n.children) for (const id of collectTextIds(c)) n.textIds.add(id);
  return n.textIds;
}

export function matchTrees(D: QNode, P: QNode) {
  const pairs = new Map<QNode, QNode>(); // diseño → producción
  const used = new Set<QNode>();
  const contentDiff = new Set<QNode>(); // textos emparejados por parecido (diseño)
  const pair = (d: QNode, p: QNode) => {
    pairs.set(d, p);
    used.add(p);
  };

  // 1. Textos: iguales primero, en orden de documento
  const dTexts = flatten(D).filter(n => n.kind === 'TEXT' && n.text);
  const pTexts = flatten(P).filter(n => n.kind === 'TEXT' && n.text);
  const queue = new Map<string, QNode[]>();
  for (const p of pTexts) {
    const q = queue.get(p.text) || [];
    q.push(p);
    queue.set(p.text, q);
  }
  let nextId = 0;
  for (const d of dTexts) {
    const p = queue.get(d.text)?.shift();
    if (!p) continue;
    pair(d, p);
    d.textIds.add(nextId);
    p.textIds.add(nextId++);
  }
  //    …luego por parecido (contenido distinto: textos reales en lugar de los de ejemplo)
  const candidates: Array<[number, QNode, QNode]> = [];
  for (const d of dTexts) {
    if (pairs.has(d)) continue;
    for (const p of pTexts) {
      if (used.has(p)) continue;
      const s = textSimilarity(d.text, p.text);
      if (s >= 0.5) candidates.push([s, d, p]);
    }
  }
  candidates.sort((a, b) => b[0] - a[0]);
  for (const [, d, p] of candidates) {
    if (pairs.has(d) || used.has(p)) continue;
    pair(d, p);
    contentDiff.add(d);
    d.textIds.add(nextId);
    p.textIds.add(nextId++);
  }

  // 2. Contenedores por los textos que contienen, del más interno al más externo
  collectTextIds(D);
  collectTextIds(P);
  pair(D, P);
  const dFrames = flatten(D)
    .filter(n => n !== D && n.kind !== 'TEXT' && n.textIds.size > 0)
    .sort((a, b) => a.textIds.size - b.textIds.size || b.depth - a.depth);
  const pFrames = flatten(P).filter(n => n !== P && n.kind !== 'TEXT' && n.textIds.size > 0);
  for (const d of dFrames) {
    let best: QNode | null = null;
    let bestScore = 0;
    for (const p of pFrames) {
      if (used.has(p)) continue;
      const j = jaccard(d.textIds, p.textIds);
      if (j < 0.5) continue;
      // Empate de textos (envoltorio y tarjeta con los mismos textos): el de tamaño más parecido y,
      // a igualdad, el más interno (se recorre del diseño más interno al más externo)
      const score = j * 10 + sizeSimilarity(d, p) - p.subtree * 1e-4;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) pair(d, best);
  }

  // 3. Lo que no tiene texto, por orden dentro de su padre emparejado
  const walk = (d: QNode) => {
    const p = pairs.get(d);
    if (p) {
      const dKids = d.children.filter(c => !pairs.has(c) && c.textIds.size === 0);
      const pKids = p.children.filter(c => !used.has(c) && c.textIds.size === 0);
      let j = 0;
      for (const dc of dKids) {
        for (let k = j; k < pKids.length; k++) {
          const pc = pKids[k];
          const kindOk = dc.kind === pc.kind || (dc.kind !== 'TEXT' && pc.kind !== 'TEXT');
          if (kindOk && sizeSimilarity(dc, pc) >= 0.5) {
            pair(dc, pc);
            j = k + 1;
            break;
          }
        }
      }
    }
    for (const c of d.children) walk(c);
  };
  walk(D);
  return { pairs, contentDiff, dTexts, pTexts };
}

// ── Diferencias ───────────────────────────────────────────────────────────────────────────────

export interface CompareOptions {
  /** Colores de las Variables del archivo (hex sin #, mayúsculas): para avisar valores fuera del sistema */
  variableColors?: Set<string>;
  /** Hash de Figma de cada imagen de producción, por id de UINode (el que tendrá al dibujarse) */
  prodImageHashes?: Map<string, string>;
  /** Proporción (ancho / alto) del archivo de cada imagen, por hash */
  imageRatios?: Map<string, number>;
  /**
   * La fuente con la que Figma dibujaría cada texto de producción (por id de UINode). Si la declarada
   * no está en este Figma, un diseño dibujado aquí lleva la sustituta: no es una diferencia del código.
   */
  figmaFonts?: Map<string, { family: string; style: string }>;
}

const FIT_NAMES: Record<string, string> = {
  FILL: 'cubrir (cover)',
  FIT: 'contener (contain)',
  CROP: 'recorte',
  TILE: 'mosaico',
};

/** 1.777 → "16:9"; si no es una proporción habitual, "1,78:1" */
function ratioText(r: number): string {
  const common: Array<[number, number]> = [
    [1, 1], [4, 3], [3, 2], [16, 9], [21, 9], [5, 4], [3, 4], [2, 3], [9, 16], [4, 5],
  ];
  for (const [a, b] of common) if (Math.abs(r / (a / b) - 1) < 0.015) return `${a}:${b}`;
  return `${(Math.round(r * 100) / 100).toString().replace('.', ',')}:1`;
}

/** La imagen que ocupa la caja: ella misma o un descendiente del mismo tamaño (envoltorios) */
function imageInside(n: QNode): QNode | null {
  if (n.kind === 'IMAGE') return n;
  for (const c of n.children) {
    if (Math.abs(c.w - n.w) <= 2 && Math.abs(c.h - n.h) <= 2) {
      const r = imageInside(c);
      if (r) return r;
    }
  }
  return null;
}

const hasVisualBox = (n: QNode) => !!(n.fill && n.fill.a > 0.01) || !!n.stroke || n.kind === 'IMAGE';

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

function labelOf(d: QNode | null, p: QNode | null): string {
  const n = d || p!;
  const parent = n.parent && n.parent.parent ? oneLine(n.parent.name) : '';
  const raw = oneLine(n.rawText);
  const name = n.kind === 'TEXT' ? `«${raw.slice(0, 40)}${raw.length > 40 ? '…' : ''}»` : oneLine(n.name);
  return parent ? `${parent} › ${name}` : name;
}

export function compareTrees(design: any, production: any, opts: CompareOptions = {}): CompareResult {
  const D = designModel(design);
  const P = prodModel(production);
  if (opts.prodImageHashes) {
    for (const p of flatten(P)) if (p.image) p.image.hash = opts.prodImageHashes.get(p.id) ?? null;
  }
  const { pairs, contentDiff, dTexts, pTexts } = matchTrees(D, P);
  const findings: Finding[] = [];
  const add = (severity: Severity, category: string, d: QNode | null, p: QNode | null, message: string) =>
    findings.push({ severity, category, designId: d?.id, prodId: p?.id, label: labelOf(d, p), message });
  const varHex = opts.variableColors;
  const outsideTokens = (c: RGBA | null) => !!(varHex && varHex.size && c && !varHex.has(hex({ ...c, a: 1 }).slice(1)));

  const colorFinding = (what: string, d: QNode, p: QNode, dc: RGBA | null, pc: RGBA | null) => {
    if (!dc || !pc) return;
    const de = deltaE(pc, dc);
    if (de <= 2) return;
    const token = outsideTokens(pc) ? ' (no es ninguna Variable del archivo)' : '';
    add(
      de > 10 ? 'alta' : 'media',
      'color',
      d,
      p,
      `${what}: ${hex(pc)} en producción${token}, ${hex(dc)} en el diseño`,
    );
  };

  const substituted = new Map<string, number>(); // "declarada→sustituta" → textos

  // Imágenes: la misma (hash), otra proporción (otra imagen o recortada) y el ajuste. Un envoltorio y
  // la imagen que llena pueden emparejarse a distinto nivel en cada lado: se compara la imagen una vez.
  const comparedImages = new Set<QNode>();
  const ratios = opts.imageRatios;
  const imageFindings = (d: QNode, p: QNode) => {
    if (comparedImages.has(d) || comparedImages.has(p)) return;
    comparedImages.add(d);
    comparedImages.add(p);
    if (!d.image || !p.image) return;
    if (d.image.hash && p.image.hash && d.image.hash !== p.image.hash) {
      const rd = ratios?.get(d.image.hash);
      const rp = ratios?.get(p.image.hash);
      if (rd && rp && Math.abs(rd / rp - 1) > 0.02) {
        add(
          'media',
          'imagen',
          d,
          p,
          `Imagen distinta: proporción ${ratioText(rp)} en producción, ${ratioText(rd)} en el diseño`,
        );
      } else {
        add('info', 'imagen', d, p, 'Imagen: no es el mismo archivo que en el diseño (puede ser la misma exportada de otra forma)');
      }
    }
    if (d.image.scaleMode !== p.image.scaleMode) {
      const name = (m: string) => FIT_NAMES[m] || m;
      add(
        'baja',
        'imagen',
        d,
        p,
        `Ajuste de la imagen: ${name(p.image.scaleMode)} en producción, ${name(d.image.scaleMode)} en el diseño`,
      );
    }
  };

  for (const [d, p] of pairs) {
    if (d.kind === 'TEXT' && p.kind === 'TEXT') {
      if (contentDiff.has(d)) {
        add('info', 'contenido', d, p, `Contenido distinto: «${oneLine(p.rawText).slice(0, 60)}» en producción`);
      }
      const df = d.font;
      const pf = p.font;
      if (df && pf) {
        let fam = df.family.toLowerCase() !== pf.family.toLowerCase();
        let wt = df.weight !== pf.weight;
        // La declarada no está en este Figma y el diseño lleva justo la que Figma usaría en su lugar
        const sub = opts.figmaFonts?.get(p.id);
        if (fam && sub && sub.family.toLowerCase() === df.family.toLowerCase()) {
          fam = false;
          if (wt && styleWeight(sub.style) === df.weight) wt = false;
          const key = `${pf.family}→${sub.family}`;
          substituted.set(key, (substituted.get(key) || 0) + 1);
        }
        const sz = Math.abs(df.size - pf.size) > 0.5;
        const lh = df.lineHeight != null && pf.lineHeight != null && Math.abs(df.lineHeight - pf.lineHeight) > 0.5;
        if (fam || wt || sz || lh) {
          const fmt = (f: NonNullable<QNode['font']>) =>
            `${f.family} ${Math.round(f.size * 10) / 10}${f.lineHeight != null ? '/' + Math.round(f.lineHeight * 10) / 10 : ''} (${f.weight})`;
          add(
            fam || wt ? 'alta' : 'media',
            'tipografía',
            d,
            p,
            `Tipografía: ${fmt(pf)} en producción, ${fmt(df)} en el diseño`,
          );
        }
        if (Math.abs(df.letterSpacing - pf.letterSpacing) > 0.1) {
          add(
            'baja',
            'tipografía',
            d,
            p,
            `Espaciado entre letras: ${px(pf.letterSpacing)} en producción, ${px(df.letterSpacing)} en el diseño`,
          );
        }
      }
      colorFinding('Color del texto', d, p, d.fill, p.fill);
      continue;
    }
    if (d.kind === 'TEXT' || p.kind === 'TEXT') continue;

    const di = imageInside(d);
    const pi = imageInside(p);
    if (di && pi) imageFindings(di, pi);
    else if (d.kind === 'IMAGE' && !pi && p.kind === 'FRAME' && d.w * d.h >= 64) {
      comparedImages.add(d);
      add('media', 'imagen', d, p, 'Imagen: el diseño tiene una imagen aquí y producción no');
    } else if (p.kind === 'IMAGE' && !di && d.kind === 'FRAME' && p.w * p.h >= 64) {
      comparedImages.add(p);
      add('media', 'imagen', d, p, 'Imagen: producción tiene una imagen aquí y el diseño no');
    }

    // Tamaño: solo cajas visibles (los envoltorios transparentes difieren sin que se note)
    if (hasVisualBox(d) && hasVisualBox(p)) {
      const dw = Math.abs(d.w - p.w);
      const dh = Math.abs(d.h - p.h);
      if (dw > 1 || dh > 1) {
        const parts = [];
        if (dw > 1) parts.push(`ancho ${px(p.w)} en producción, ${px(d.w)} en el diseño`);
        if (dh > 1) parts.push(`alto ${px(p.h)} en producción, ${px(d.h)} en el diseño`);
        add(Math.max(dw, dh) > 8 ? 'alta' : 'media', 'tamaño', d, p, `Tamaño: ${parts.join('; ')}`);
      }
    }
    if (d.autoLayout && p.autoLayout && d.padding && p.padding) {
      // Se compara lo que se ve (del borde exterior al contenido); el valor de producción se muestra
      // como en su CSS, sin el borde, que es lo que quien desarrolla encuentra en el código
      const sides = ['superior', 'derecho', 'inferior', 'izquierdo'];
      const diff = d.padding.map((v, i) => Math.abs(v - p.padding![i]) > 1);
      const prodCss = (i: number) =>
        `${px(p.padding![i] - p.border[i])}${p.border[i] ? ` (+${px(p.border[i])} de borde)` : ''}`;
      if (diff.some(Boolean)) {
        const allSame = new Set(p.padding).size === 1 && new Set(d.padding).size === 1 && new Set(p.border).size === 1;
        if (allSame)
          add('media', 'espaciado', d, p, `Padding: ${prodCss(0)} en producción, ${px(d.padding[0])} en el diseño`);
        else
          diff.forEach((x, i) => {
            if (x)
              add(
                'media',
                'espaciado',
                d,
                p,
                `Padding ${sides[i]}: ${prodCss(i)} en producción, ${px(d.padding![i])} en el diseño`,
              );
          });
      }
      if (d.gap != null && p.gap != null && Math.abs(d.gap - p.gap) > 1 && d.children.length > 1) {
        add(
          'media',
          'espaciado',
          d,
          p,
          `Espacio entre elementos: ${px(p.gap)} en producción, ${px(d.gap)} en el diseño`,
        );
      }
    }
    if (
      d.radius != null &&
      p.radius != null &&
      Math.abs(d.radius - p.radius) > 1 &&
      (hasVisualBox(d) || hasVisualBox(p))
    ) {
      add('media', 'radio', d, p, `Radio de esquina: ${px(p.radius)} en producción, ${px(d.radius)} en el diseño`);
    }
    // El relleno de una imagen (o su marcador gris cuando se envía sin imágenes) no es un color de diseño,
    // ni el del contenedor de un SVG (lo que se ve son sus trazados)
    const paintless = (n: QNode) => n.kind === 'IMAGE' || n.kind === 'VECTOR';
    if ((d.fill || p.fill) && !paintless(d) && !paintless(p)) {
      if (d.fill && p.fill) colorFinding('Relleno', d, p, d.fill, p.fill);
      else if ((d.fill?.a ?? 0) > 0.01 || (p.fill?.a ?? 0) > 0.01) {
        add('media', 'color', d, p, `Relleno: ${hex(p.fill)} en producción, ${hex(d.fill)} en el diseño`);
      }
    }
    if (d.stroke && p.stroke) {
      colorFinding('Borde', d, p, d.stroke.color, p.stroke.color);
      if (Math.abs(d.stroke.weight - p.stroke.weight) > 0.5) {
        add(
          'media',
          'borde',
          d,
          p,
          `Grosor de borde: ${px(p.stroke.weight)} en producción, ${px(d.stroke.weight)} en el diseño`,
        );
      }
    } else if (!!d.stroke !== !!p.stroke) {
      add(
        'media',
        'borde',
        d,
        p,
        d.stroke ? 'Borde: el diseño tiene borde y producción no' : 'Borde: producción tiene borde y el diseño no',
      );
    }
    if (d.shadow || p.shadow) {
      const a = p.shadow;
      const b = d.shadow;
      if (!a || !b)
        add(
          'baja',
          'sombra',
          d,
          p,
          b ? 'Sombra: el diseño tiene sombra y producción no' : 'Sombra: producción tiene sombra y el diseño no',
        );
      else if (Math.abs(a.blur - b.blur) > 2 || Math.abs(a.x - b.x) > 2 || Math.abs(a.y - b.y) > 2) {
        add(
          'baja',
          'sombra',
          d,
          p,
          `Sombra: desenfoque ${px(a.blur)} y desplazamiento ${a.x},${a.y} en producción; ${px(b.blur)} y ${b.x},${b.y} en el diseño`,
        );
      }
    }
    if (Math.abs(d.opacity - p.opacity) > 0.05) {
      add(
        'baja',
        'opacidad',
        d,
        p,
        `Opacidad: ${Math.round(p.opacity * 100)} % en producción, ${Math.round(d.opacity * 100)} % en el diseño`,
      );
    }
  }

  // Lo que está en un lado y no en el otro (textos e imágenes: lo que se ve)
  const matchedProd = new Set(pairs.values());
  for (const d of dTexts)
    if (!pairs.has(d))
      add('alta', 'faltante', d, null, `Falta en producción: el texto ${labelOf(d, null).split(' › ').pop()}`);
  for (const p of pTexts)
    if (!matchedProd.has(p))
      add(
        'media',
        'sobrante',
        null,
        p,
        `Está en producción pero no en el diseño: ${labelOf(null, p).split(' › ').pop()}`,
      );
  for (const p of flatten(P)) {
    if (p.kind === 'IMAGE' && !matchedProd.has(p) && !comparedImages.has(p) && p.w * p.h >= 64)
      add('media', 'sobrante', null, p, 'Imagen en producción que no está en el diseño');
  }
  for (const d of flatten(D)) {
    if (d.kind === 'IMAGE' && !pairs.has(d) && !comparedImages.has(d) && d.w * d.h >= 64)
      add('media', 'faltante', d, null, 'Falta en producción: una imagen');
  }

  for (const [key, n] of substituted) {
    const [declared, used] = key.split('→');
    // No se sabe si el diseño lleva la sustituta porque se dibujó en este Figma o porque se eligió: una
    // sola diferencia (baja) que lo explica, en vez de una "alta" por cada texto
    findings.push({
      severity: 'baja',
      category: 'tipografía',
      label: oneLine(D.name),
      message:
        `Fuente: ${declared} en producción, ${used} en el diseño (${n} texto${n === 1 ? '' : 's'}). ${declared} no ` +
        `está en este Figma y ${used} es la que pone en su lugar: si el diseño salió así por eso, instala ` +
        `${declared} y vuelve a dibujarlo; si ${used} se eligió a propósito, es una diferencia`,
    });
  }

  const order: Record<Severity, number> = { alta: 0, media: 1, baja: 2, info: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const designNodes = flatten(D).length;
  return {
    findings,
    pairs: [...pairs.entries()],
    stats: {
      designTexts: dTexts.length,
      prodTexts: pTexts.length,
      matchedTexts: dTexts.filter(d => pairs.has(d)).length,
      designNodes,
      matchedNodes: pairs.size,
    },
  };
}
