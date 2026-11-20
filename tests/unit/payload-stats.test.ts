import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  heavyPayloadReasons,
  measurePayload,
  splitIntoChunks,
  withoutImages,
  HEAVY_PAYLOAD,
  type UINode,
} from '../../packages/contracts/src/index';
import { ChunkAssembler } from '../../packages/mcp-server/src/chunk-assembler';

const node = (name: string, extra: Partial<UINode> = {}, children: UINode[] = []): UINode => ({
  id: name,
  name,
  type: 'FRAME',
  layout: { mode: 'NONE' } as any,
  styles: { fills: [] },
  children,
  ...extra,
});
const IMG = 'data:image/png;base64,' + 'A'.repeat(1000);

describe('peso de una extracción', () => {
  const tree = node('raíz', {}, [
    node('foto', { imageData: IMG }),
    node('bloque', {}, [node('texto', { type: 'TEXT', textData: { characters: 'Hola mundo' } as any })]),
  ]);

  it('cuenta nodos, imágenes, texto, profundidad y bytes', () => {
    const s = measurePayload(tree);
    expect(s).toMatchObject({ nodes: 4, images: 1, imageBytes: IMG.length, textChars: 10, depth: 3 });
    expect(s.bytes).toBe(JSON.stringify(tree).length);
  });

  it('árbol muy profundo: sin desbordar la pila', () => {
    let deep = node('hoja');
    for (let i = 0; i < 20_000; i++) deep = node('n' + i, {}, [deep]);
    const s = measurePayload(deep);
    expect(s.nodes).toBe(20_001);
    expect(s.depth).toBe(20_001);
  });

  it('una landing típica no se considera pesada; los extremos sí, con el motivo', () => {
    const typical = { nodes: 6000, images: 40, imageBytes: 3e6, textChars: 9000, depth: 40, bytes: 4.4 * 1024 * 1024 };
    expect(heavyPayloadReasons(typical)).toEqual([]);
    const heavy = { ...typical, bytes: HEAVY_PAYLOAD.bytes + 1, imageBytes: HEAVY_PAYLOAD.bytes * 0.9, nodes: 30_000 };
    const reasons = heavyPayloadReasons(heavy);
    expect(reasons[0]).toMatch(/MB de datos \(\d+% en 40 imágenes\)/);
    expect(reasons[1]).toMatch(/capas/);
  });

  it('sin imágenes: conserva el tamaño con un recuadro gris y no toca el original', () => {
    const out = withoutImages(tree);
    const foto = out.children![0];
    expect(foto.imageData).toBeUndefined();
    expect(foto.styles.fills).toHaveLength(1);
    expect(foto.metadata?.imageOmitted).toBe(true);
    expect(tree.children![0].imageData).toBe(IMG); // el original intacto
    expect(measurePayload(out).images).toBe(0);
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});

describe('envío por partes', () => {
  it('las partes reconstruyen el texto exacto, sin partir un emoji', () => {
    const text = ('ab😀'.repeat(5000) + '{"x":1}').slice(0, 15001);
    const parts = splitIntoChunks(text, 7);
    expect(parts.join('')).toBe(text);
    for (const p of parts) {
      const last = p.charCodeAt(p.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false); // ningún par sustituto cortado
      expect(() => JSON.parse(JSON.stringify(p))).not.toThrow();
    }
  });

  it('ensamblador: acepta desorden y completa', () => {
    const a = new ChunkAssembler();
    expect(a.accept({ transferId: 't', index: 1, total: 3, data: 'B' })).toMatchObject({
      status: 'progress',
      received: 1,
    });
    expect(a.accept({ transferId: 't', index: 0, total: 3, data: 'A' })).toMatchObject({
      status: 'progress',
      received: 2,
    });
    expect(a.accept({ transferId: 't', index: 2, total: 3, data: 'C' })).toMatchObject({
      status: 'complete',
      text: 'ABC',
    });
    expect(a.pending()).toBe(0);
  });

  it('ensamblador: rechaza repetidas, totales incoherentes, índices fuera de rango y exceso de tamaño', () => {
    const a = new ChunkAssembler({ maxBytes: 10, maxTransfers: 5, ttlMs: 60_000 });
    a.accept({ transferId: 'r', index: 0, total: 2, data: 'x' });
    expect(a.accept({ transferId: 'r', index: 0, total: 2, data: 'x' })).toMatchObject({ status: 'error' });
    a.accept({ transferId: 'i', index: 0, total: 2, data: 'x' });
    expect(a.accept({ transferId: 'i', index: 1, total: 3, data: 'x' })).toMatchObject({ status: 'error' });
    expect(a.accept({ transferId: 'o', index: 5, total: 2, data: 'x' })).toMatchObject({ status: 'error' });
    expect(a.accept({ transferId: 'big', index: 0, total: 2, data: 'x'.repeat(11) })).toMatchObject({
      status: 'error',
      error: expect.stringMatching(/tamaño máximo/),
    });
    expect(a.pending()).toBe(0); // los fallidos se descartan
  });

  it('ensamblador: tope de envíos simultáneos y caducidad de los incompletos', () => {
    let now = 0;
    const a = new ChunkAssembler({ maxBytes: 1e6, maxTransfers: 2, ttlMs: 1000 }, () => now);
    a.accept({ transferId: 'a', index: 0, total: 2, data: 'x' });
    a.accept({ transferId: 'b', index: 0, total: 2, data: 'x' });
    expect(a.accept({ transferId: 'c', index: 0, total: 2, data: 'x' })).toMatchObject({ status: 'error' });
    now = 5000; // los incompletos caducan y liberan su lugar
    expect(a.accept({ transferId: 'c', index: 0, total: 2, data: 'x' })).toMatchObject({ status: 'progress' });
    expect(a.pending()).toBe(1);
  });
});
