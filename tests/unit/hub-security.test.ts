import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  classifyOrigin,
  generatePairingCode,
  loadOrCreatePairingCode,
  normalizePairingCode,
  pairingCodeMatches,
  PairingRateLimiter,
  validateViewRenderRequest,
} from '../../packages/mcp-server/src/hub-security';

describe('classifyOrigin', () => {
  it.each([
    [undefined, 'local'],
    ['', 'local'],
    ['null', 'needs-pairing'],
    ['chrome-extension://abcdefghijklmnop', 'extension'],
    ['https://www.figma.com', 'figma'],
    ['https://figma.com', 'figma'],
    ['https://sitio-malicioso.example', 'rejected'],
    ['http://localhost:3000', 'rejected'],
    ['https://figma.com.evil.example', 'rejected'],
    ['https://evilfigma.com', 'rejected'],
    ['no es una url', 'rejected'],
  ])('%s → %s', (origin, expected) => {
    expect(classifyOrigin(origin as string | undefined)).toBe(expected);
  });

  it('con lista de extensiones permitidas, rechaza las demás', () => {
    expect(classifyOrigin('chrome-extension://buena', ['buena'])).toBe('extension');
    expect(classifyOrigin('chrome-extension://otra', ['buena'])).toBe('rejected');
  });
});

describe('código de vinculación', () => {
  it('formato XXXX-XXXX sin caracteres ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const c = generatePairingCode();
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it('acepta minúsculas, sin guion o con espacios', () => {
    expect(pairingCodeMatches('ABCD-EFGH', 'abcd-efgh')).toBe(true);
    expect(pairingCodeMatches('ABCD-EFGH', 'ABCDEFGH')).toBe(true);
    expect(pairingCodeMatches('ABCD-EFGH', ' abcd efgh ')).toBe(true);
    expect(normalizePairingCode('ab-cd')).toBe('ABCD');
  });

  it('rechaza códigos distintos, vacíos o de otro tipo', () => {
    expect(pairingCodeMatches('ABCD-EFGH', 'ABCD-EFGX')).toBe(false);
    expect(pairingCodeMatches('ABCD-EFGH', '')).toBe(false);
    expect(pairingCodeMatches('ABCD-EFGH', undefined)).toBe(false);
    expect(pairingCodeMatches('ABCD-EFGH', { code: 'ABCD-EFGH' })).toBe(false);
    expect(pairingCodeMatches('', '')).toBe(false);
  });

  it('se genera una vez y se reutiliza (persistente)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-pair-'));
    try {
      const a = loadOrCreatePairingCode(dir);
      const b = loadOrCreatePairingCode(dir);
      expect(b.code).toBe(a.code);
      expect(fs.readFileSync(a.file, 'utf8').trim()).toBe(a.code);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('PairingRateLimiter', () => {
  it('bloquea tras 5 fallos y libera pasado el minuto', () => {
    const rl = new PairingRateLimiter(5, 60_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) rl.recordFailure(t0 + i);
    expect(rl.isLocked(t0 + 10)).toBe(false);
    rl.recordFailure(t0 + 5);
    expect(rl.isLocked(t0 + 10)).toBe(true);
    expect(rl.isLocked(t0 + 60_010)).toBe(false);
  });
});

describe('validateViewRenderRequest (antes: inyección de comandos y path traversal)', () => {
  const catalog = ['dashboard', 'users'];

  it('acepta una vista del catálogo', () => {
    expect(validateViewRenderRequest({ viewId: 'users', route: '/administration/users', name: 'Usuarios' }, catalog))
      .toMatchObject({ viewId: 'users', route: '/administration/users', name: 'Usuarios' });
  });

  it.each([
    ['inyección en viewId', { viewId: 'x" & calc & "' }],
    ['path traversal en viewId', { viewId: '../../../package' }],
    ['viewId fuera del catálogo', { viewId: 'secretos' }],
    ['viewId no texto', { viewId: { $ne: 1 } }],
    ['inyección en route', { viewId: 'dashboard', route: '/x"; calc; "' }],
    ['route con espacios y comillas', { viewId: 'dashboard', route: '/a b' }],
  ])('rechaza: %s', (_n, payload) => {
    expect(typeof validateViewRenderRequest(payload, catalog)).toBe('string');
  });

  it('limpia name/pageName de caracteres de shell', () => {
    const r = validateViewRenderRequest({ viewId: 'dashboard', name: 'Panel $(rm -rf) `x` "y"', pageName: 'Pág & ; |' }, catalog);
    expect(typeof r).toBe('object');
    if (typeof r === 'object') {
      expect(r.name).not.toMatch(/[$`"&;|()]/);
      expect(r.pageName).not.toMatch(/[$`"&;|()]/);
    }
  });
});
