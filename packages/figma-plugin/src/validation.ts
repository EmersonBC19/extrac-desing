/**
 * Validación del payload antes de tocar el lienzo (cubre también "Pegar JSON", que no pasa por el hub).
 * Usa los MISMOS esquemas Zod que el hub (@code-to-figma/contracts): una sola definición de qué es
 * un payload válido. Antes el plugin tenía una copia manual de las reglas.
 */
import { validateRenderPayload } from '@code-to-figma/contracts';

/** null si el payload es válido; si no, el motivo */
export function guardRenderPayload(payload: unknown): string | null {
  const result = validateRenderPayload(payload);
  return result.ok ? null : result.error;
}
