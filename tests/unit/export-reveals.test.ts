// Transición de entrada de las animaciones al hacer scroll en la exportación HTML
import { describe, expect, it } from 'vitest';
import { enterTransition } from '../../packages/core-extractor/src/browser/export-reveals';

const DEFAULT = 'opacity 0.6s ease-out, transform 0.6s ease-out, filter 0.6s ease-out';

describe('transición de entrada', () => {
  it('conserva la del elemento si anima opacity, transform o all', () => {
    expect(enterTransition('opacity 0.4s ease, transform 0.4s ease')).toBe('opacity 0.4s ease, transform 0.4s ease');
    expect(enterTransition('all 300ms cubic-bezier(0.2, 0, 0, 1)')).toBe('all 300ms cubic-bezier(0.2, 0, 0, 1)');
    expect(enterTransition('transform .8s')).toBe('transform .8s');
  });

  it('sin transición útil usa 0,6 s ease-out', () => {
    expect(enterTransition(undefined)).toBe(DEFAULT);
    expect(enterTransition('')).toBe(DEFAULT);
    expect(enterTransition('all 0s ease 0s')).toBe(DEFAULT);
    expect(enterTransition('color 0.3s ease')).toBe(DEFAULT);
  });
});
