/**
 * Geometría de degradados CSS → gradientTransform de Figma (plan de mejoras, fase 5.4).
 *
 * Figma describe un degradado con una matriz T (2×3) que lleva el espacio del nodo (0..1) al del
 * degradado. Referencia de la documentación: T = identidad ⇒ degradado lineal de izquierda a
 * derecha. En el espacio del degradado las "manijas" son:
 *   lineal:          inicio (0, 0.5) · fin (1, 0.5) · ancho (0, 1)
 *   radial/angular:  centro (0.5, 0.5) · radio X (1, 0.5) · radio Y (0.5, 1)
 * Aquí se calculan esas manijas en píxeles a partir de los parámetros CSS (ángulo, `at`, tamaño)
 * y del tamaño real del nodo, y se obtiene T. Antes la matriz era fija y no tenía en cuenta la
 * forma del nodo: los radiales salían centrados en la esquina y los verticales cubrían la mitad.
 */
export type Pt = [number, number];
export type Matrix2x3 = [[number, number, number], [number, number, number]];
export type CssLen = { v: number; u: '%' | 'px' };

export interface GradientStopIn {
  color: { r: number; g: number; b: number; a?: number };
  /** Fracción 0..1 (CSS en %, o ángulo/360 en cónicos) */
  position?: number;
  /** Posición en píxeles a lo largo del rayo (CSS en px) */
  px?: number;
}

export interface LinearDesc {
  angle?: number;
  /** "to top right" y similares: el ángulo depende de la forma del nodo */
  toCorner?: string;
}
export interface RadialDesc {
  shape?: 'circle' | 'ellipse';
  size?: string | CssLen[];
  at?: { x?: CssLen; y?: CssLen };
}
export interface ConicDesc {
  from?: number;
  at?: { x?: CssLen; y?: CssLen };
}

const resolveLen = (l: CssLen | undefined, total: number, fallback: number) =>
  !l || !isFinite(l.v) ? fallback : l.u === '%' ? (l.v / 100) * total : l.v;

/** Inversa de una matriz afín 2×3 */
export function invert(m: Matrix2x3): Matrix2x3 {
  const [[a, b, c], [d, e, f]] = m;
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-12)
    return [
      [1, 0, 0],
      [0, 1, 0],
    ];
  return [
    [e / det, -b / det, (b * f - c * e) / det],
    [-d / det, a / det, (c * d - a * f) / det],
  ];
}

export const apply = (m: Matrix2x3, [x, y]: Pt): Pt => [
  m[0][0] * x + m[0][1] * y + m[0][2],
  m[1][0] * x + m[1][1] * y + m[1][2],
];

/** T (nodo → degradado) a partir de las manijas en coordenadas normalizadas del nodo */
export function transformFromHandles(kind: 'linear' | 'radial', S: Pt, E: Pt, W: Pt): Matrix2x3 {
  let c0: Pt, c1: Pt, t: Pt;
  if (kind === 'linear') {
    // M(0,.5)=S · M(1,.5)=E · M(0,1)=W
    c0 = [E[0] - S[0], E[1] - S[1]];
    c1 = [2 * (W[0] - S[0]), 2 * (W[1] - S[1])];
    t = [S[0] - 0.5 * c1[0], S[1] - 0.5 * c1[1]];
  } else {
    // M(.5,.5)=S (centro) · M(1,.5)=E · M(.5,1)=W
    c0 = [2 * (E[0] - S[0]), 2 * (E[1] - S[1])];
    c1 = [2 * (W[0] - S[0]), 2 * (W[1] - S[1])];
    t = [S[0] - 0.5 * c0[0] - 0.5 * c1[0], S[1] - 0.5 * c0[1] - 0.5 * c1[1]];
  }
  const M: Matrix2x3 = [
    [c0[0], c1[0], t[0]],
    [c0[1], c1[1], t[1]],
  ];
  return invert(M);
}

const norm = ([x, y]: Pt, w: number, h: number): Pt => [x / w, y / h];

/** Ángulo CSS (0 = hacia arriba, sentido horario) de "to top right" etc. para un nodo w×h */
export function cornerAngle(toCorner: string, w: number, h: number): number {
  const sx = /right/.test(toCorner) ? 1 : -1;
  const sy = /bottom/.test(toCorner) ? 1 : -1;
  return (Math.atan2(sx * h, -sy * w) * 180) / Math.PI;
}

