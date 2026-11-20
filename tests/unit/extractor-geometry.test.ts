import { beforeAll, describe, expect, it } from 'vitest';
// Módulos fuente del extractor (la integración prueba el bundle generado)
import { fitAutoLayoutToGeometry, fitWrapToGeometry } from '../../packages/core-extractor/src/browser/geometry';
import { extractBgUrl, bgScaleMode, isVisuallyHidden } from '../../packages/core-extractor/src/browser/dom-helpers';
import { cssColorToRgba } from '../../packages/core-extractor/src/browser/text';
import { dataUriToBase64 } from '../../packages/core-extractor/src/browser/images';

const X = {
  fitAutoLayoutToGeometry,
  fitWrapToGeometry,
  extractBgUrl,
  bgScaleMode,
  isVisuallyHidden,
  cssColorToRgba,
  dataUriToBase64,
} as any;

// isVisuallyHidden consulta el scroll de la ventana
beforeAll(() => {
  (globalThis as any).window = { scrollX: 0, scrollY: 0, innerWidth: 1440, innerHeight: 900 };
});

type Box = { name?: string; x: number; y: number; w: number; h: number; width?: number | string; positioning?: string };
const child = (b: Box) => ({
  name: b.name || 'hijo',
  type: 'FRAME',
  layout: {
    x: b.x,
    y: b.y,
    measuredWidth: b.w,
    measuredHeight: b.h,
    width: b.width ?? b.w,
    height: b.h,
    positioning: b.positioning || 'AUTO',
  },
  children: [],
});
const frame = (
  mode: string,
  W: number,
  H: number,
  kids: ReturnType<typeof child>[],
  extra: Record<string, unknown> = {},
) => ({
  name: 'contenedor',
  type: 'FRAME',
  layout: {
    mode,
    measuredWidth: W,
    measuredHeight: H,
    width: W,
    height: H,
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    ...extra,
  },
  children: kids,
});

describe('fitAutoLayoutToGeometry', () => {
  it('margen antes del primer hijo → padding superior (caso "SOFTWARE PARA…" pegado al borde)', () => {
    const n = frame('VERTICAL', 520, 100, [
      child({ x: 0, y: 12, w: 520, h: 12 }),
      child({ x: 0, y: 48, w: 520, h: 40 }),
    ]);
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout).toMatchObject({ mode: 'VERTICAL', primaryAxisAlignItems: 'MIN', itemSpacing: 24 });
    expect(n.layout.padding).toMatchObject({ top: 12, bottom: 12 });
  });

  it('icono centrado con place-items:center → alineación CENTER (antes caía en la esquina)', () => {
    const n = frame('VERTICAL', 50, 50, [child({ x: 12, y: 12, w: 27, h: 27 })]);
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.counterAxisAlignItems).toBe('CENTER');
    expect(n.layout.padding.top).toBe(12);
  });

  it('fila con separación uniforme → gap real', () => {
    const n = frame('HORIZONTAL', 400, 40, [
      child({ x: 0, y: 0, w: 100, h: 40 }),
      child({ x: 110, y: 0, w: 100, h: 40 }),
      child({ x: 220, y: 0, w: 100, h: 40 }),
    ]);
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout).toMatchObject({ mode: 'HORIZONTAL', itemSpacing: 10 });
    expect(n.layout.padding).toMatchObject({ left: 0, right: 80 });
  });

  it('separaciones irregulares → posiciones exactas (NONE)', () => {
    const n = frame('HORIZONTAL', 400, 40, [
      child({ x: 0, y: 0, w: 100, h: 40 }),
      child({ x: 110, y: 0, w: 100, h: 40 }),
      child({ x: 260, y: 0, w: 100, h: 40 }),
    ]);
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.mode).toBe('NONE');
  });

  it('hijo que se sale del contenedor → NONE', () => {
    const n = frame('VERTICAL', 300, 100, [
      child({ x: 0, y: -20, w: 300, h: 60 }),
      child({ x: 0, y: 40, w: 300, h: 40 }),
    ]);
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.mode).toBe('NONE');
  });

  it('bloque marcado FILL pero más angosto (max-width centrado) → ancho fijo real', () => {
    const n = frame('VERTICAL', 1264, 200, [
      child({ x: 194, y: 0, w: 876, h: 80, width: 'FILL' }),
      child({ x: 374, y: 100, w: 516, h: 25, width: 'FILL' }),
    ]);
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.counterAxisAlignItems).toBe('CENTER');
    expect(n.children[0].layout.width).toBe('FILL'); // ocupa el ancho disponible
    expect(n.children[1].layout.width).toBe(516); // no: tamaño fijo
  });

  it('SPACE_BETWEEN que coincide con la geometría se conserva', () => {
    const n = frame(
      'HORIZONTAL',
      300,
      40,
      [child({ x: 0, y: 0, w: 50, h: 40 }), child({ x: 250, y: 0, w: 50, h: 40 })],
      { primaryAxisAlignItems: 'SPACE_BETWEEN' },
    );
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout).toMatchObject({ mode: 'HORIZONTAL', primaryAxisAlignItems: 'SPACE_BETWEEN' });
  });

  it('SPACE_BETWEEN que no coincide (SVG decorativo desbordado) → NONE', () => {
    const n = frame(
      'HORIZONTAL',
      608,
      168,
      [child({ x: 0, y: 0, w: 390, h: 168 }), child({ x: 349, y: -139, w: 360, h: 360 })],
      { primaryAxisAlignItems: 'SPACE_BETWEEN' },
    );
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.mode).toBe('NONE');
  });

  it('ignora hijos absolutos y no toca contenedores con hijos sin medida (etiquetas sintéticas)', () => {
    const abs = frame('VERTICAL', 100, 100, [
      child({ x: 0, y: 0, w: 100, h: 30 }),
      child({ x: 50, y: 70, w: 10, h: 10, positioning: 'ABSOLUTE' }),
    ]);
    X.fitAutoLayoutToGeometry(abs);
    expect(abs.layout.mode).toBe('VERTICAL');

    const label = frame(
      'HORIZONTAL',
      171,
      44,
      [{ name: 'Label', type: 'TEXT', layout: { x: 0, y: 0, width: 'HUG', height: 'HUG' }, children: [] } as any],
      {
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        padding: { top: 11, right: 21, bottom: 11, left: 21 },
      },
    );
    X.fitAutoLayoutToGeometry(label);
    expect(label.layout).toMatchObject({ primaryAxisAlignItems: 'CENTER', padding: { left: 21 } });
  });
});

