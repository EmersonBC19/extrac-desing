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

// Convierte un fill CSS extraído (SOLID / GRADIENT_*) a Paint de Figma
export function cssFillToPaint(f: any): Paint {
  if (f.type === 'GRADIENT_RADIAL') {
    const transform: Transform = [
      [0.5, 0, 0.5],
      [0, 0.5, 0.5],
    ];
    return {
      type: 'GRADIENT_RADIAL',
      gradientTransform: transform,
      gradientStops: (f.stops || []).map((s: any) => ({
        position: Math.max(0, Math.min(1, s.position)),
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== undefined ? s.color.a : 1 },
      })),
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
    const transform: Transform = [
      [dx, dy, x1],
      [-dy, dx, y1],
    ];
    return {
      type: 'GRADIENT_LINEAR',
      gradientTransform: transform,
      gradientStops: (f.stops || []).map((s: any) => ({
        position: Math.max(0, Math.min(1, s.position)),
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a !== undefined ? s.color.a : 1 },
      })),
    };
  }
  return {
    type: 'SOLID',
    color: { r: f.r, g: f.g, b: f.b },
    opacity: f.a !== undefined ? f.a : 1,
  };
}
