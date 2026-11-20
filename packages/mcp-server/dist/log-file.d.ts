import type { LogSink } from '@code-to-figma/contracts';
/**
 * Sink a archivo con rotación (plan de mejoras, fase 4.2): una línea JSON por entrada.
 * Al pasar de `maxBytes` el archivo actual se renombra a `<archivo>.1` (se pisa el respaldo
 * anterior) y se empieza uno nuevo: el disco nunca guarda más de ~2 × maxBytes.
 * Útil cuando el hub corre sin consola visible (CTF_LOG_FILE).
 */
export declare function rotatingFileSink(file: string, maxBytes?: number): LogSink;
//# sourceMappingURL=log-file.d.ts.map