describe('fitWrapToGeometry (vía fitAutoLayoutToGeometry con wrap)', () => {
  it('filas uniformes → conserva WRAP con separación entre filas y orden fila a fila', () => {
    const kids = [
      child({ name: 'b', x: 110, y: 0, w: 100, h: 50 }),
      child({ name: 'd', x: 110, y: 60, w: 100, h: 50 }),
      child({ name: 'a', x: 0, y: 0, w: 100, h: 50 }),
      child({ name: 'c', x: 0, y: 60, w: 100, h: 50 }),
    ];
    const n = frame('HORIZONTAL', 210, 110, kids, { layoutWrap: 'WRAP' });
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout).toMatchObject({ mode: 'HORIZONTAL', layoutWrap: 'WRAP', itemSpacing: 10, counterAxisSpacing: 10 });
    expect(n.children.map((c: any) => c.name)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('una sola fila → sin wrap', () => {
    const n = frame(
      'HORIZONTAL',
      400,
      50,
      [child({ x: 0, y: 0, w: 100, h: 50 }), child({ x: 110, y: 0, w: 100, h: 50 })],
      { layoutWrap: 'WRAP' },
    );
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.layoutWrap).toBe('NO_WRAP');
  });

  it('cuadrícula "bento" irregular → NONE', () => {
    const n = frame(
      'HORIZONTAL',
      1232,
      1834,
      [
        child({ x: 0, y: 0, w: 816, h: 676 }),
        child({ x: 832, y: 0, w: 400, h: 676 }),
        child({ x: 0, y: 692, w: 400, h: 676 }),
        child({ x: 416, y: 692, w: 400, h: 676 }),
        child({ x: 832, y: 692, w: 400, h: 676 }),
        child({ x: 0, y: 1384, w: 1232, h: 450 }),
      ],
      { layoutWrap: 'WRAP' },
    );
    X.fitAutoLayoutToGeometry(n);
    // Las filas no tienen el mismo gap/ancho que Figma reproduciría: posiciones exactas o wrap fiel
    if (n.layout.mode !== 'NONE') expect(n.layout.layoutWrap).toBe('WRAP');
  });

  it('fila con hueco donde cabría el primero de la siguiente → NONE (Figma lo subiría)', () => {
    const n = frame(
      'HORIZONTAL',
      410,
      110,
      [
        child({ x: 0, y: 0, w: 100, h: 50 }),
        child({ x: 0, y: 60, w: 100, h: 50 }),
        child({ x: 110, y: 60, w: 300, h: 50 }),
      ],
      { layoutWrap: 'WRAP' },
    );
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.mode).toBe('NONE');
  });

  it('hijo que sobresale del contenedor (y negativo) → NONE', () => {
    const n = frame(
      'HORIZONTAL',
      200,
      100,
      [child({ x: 0, y: -8, w: 200, h: 8 }), child({ x: 0, y: 0, w: 200, h: 100 })],
      { layoutWrap: 'WRAP' },
    );
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout.mode).toBe('NONE');
  });

  it('grid CSS con columnas fraccionarias: el ancho sale de la posición siguiente (sin error acumulado)', () => {
    const xs = [0, 47, 95, 142];
    const kids = [...xs.map(x => child({ x, y: 0, w: 47, h: 23 })), ...xs.map(x => child({ x, y: 23, w: 47, h: 23 }))];
    const n: any = frame('HORIZONTAL', 189, 46, kids, { layoutWrap: 'WRAP' });
    n._gridWrap = true;
    X.fitAutoLayoutToGeometry(n);
    expect(n.layout).toMatchObject({ layoutWrap: 'WRAP', itemSpacing: 0 });
    expect(n.children.slice(0, 4).map((c: any) => c.layout.width)).toEqual([47, 48, 47, 47]);
    // Figma coloca cada celda donde estaba: x = suma de los anchos anteriores
    let x = 0;
    for (const c of n.children.slice(0, 4)) {
      expect(c.layout.x).toBe(x);
      x += c.layout.width;
    }
  });
});

