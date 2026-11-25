import { describe, expect, it } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { WebSocket } from 'ws';
import { createRequire } from 'module';
import { ROOT } from '../helpers/code-loaders.cjs';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { freePort } = require('../helpers/hub.cjs');

const isWin = process.platform === 'win32';
const EXE = path.join(ROOT, 'packages/mcp-server/dist', isWin ? 'code-to-figma-hub.exe' : 'code-to-figma-hub');

// El ejecutable no se versiona (se genera con `npm run build:hub-exe`): sin él, la prueba se salta
// en lugar de fallar (la CI no lo genera).
const HAS_EXE = fs.existsSync(EXE);

// Carpeta temporal propia: el hub instalado escribe su log y el código de vinculación en el perfil
// del usuario; la prueba no debe tocar los reales.
const sandboxEnv = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-hub-sea-'));
  return {
    dir,
    env: {
      ...process.env,
      WS_HOST: '127.0.0.1',
      CTF_PAIRING_DIR: dir,
      CTF_LOG_FILE: path.join(dir, 'hub.log'),
      HOME: dir,
      USERPROFILE: dir,
    },
  };
};

describe.skipIf(!HAS_EXE)('Hub autónomo empaquetado (Node SEA — Fase 7)', () => {
  it('el ejecutable fue generado', () => {
    const stat = fs.statSync(EXE);
    expect(stat.size).toBeGreaterThan(20 * 1024 * 1024); // El binario de Node SEA pesa > 20 MB
  });

  it('arranca, abre puerto, atiende WebSockets y una segunda instancia sale limpiamente', async () => {
    const TEST_PORT = await freePort();
    const { dir, env } = sandboxEnv();
    const proc1 = spawn(EXE, [], { env: { ...env, WS_PORT: String(TEST_PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });

    try {
      // Esperar a que el primer hub esté escuchando
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout esperando inicio del hub')), 12000);
        proc1.stdout?.on('data', data => {
          if (data.toString().includes('Figma WebSocket Hub')) {
            clearTimeout(timeout);
            resolve();
          }
        });
        proc1.once('exit', code => {
          clearTimeout(timeout);
          reject(new Error(`El hub terminó antes de iniciar (código ${code})`));
        });
        proc1.on('error', err => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Conectar un cliente WebSocket al hub
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();

      // Segunda instancia en el mismo puerto: debe salir con código 0 (instancia única sin error)
      const code2 = await new Promise<number | null>(resolve => {
        const proc2 = spawn(EXE, [], { env: { ...env, WS_PORT: String(TEST_PORT) }, stdio: 'ignore' });
        proc2.on('exit', code => resolve(code));
      });
      expect(code2).toBe(0);
    } finally {
      proc1.kill();
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (_e) {}
    }
  }, 20_000);
});
