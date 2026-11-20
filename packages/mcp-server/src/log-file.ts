import * as fs from 'fs';
import * as path from 'path';
import type { LogSink } from '@code-to-figma/contracts';

/**
 * Sink a archivo con rotación (plan de mejoras, fase 4.2): una línea JSON por entrada.
 * Al pasar de `maxBytes` el archivo actual se renombra a `<archivo>.1` (se pisa el respaldo
 * anterior) y se empieza uno nuevo: el disco nunca guarda más de ~2 × maxBytes.
 * Útil cuando el hub corre sin consola visible (CTF_LOG_FILE).
 */
export function rotatingFileSink(file: string, maxBytes = 5 * 1024 * 1024): LogSink {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  let size = 0;
  try { size = fs.statSync(file).size; } catch (_e) { size = 0; }
  return (r) => {
    const line = JSON.stringify(r) + '\n';
    const bytes = Buffer.byteLength(line);
    if (size > 0 && size + bytes > maxBytes) {
      try { fs.renameSync(file, file + '.1'); } catch (_e) { /* otro proceso lo movió: seguir */ }
      size = 0;
    }
    fs.appendFileSync(file, line);
    size += bytes;
  };
}
