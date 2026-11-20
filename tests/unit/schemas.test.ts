import { describe, expect, it } from 'vitest';
import { validateRenderPayload, validateUINodeTree, PAYLOAD_LIMITS } from '../../packages/contracts/src/schemas';

const frame = (extra: Record<string, unknown> = {}) => ({
  id: 'r',
  type: 'FRAME',
  name: 'x',
  layout: {},
  children: [],
  ...extra,
});

describe('validateRenderPayload', () => {
  it('acepta un payload mínimo válido', () => {
    const r = validateRenderPayload({
      rootNode: frame({ children: [{ type: 'TEXT', textData: { characters: 'Hola' } }] }),
    });
    expect(r).toMatchObject({ ok: true, nodeCount: 2, maxDepth: 1 });
  });

  it('acepta campos desconocidos (passthrough) para no romper con versiones nuevas', () => {
    const r = validateRenderPayload({ rootNode: frame({ campoNuevo: 1, layout: { otroCampo: 'x' } }), extra: true });
    expect(r.ok).toBe(true);
  });

  it('acepta imágenes base64 de cualquier tipo de imagen', () => {
    for (const mime of ['png', 'jpeg', 'gif', 'webp', 'svg+xml', 'avif']) {
      expect(validateRenderPayload({ rootNode: frame({ imageData: `data:image/${mime};base64,AAAA` }) }).ok).toBe(true);
    }
  });

  it.each([
    ['tipo de nodo inválido', { rootNode: frame({ type: 'SCRIPT' }) }, /type/],
    [
      'SVG con <script>',
      { rootNode: frame({ children: [{ type: 'SVG', svgContent: '<svg><script>alert(1)</script></svg>' }] }) },
      /script/,
    ],
    [
      'SVG con javascript:',
      { rootNode: frame({ children: [{ type: 'SVG', svgContent: '<svg><a href="javascript:alert(1)"/></svg>' }] }) },
      /javascript/,
    ],
    [
      'imageData que no es imagen',
      { rootNode: frame({ imageData: 'data:text/html;base64,PHNjcmlwdD4=' }) },
      /imageData/,
    ],
    ['imageData con URL externa', { rootNode: frame({ imageData: 'https://evil.example/x.png' }) }, /imageData/],
    ['imageData no base64', { rootNode: frame({ imageData: 'data:image/svg+xml,%3Csvg%3E' }) }, /imageData/],
    ['coordenada no numérica', { rootNode: frame({ layout: { x: 'NaN' } }) }, /layout\.x/],
    ['coordenada infinita', { rootNode: frame({ layout: { x: Infinity } }) }, /layout\.x/],
    [
      'texto gigante',
      { rootNode: { type: 'TEXT', textData: { characters: 'a'.repeat(PAYLOAD_LIMITS.maxTextChars + 1) } } },
      /characters/,
    ],
    ['rootNode que no es objeto', { rootNode: 'hola' }, /rootNode/],
    ['board no booleano', { rootNode: frame(), board: 'si' }, /board/],
    ['children que no es lista', { rootNode: frame({ children: 'x' }) }, /children/],
  ])('rechaza: %s', (_name, payload, error) => {
    const r = validateRenderPayload(payload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(error);
  });

  it('rechaza un árbol de 5000 niveles sin desbordar la pila (recorrido iterativo)', () => {
    let deep: any = { type: 'FRAME', children: [] };
    const root = deep;
    for (let i = 0; i < 5000; i++) {
      const c = { type: 'FRAME', children: [] };
      deep.children.push(c);
      deep = c;
    }
    const r = validateUINodeTree(root);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/demasiado profundo/);
      expect(r.error.length).toBeLessThan(300); // ruta acortada, legible
    }
  });

  it('rechaza más nodos que el límite', () => {
    const r = validateUINodeTree({
      type: 'FRAME',
      children: Array.from({ length: PAYLOAD_LIMITS.maxNodes + 1 }, () => ({ type: 'FRAME' })),
    });
    expect(r).toMatchObject({ ok: false });
  });

  it('indica la ruta exacta del nodo inválido', () => {
    const r = validateRenderPayload({
      rootNode: frame({ children: [frame(), frame({ children: [{ type: 'BAD' }] })] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('rootNode.children[1].children[0]');
  });
});

describe('estados (fase 6.1)', () => {
  const node = { type: 'FRAME', name: 'Botón', children: [] };
  it('acepta estados válidos y valida cada árbol', async () => {
    const { validateRenderPayload } = await import('../../packages/contracts/src/schemas');
    expect(validateRenderPayload({ rootNode: node, states: [{ name: 'Hover', rootNode: node }] }).ok).toBe(true);
    const bad = validateRenderPayload({ rootNode: node, states: [{ name: 'Hover', rootNode: { type: 'SCRIPT' } }] });
    expect(bad.ok).toBe(false);
    expect((bad as any).error).toMatch(/^states\[0\]/);
    expect(validateRenderPayload({ rootNode: node, states: Array(5).fill({ name: 'X', rootNode: node }) }).ok).toBe(
      false,
    );
  });
});
