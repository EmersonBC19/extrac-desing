// Degradados CSS → gradientTransform de Figma (fase 5.4)
import { describe, expect, it } from 'vitest';
import {
  apply,
  conicGeometry,
  cornerAngle,
  invert,
  linearGeometry,
  radialGeometry,
  resolveStops,
  type Matrix2x3,
  type Pt,
} from '../../packages/figma-plugin/src/gradient-geometry';

/** Dónde caen las manijas en el nodo (px) para una T dada */
const handles = (T: Matrix2x3, kind: 'linear' | 'radial', w: number, h: number) => {
  const M = invert(T);
  const pts: Pt[] =
    kind === 'linear'
      ? [
          [0, 0.5],
          [1, 0.5],
          [0, 1],
        ]
      : [
          [0.5, 0.5],
          [1, 0.5],
          [0.5, 1],
        ];
  return pts.map(p => {
    const [x, y] = apply(M, p);
    return [Math.round(x * w * 100) / 100 + 0, Math.round(y * h * 100) / 100 + 0];
  });
};
const close = (m: Matrix2x3, ref: Matrix2x3) => m.flat().forEach((v, i) => expect(v).toBeCloseTo(ref.flat()[i], 6));

describe('degradado lineal', () => {
  it('90° en un cuadrado = identidad (referencia de la documentación de Figma: izquierda → derecha)', () => {
    close(linearGeometry({ angle: 90 }, 100, 100).T, [
      [1, 0, 0],
      [0, 1, 0],
    ]);
  });

  it('180° (hacia abajo, el más común) va de arriba a abajo en todo el alto, también en nodos no cuadrados', () => {
    const [S, E] = handles(linearGeometry({ angle: 180 }, 300, 100).T, 'linear', 300, 100);
    expect(S).toEqual([150, 0]);
    expect(E).toEqual([150, 100]);
  });

  it('45° en un rectángulo: la línea CSS cruza el centro y mide |w·sen| + |h·cos|', () => {
    const { T, rayPx } = linearGeometry({ angle: 45 }, 200, 100);
    expect(rayPx).toBeCloseTo(200 * Math.SQRT1_2 + 100 * Math.SQRT1_2, 6);
    const [S, E] = handles(T, 'linear', 200, 100);
    expect((S[0] + E[0]) / 2).toBeCloseTo(100, 1);
    expect((S[1] + E[1]) / 2).toBeCloseTo(50, 1);
    expect(E[0]).toBeGreaterThan(S[0]); // hacia la derecha
    expect(E[1]).toBeLessThan(S[1]); // y hacia arriba
  });

  it('"to top right" depende de la forma del nodo', () => {
    expect(cornerAngle('top right', 100, 100)).toBeCloseTo(45, 6);
    expect(cornerAngle('bottom right', 100, 100)).toBeCloseTo(135, 6);
    expect(cornerAngle('top right', 400, 100)).toBeCloseTo((Math.atan2(100, 400) * 180) / Math.PI, 6);
  });
});

describe('degradado radial', () => {
  it('por defecto: elipse centrada que llega a las esquinas (farthest-corner)', () => {
    const [C, X, Y] = handles(radialGeometry({}, 200, 100).T, 'radial', 200, 100);
    expect(C).toEqual([100, 50]);
    expect(X[0] - C[0]).toBeCloseTo(100 * Math.SQRT2, 1);
    expect(Y[1] - C[1]).toBeCloseTo(50 * Math.SQRT2, 1);
  });

  it('circle at 25% 75% closest-side', () => {
    const [C, X, Y] = handles(
      radialGeometry(
        { shape: 'circle', size: 'closest-side', at: { x: { v: 25, u: '%' }, y: { v: 75, u: '%' } } },
        200,
        100,
      ).T,
      'radial',
      200,
      100,
    );
    expect(C).toEqual([50, 75]);
    expect(X[0] - C[0]).toBeCloseTo(25, 1); // lado más cercano: abajo (25 px)
    expect(Y[1] - C[1]).toBeCloseTo(25, 1);
  });

  it('tamaño explícito en px', () => {
    const [C, X, Y] = handles(
      radialGeometry(
        {
          size: [
            { v: 40, u: 'px' },
            { v: 10, u: 'px' },
          ],
        },
        200,
        100,
      ).T,
      'radial',
      200,
      100,
    );
    expect([X[0] - C[0], Y[1] - C[1]]).toEqual([40, 10]);
  });
});

describe('cónico → angular', () => {
  it('centro en `at` y manija inicial hacia `from` (0° = arriba)', () => {
    const [C, X] = handles(conicGeometry({ from: 90 }, 100, 100).T, 'radial', 100, 100);
    expect(C).toEqual([50, 50]);
    expect(X[0]).toBeGreaterThan(C[0]); // 90° apunta a la derecha
    expect(X[1]).toBeCloseTo(C[1], 1);
  });
});

describe('paradas', () => {
  const c = { r: 0, g: 0, b: 0 };
  it('reparte las que faltan, convierte px y nunca retrocede', () => {
    expect(resolveStops([{ color: c }, { color: c }, { color: c }], 100)).toEqual([0, 0.5, 1]);
    expect(resolveStops([{ color: c, px: 20 }, { color: c }, { color: c, position: 0.6 }], 100)).toEqual([
      0.2, 0.4, 0.6,
    ]);
    expect(
      resolveStops(
        [
          { color: c, position: 0.5 },
          { color: c, position: 0.3 },
        ],
        100,
      ),
    ).toEqual([0.5, 0.5]);
  });
});
