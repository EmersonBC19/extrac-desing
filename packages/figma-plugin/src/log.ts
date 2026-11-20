import { createLogger, formatLogRecord } from '@code-to-figma/contracts';
import type { LogSink } from '@code-to-figma/contracts';

/** Consola de Figma (Plugins → Development → Show console) */
const figmaConsoleSink: LogSink = r => {
  const line = formatLogRecord(r);
  if (r.level === 'error') console.error(line);
  else if (r.level === 'warn') console.warn(line);
  else console.log(line);
};

/** Logger del sandbox del plugin. Lo que el usuario debe ver va además a la UI con un mensaje LOG */
export const log = createLogger('plugin', { sinks: [figmaConsoleSink] });

export const errText = (e: any): string => String(e?.message || e);
