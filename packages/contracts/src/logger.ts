/**
 * Logger con niveles y metadatos (plan de mejoras, fase 4.2). Sin dependencias de Node: se usa en
 * el hub, el CLI, el servidor MCP y el plugin de Figma. Cada entorno aporta sus "sinks"
 * (consola, archivo, UI del plugin).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  /** Logger hijo con el ámbito anidado: hub → hub:auth */
  child(scope: string): Logger;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function parseLogLevel(value: unknown, fallback: LogLevel = 'info'): LogLevel {
  return typeof value === 'string' && value in ORDER ? (value as LogLevel) : fallback;
}

export function createLogger(scope: string, options: { sinks: LogSink[]; level?: LogLevel }): Logger {
  const min = ORDER[options.level || 'info'];
  const emit = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    if (ORDER[level] < min) return;
    const record: LogRecord = { time: new Date().toISOString(), level, scope, message, ...(data ? { data } : {}) };
    for (const sink of options.sinks) {
      try { sink(record); } catch (_e) { /* un sink roto no debe tumbar al llamador */ }
    }
  };
  return {
    debug: (m, d) => emit('debug', m, d),
    info: (m, d) => emit('info', m, d),
    warn: (m, d) => emit('warn', m, d),
    error: (m, d) => emit('error', m, d),
    child: (sub) => createLogger(`${scope}:${sub}`, options),
  };
}

/** Texto legible de una entrada: "[hub:auth] mensaje {"origen":"null"}" */
export function formatLogRecord(r: LogRecord): string {
  const data = r.data && Object.keys(r.data).length ? ' ' + JSON.stringify(r.data) : '';
  return `[${r.scope}] ${r.message}${data}`;
}

/**
 * Sink de consola. stream 'stderr' para procesos cuyo stdout es un protocolo
 * (el servidor MCP habla JSON-RPC por stdout: un console.log lo corrompe).
 */
export function consoleSink(stream: 'auto' | 'stderr' = 'auto'): LogSink {
  return (r) => {
    const line = formatLogRecord(r);
    if (stream === 'stderr' || r.level === 'error') console.error(line);
    else if (r.level === 'warn') console.warn(line);
    else console.log(line);
  };
}
