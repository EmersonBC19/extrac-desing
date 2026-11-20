import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createLogger, formatLogRecord, parseLogLevel, type LogRecord } from '../../packages/contracts/src/index';
import { rotatingFileSink } from '../../packages/mcp-server/src/log-file';

describe('logger', () => {
  it('filtra por nivel, anida ámbitos y adjunta metadatos', () => {
    const out: LogRecord[] = [];
    const log = createLogger('hub', { sinks: [r => out.push(r)], level: 'info' });
    log.debug('oculto');
    log.child('auth').warn('intento fallido', { origen: 'null' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      level: 'warn',
      scope: 'hub:auth',
      message: 'intento fallido',
      data: { origen: 'null' },
    });
    expect(formatLogRecord(out[0])).toBe('[hub:auth] intento fallido {"origen":"null"}');
  });

  it('un sink que falla no tumba al que registra', () => {
    const ok: string[] = [];
    const log = createLogger('x', {
      sinks: [
        () => {
          throw new Error('roto');
        },
        r => ok.push(r.message),
      ],
    });
    expect(() => log.error('sigue')).not.toThrow();
    expect(ok).toEqual(['sigue']);
  });

  it('parseLogLevel acepta solo niveles válidos', () => {
    expect(parseLogLevel('debug')).toBe('debug');
    expect(parseLogLevel('verbose')).toBe('info');
    expect(parseLogLevel(undefined, 'warn')).toBe('warn');
  });

  it('archivo rotativo: no crece sin límite y guarda un respaldo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-log-'));
    const file = path.join(dir, 'sub', 'hub.log');
    try {
      const log = createLogger('hub', { sinks: [rotatingFileSink(file, 400)] });
      for (let i = 0; i < 30; i++) log.info(`mensaje ${i}`);
      expect(fs.statSync(file).size).toBeLessThanOrEqual(400);
      expect(fs.existsSync(file + '.1')).toBe(true);
      const last = fs
        .readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .map(l => JSON.parse(l));
      expect(last.at(-1).message).toBe('mensaje 29');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
