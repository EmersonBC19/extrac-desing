// transición CSS → Smart Animate de Figma
import { describe, expect, it } from 'vitest';
import { cssEasingToFigma, hoverReaction, smartAnimateFrom } from '../../packages/figma-plugin/src/prototype';

describe('curva CSS → Easing de Figma', () => {
  it('nombres de CSS', () => {
    expect(cssEasingToFigma('ease-out')).toEqual({ type: 'EASE_OUT' });
    expect(cssEasingToFigma('ease-in')).toEqual({ type: 'EASE_IN' });
    expect(cssEasingToFigma('ease-in-out')).toEqual({ type: 'EASE_IN_AND_OUT' });
    expect(cssEasingToFigma('linear')).toEqual({ type: 'LINEAR' });
    // "ease" (el valor por defecto de CSS) no existe en Figma: su cúbica exacta
    expect(cssEasingToFigma('ease')).toEqual({
      type: 'CUSTOM_CUBIC_BEZIER',
      easingFunctionCubicBezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
    });
  });

  it('cubic-bezier propia (con rebote en y) y x fuera de rango acotada', () => {
    expect(cssEasingToFigma('cubic-bezier(0.34, 1.56, 0.64, 1)')).toEqual({
      type: 'CUSTOM_CUBIC_BEZIER',
      easingFunctionCubicBezier: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
    });
    expect(cssEasingToFigma('cubic-bezier(1.2, 0, -0.1, 1)')!.easingFunctionCubicBezier).toMatchObject({
      x1: 1,
      x2: 0,
    });
  });

  it('steps() y step-start/end → sin animación (CSS no interpola)', () => {
    expect(cssEasingToFigma('steps(4, end)')).toBeNull();
    expect(cssEasingToFigma('step-start')).toBeNull();
    expect(cssEasingToFigma('linear(0, 0.5 25%, 1)')).toEqual({ type: 'LINEAR' });
  });
});

describe('Smart Animate', () => {
  it('duración en segundos; sin dato → 300 ms ease-out; 0 s o steps → cambio instantáneo', () => {
    expect(smartAnimateFrom({ durationMs: 450, easing: 'ease-in' })).toEqual({
      type: 'SMART_ANIMATE',
      easing: { type: 'EASE_IN' },
      duration: 0.45,
    });
    expect(smartAnimateFrom(null)).toMatchObject({ duration: 0.3, easing: { type: 'EASE_OUT' } });
    expect(smartAnimateFrom(undefined)).toMatchObject({ duration: 0.3 });
    expect(smartAnimateFrom({ durationMs: 0, easing: 'ease' })).toBeNull();
    expect(smartAnimateFrom({ durationMs: 200, easing: 'steps(2)' })).toBeNull();
    expect(smartAnimateFrom({ durationMs: 60000, easing: 'linear' })!.duration).toBe(10);
  });

  it('interacción: al pasar el ratón → cambiar a la variante destino', () => {
    expect(hoverReaction('1:5', { durationMs: 300, easing: 'ease-out' })).toEqual({
      trigger: { type: 'ON_HOVER' },
      actions: [
        {
          type: 'NODE',
          destinationId: '1:5',
          navigation: 'CHANGE_TO',
          transition: { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.3 },
          resetVideoPosition: false,
        },
      ],
    });
  });
});
