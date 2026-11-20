import { conicGeometry, linearGeometry, radialGeometry, resolveStops } from './gradient-geometry';

/**
 * Conversión de rellenos CSS a Paint de Figma y de imágenes base64 a bytes.
 */
export function base64ToBytes(dataUrl: string): Uint8Array {
  const clean = dataUrl.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let len = Math.floor(clean.length * 0.75);
  if (clean.endsWith('==')) len -= 2;
  else if (clean.endsWith('=')) len -= 1;
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)],
      e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)],
      e4 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (clean[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (clean[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}

/**
 * Convierte un fill CSS extraído (SOLID / GRADIENT_*) a Paint de Figma.
 * w × h: tamaño del nodo en px. La geometría del degradado depende de su forma (fase 5.4).
 */
export function cssFillToPaint(f: any, w = 100, h = 100): Paint {
  const width = w > 0 ? w : 100;
  const height = h > 0 ? h : 100;
  if (f.type === 'GRADIENT_LINEAR' || f.type === 'GRADIENT_RADIAL' || f.type === 'GRADIENT_ANGULAR') {
    const geo =
      f.type === 'GRADIENT_LINEAR'
        ? linearGeometry(f, width, height)
        : f.type === 'GRADIENT_RADIAL'
          ? radialGeometry(f, width, height)
          : conicGeometry(f, width, height);
    const stops: any[] = f.stops || [];
    const positions = resolveStops(stops, geo.rayPx);
    return {
      type: f.type,
      gradientTransform: geo.T as Transform,
      gradientStops: stops.map((s: any, i: number) => ({
        position: positions[i],
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== undefined ? s.color.a : 1 },
      })),
    } as GradientPaint;
  }
  return {
    type: 'SOLID',
    color: { r: f.r, g: f.g, b: f.b },
    opacity: f.a !== undefined ? f.a : 1,
  };
}