export function linearGeometry(desc: LinearDesc, w: number, h: number): { T: Matrix2x3; rayPx: number } {
  const angle = desc.toCorner ? cornerAngle(desc.toCorner, w, h) : typeof desc.angle === 'number' ? desc.angle : 180;
  const rad = (angle * Math.PI) / 180;
  const dir: Pt = [Math.sin(rad), -Math.cos(rad)];
  // Largo de la línea del degradado según CSS: las esquinas quedan en 0 % y 100 %
  const L = Math.abs(w * dir[0]) + Math.abs(h * dir[1]) || 1;
  const C: Pt = [w / 2, h / 2];
  const S: Pt = [C[0] - (dir[0] * L) / 2, C[1] - (dir[1] * L) / 2];
  const E: Pt = [C[0] + (dir[0] * L) / 2, C[1] + (dir[1] * L) / 2];
  // Manija de ancho perpendicular EN PÍXELES (en un nodo no cuadrado no lo sería en 0..1)
  const W: Pt = [S[0] - (dir[1] * L) / 2, S[1] + (dir[0] * L) / 2];
  return { T: transformFromHandles('linear', norm(S, w, h), norm(E, w, h), norm(W, w, h)), rayPx: L };
}

export function radialGeometry(desc: RadialDesc, w: number, h: number): { T: Matrix2x3; rayPx: number } {
  const cx = resolveLen(desc.at?.x, w, w / 2);
  const cy = resolveLen(desc.at?.y, h, h / 2);
  const sideX = { closest: Math.min(cx, w - cx), farthest: Math.max(cx, w - cx) };
  const sideY = { closest: Math.min(cy, h - cy), farthest: Math.max(cy, h - cy) };
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => Math.hypot(x - cx, y - cy));
  const explicit = Array.isArray(desc.size) ? desc.size : null;
  const shape = desc.shape || (explicit && explicit.length === 1 ? 'circle' : 'ellipse');
  const size = explicit ? null : (desc.size as string) || 'farthest-corner';
  let rx: number, ry: number;
  if (explicit) {
    rx = resolveLen(explicit[0], w, w / 2);
    ry = shape === 'circle' ? rx : resolveLen(explicit[1] || explicit[0], h, h / 2);
  } else if (shape === 'circle') {
    const r =
      size === 'closest-side'
        ? Math.min(sideX.closest, sideY.closest)
        : size === 'farthest-side'
          ? Math.max(sideX.farthest, sideY.farthest)
          : size === 'closest-corner'
            ? Math.min(...corners)
            : Math.max(...corners);
    rx = ry = r;
  } else {
    const k = size === 'closest-corner' || size === 'farthest-corner' ? Math.SQRT2 : 1;
    const which = size === 'closest-side' || size === 'closest-corner' ? 'closest' : 'farthest';
    rx = sideX[which] * k;
    ry = sideY[which] * k;
  }
  rx = Math.max(0.5, rx);
  ry = Math.max(0.5, ry);
  const C: Pt = [cx, cy];
  return {
    T: transformFromHandles('radial', norm(C, w, h), norm([cx + rx, cy], w, h), norm([cx, cy + ry], w, h)),
    rayPx: rx,
  };
}

/** Cónico → GRADIENT_ANGULAR: el ángulo inicial (CSS `from`) apunta la manija del radio X */
export function conicGeometry(desc: ConicDesc, w: number, h: number): { T: Matrix2x3; rayPx: number } {
  const cx = resolveLen(desc.at?.x, w, w / 2);
  const cy = resolveLen(desc.at?.y, h, h / 2);
  const rad = ((desc.from || 0) * Math.PI) / 180;
  const r = Math.max(w, h) / 2 || 1;
  const dir: Pt = [Math.sin(rad), -Math.cos(rad)];
  const E: Pt = [cx + dir[0] * r, cy + dir[1] * r];
  const W: Pt = [cx - dir[1] * r, cy + dir[0] * r]; // 90° en sentido horario (y hacia abajo)
  return { T: transformFromHandles('radial', norm([cx, cy], w, h), norm(E, w, h), norm(W, w, h)), rayPx: 360 };
}

/**
 * Posiciones finales de las paradas, como CSS: px → fracción del rayo, las que faltan se
 * reparten entre sus vecinas, la primera/última por defecto en 0/1 y nunca hacia atrás.
 */
export function resolveStops(stops: GradientStopIn[], rayPx: number): number[] {
  const n = stops.length;
  const pos: (number | undefined)[] = stops.map(s =>
    typeof s.position === 'number' ? s.position : typeof s.px === 'number' ? s.px / (rayPx || 1) : undefined,
  );
  if (n === 0) return [];
  if (pos[0] === undefined) pos[0] = 0;
  if (pos[n - 1] === undefined) pos[n - 1] = 1;
  // Nunca hacia atrás
  for (let i = 1; i < n; i++) if (pos[i] !== undefined && pos[i]! < pos[i - 1]!) pos[i] = pos[i - 1];
  // Repartir las que faltan entre las conocidas
  let i = 0;
  while (i < n) {
    if (pos[i] !== undefined) {
      i++;
      continue;
    }
    const start = i - 1;
    let end = i;
    while (pos[end] === undefined) end++;
    const a = pos[start]!,
      b = pos[end]!;
    for (let k = start + 1; k < end; k++) pos[k] = a + ((b - a) * (k - start)) / (end - start);
    i = end;
  }
  return pos.map(p => Math.max(0, Math.min(1, p!)));
}