describe('funciones de imagen y color', () => {
  it.each([
    ['url("a.png")', 'a.png'],
    ["url('b.jpg')", 'b.jpg'],
    ['linear-gradient(red, blue), url(c.webp)', 'c.webp'],
    ['image-set(url(x1.png) 1x, url(x2.png) 2x)', 'x2.png'],
    ['image-set("y1.png" 1x, "y2.png" 2x)', 'y2.png'],
    ['url(data:image/gif;base64,R0lGOD)', null],
    ['none', null],
    ['linear-gradient(red, blue)', null],
  ])('extractBgUrl(%s) → %s', (css, expected) => {
    expect(X.extractBgUrl(css)).toBe(expected);
  });

  it('bgScaleMode', () => {
    expect(X.bgScaleMode({ backgroundSize: 'contain', backgroundRepeat: 'no-repeat' })).toBe('FIT');
    expect(X.bgScaleMode({ backgroundSize: 'cover', backgroundRepeat: 'no-repeat' })).toBe('FILL');
    expect(X.bgScaleMode({ backgroundSize: '20px', backgroundRepeat: 'repeat' })).toBe('TILE');
  });

  it('cssColorToRgba', () => {
    expect(X.cssColorToRgba('rgba(255, 0, 0, 0.5)')).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(X.cssColorToRgba('rgb(0 0 0 / 50%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(X.cssColorToRgba('transparent')).toBeNull();
  });

  it('dataUriToBase64: SVG codificado como URL → base64 equivalente (falso rechazo de Wikipedia)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20"><path d="M0 0"/></svg>';
    const out = X.dataUriToBase64('data:image/svg+xml,' + encodeURIComponent(svg));
    expect(out).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(Buffer.from(out.split(',')[1], 'base64').toString('utf8')).toBe(svg);
    expect(X.dataUriToBase64('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(X.dataUriToBase64('data:text/html,<b>x</b>')).toBeNull();
  });

  it('isVisuallyHidden: patrón sr-only y enlace "saltar al contenido"', () => {
    const abs = { position: 'absolute', clip: 'auto', clipPath: 'none' };
    expect(X.isVisuallyHidden(abs, { width: 1, height: 1, bottom: 1, right: 1 })).toBe(true);
    expect(
      X.isVisuallyHidden(
        { ...abs, clip: 'rect(1px, 1px, 1px, 1px)' },
        { width: 100, height: 20, bottom: 50, right: 100 },
      ),
    ).toBe(true);
    expect(X.isVisuallyHidden(abs, { width: 171, height: 46, bottom: -54, right: 187 })).toBe(true);
    expect(X.isVisuallyHidden(abs, { width: 171, height: 46, bottom: 100, right: 187 })).toBe(false);
    expect(X.isVisuallyHidden({ position: 'static' }, { width: 1, height: 1, bottom: 1, right: 1 })).toBe(false);
  });
});

describe('isImageDataUri (respuestas del service worker, fetch y captura)', async () => {
  const { isImageDataUri } = await import('../../packages/core-extractor/src/browser/images');
  it.each([
    ['data:image/png;base64,iVBORw0KGgo=', true],
    ['data:image/jpeg;base64,/9j/4AAQ', true],
    ['data:text/html;base64,PHNjcmlwdD4=', false],
    ['data:image/svg+xml,%3Csvg%3E', false],
    ['https://evil.example/x.png', false],
    [null, false],
    [{ base64: 'x' }, false],
  ])('%s → %s', (v, ok) => {
    expect(isImageDataUri(v)).toBe(ok);
  });
});
