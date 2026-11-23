import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizePayloadWithGemini } from '../../packages/mcp-server/src/ai-optimizer';

describe('ai-optimizer (Gemini Flash)', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('retorna optimized: false si no hay API key', async () => {
    const payload = { rootNode: { id: 'root', type: 'FRAME', children: [] } };
    const res = await optimizePayloadWithGemini(payload, '');
    expect(res.optimized).toBe(false);
    expect(res.reason).toContain('no configurada');
    expect(res.payload).toBe(payload);
  });

  it('retorna optimized: false si el payload no contiene rootNode ni nodes', async () => {
    const payload = { algo: 'invalido' };
    const res = await optimizePayloadWithGemini(payload, 'test-key-123');
    expect(res.optimized).toBe(false);
    expect(res.reason).toContain('Payload sin rootNode');
  });

  it('optimiza exitosamente el árbol y restaura imágenes base64', async () => {
    const fakeImageBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const payload = {
      rootNode: {
        id: 'root-1',
        type: 'FRAME',
        name: 'div',
        children: [
          {
            id: 'redundant-wrapper',
            type: 'FRAME',
            name: 'div.wrapper',
            children: [
              {
                id: 'child-card',
                type: 'FRAME',
                name: 'div.card',
                imageData: fakeImageBase64,
                children: [],
              },
            ],
          },
        ],
      },
    };

    // Mock fetch de Gemini
    const mockOptimizedTree = {
      id: 'root-1',
      type: 'FRAME',
      name: 'Card / Container',
      children: [
        {
          id: 'child-card',
          type: 'FRAME',
          name: 'Card / Item',
          imageData: '__IMG_TOKEN_child-card__',
          children: [],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n' + JSON.stringify(mockOptimizedTree) + '\n```',
                },
              ],
            },
          },
        ],
      }),
    } as any);

    const res = await optimizePayloadWithGemini(payload, 'AIzaSyFakeKey');
    expect(res.optimized).toBe(true);
    expect(res.modelUsed).toBe('gemini-2.5-flash');
    expect(res.payload.aiOptimized).toBe(true);

    // Verificar que podó el wrapper redundante
    const newRoot = res.payload.rootNode;
    expect(newRoot.name).toBe('Card / Container');
    expect(newRoot.children.length).toBe(1);
    expect(newRoot.children[0].name).toBe('Card / Item');

    // Verificar que restauró la imagen original desde el placeholder
    expect(newRoot.children[0].imageData).toBe(fakeImageBase64);
  });

  it('maneja errores de la API HTTP con gracia sin lanzar excepciones', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'API key not valid. Please pass a valid API key.',
    } as any);

    const payload = { rootNode: { id: 'root', type: 'FRAME', children: [] } };
    const res = await optimizePayloadWithGemini(payload, 'bad-key');
    expect(res.optimized).toBe(false);
    expect(res.reason).toContain('Gemini API error 403');
    expect(res.payload).toBe(payload);
  });

  it('maneja timeout o abort de red sin fallar la extracción', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const payload = { rootNode: { id: 'root', type: 'FRAME', children: [] } };
    const res = await optimizePayloadWithGemini(payload, 'valid-key', { timeoutMs: 50 });
    expect(res.optimized).toBe(false);
    expect(res.reason).toContain('Timeout');
    expect(res.payload).toBe(payload);
  });

  it('si un modelo devuelve 404 (retirado o no soportado), prueba automáticamente el siguiente candidato', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes('gemini-2.5-flash:generateContent')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => 'models/gemini-2.5-flash is not found for API version v1beta',
        });
      }
      // Segundo intento: gemini-2.5-flash-lite
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({ id: 'root', type: 'FRAME', name: 'Optimized', children: [] }),
                  },
                ],
              },
            },
          ],
        }),
      });
    });

    const payload = { rootNode: { id: 'root', type: 'FRAME', children: [] } };
    const res = await optimizePayloadWithGemini(payload, 'valid-key');
    expect(res.optimized).toBe(true);
    expect(res.modelUsed).toBe('gemini-2.5-flash-lite');
    expect(callCount).toBe(2);
  });
});
