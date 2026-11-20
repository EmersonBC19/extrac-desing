// Resolución de fuentes del plugin (fase 5.3): orden de candidatas para una pila CSS
import { describe, expect, it } from 'vitest';
import { fontCandidates, isGenericFamily } from '../../packages/figma-plugin/src/fonts';

describe('familias candidatas para una pila CSS', () => {
  it('recorre la pila completa, no solo la primera familia', () => {
    const c = fontCandidates('"Circular", Helvetica, Arial, sans-serif', {});
    // Circular y su equivalente más parecido, luego Helvetica y el suyo, luego Arial…
    expect(c.slice(0, 5)).toEqual(['Circular', 'Inter', 'Helvetica', 'Helvetica Neue', 'Arial']);
  });

  it('las genéricas se expanden a familias reales (system-ui, serif, monospace)', () => {
    expect(fontCandidates('-apple-system, BlinkMacSystemFont, sans-serif', {}).slice(0, 2)).toEqual([
      'SF Pro Text',
      'SF Pro Display',
    ]);
    expect(fontCandidates('Georgia, serif', {})[0]).toBe('Georgia');
    expect(fontCandidates('ui-monospace, monospace', {})).toContain('Menlo');
    expect(isGenericFamily('Sans-Serif')).toBe(true);
    expect(isGenericFamily('Inter')).toBe(false);
  });

  it('la equivalencia del usuario va primero y sin repetidos', () => {
    const c = fontCandidates('Circular, sans-serif', { circular: 'Manrope' });
    expect(c[0]).toBe('Manrope');
    expect(new Set(c.map(x => x.toLowerCase())).size).toBe(c.length);
  });

  it('pila vacía o rara: siempre hay respaldo', () => {
    expect(fontCandidates('', {})).toContain('Inter');
    expect(fontCandidates(undefined, {})[0]).toBe('Inter');
  });
});
