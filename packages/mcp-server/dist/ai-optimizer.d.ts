export interface AiOptimizationResult {
    payload: any;
    optimized: boolean;
    modelUsed?: string;
    reason?: string;
    durationMs?: number;
}
/**
 * Optimiza semánticamente un árbol UINode usando Google Gemini Flash (API gratuita).
 * 1. Poda wrappers redundantes de frameworks (divs utilitarios sin estilos que solo anidan un hijo).
 * 2. Estructura layouts 2D / CSS Grid en jerarquías Auto Layout canónicas (filas y columnas limpias).
 * 3. Asigna nombres semánticos de Design System (ej. 'Card / Container', 'Button / Primary').
 *
 * Si no hay API Key o la llamada falla/agota el tiempo, devuelve el payload original intacto.
 */
export declare function optimizePayloadWithGemini(payload: any, apiKey?: string, options?: {
    model?: string;
    timeoutMs?: number;
}): Promise<AiOptimizationResult>;
//# sourceMappingURL=ai-optimizer.d.ts.map