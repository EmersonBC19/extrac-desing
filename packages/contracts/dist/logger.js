"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLogLevel = parseLogLevel;
exports.createLogger = createLogger;
exports.formatLogRecord = formatLogRecord;
exports.consoleSink = consoleSink;
const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
function parseLogLevel(value, fallback = 'info') {
    return typeof value === 'string' && value in ORDER ? value : fallback;
}
function createLogger(scope, options) {
    const min = ORDER[options.level || 'info'];
    const emit = (level, message, data) => {
        if (ORDER[level] < min)
            return;
        const record = { time: new Date().toISOString(), level, scope, message, ...(data ? { data } : {}) };
        for (const sink of options.sinks) {
            try {
                sink(record);
            }
            catch (_e) {
                /* un sink roto no debe tumbar al llamador */
            }
        }
    };
    return {
        debug: (m, d) => emit('debug', m, d),
        info: (m, d) => emit('info', m, d),
        warn: (m, d) => emit('warn', m, d),
        error: (m, d) => emit('error', m, d),
        child: sub => createLogger(`${scope}:${sub}`, options),
    };
}
/** Texto legible de una entrada: "[hub:auth] mensaje {"origen":"null"}" */
function formatLogRecord(r) {
    const data = r.data && Object.keys(r.data).length ? ' ' + JSON.stringify(r.data) : '';
    return `[${r.scope}] ${r.message}${data}`;
}
/**
 * Sink de consola. stream 'stderr' para procesos cuyo stdout es un protocolo
 * (el servidor MCP habla JSON-RPC por stdout: un console.log lo corrompe).
 */
function consoleSink(stream = 'auto') {
    return r => {
        const line = formatLogRecord(r);
        if (stream === 'stderr' || r.level === 'error')
            console.error(line);
        else if (r.level === 'warn')
            console.warn(line);
        else
            console.log(line);
    };
}
//# sourceMappingURL=logger.js.map