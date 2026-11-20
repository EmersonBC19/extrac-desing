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
export declare function parseLogLevel(value: unknown, fallback?: LogLevel): LogLevel;
export declare function createLogger(scope: string, options: {
    sinks: LogSink[];
    level?: LogLevel;
}): Logger;
/** Texto legible de una entrada: "[hub:auth] mensaje {"origen":"null"}" */
export declare function formatLogRecord(r: LogRecord): string;
/**
 * Sink de consola. stream 'stderr' para procesos cuyo stdout es un protocolo
 * (el servidor MCP habla JSON-RPC por stdout: un console.log lo corrompe).
 */
export declare function consoleSink(stream?: 'auto' | 'stderr'): LogSink;
//# sourceMappingURL=logger.d.ts.map