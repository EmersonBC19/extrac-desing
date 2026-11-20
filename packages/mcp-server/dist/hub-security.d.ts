export type OriginClass = 'local' | 'extension' | 'figma' | 'needs-pairing' | 'rejected';
export declare function classifyOrigin(origin: string | undefined, allowedExtensionIds?: string[]): OriginClass;
export declare function generatePairingCode(): string;
export declare function normalizePairingCode(code: unknown): string;
/** Comparación en tiempo constante (no revela cuántos caracteres coinciden) */
export declare function pairingCodeMatches(expected: string, provided: unknown): boolean;
/**
 * Código persistente en ~/.code-to-figma/pairing-code: la vinculación se hace UNA vez
 * (el plugin lo guarda) y sobrevive a reinicios del hub.
 */
export declare function loadOrCreatePairingCode(dir?: string): {
    code: string;
    file: string;
};
/** Limita intentos fallidos de vinculación (fuerza bruta desde una página con origen "null") */
export declare class PairingRateLimiter {
    private maxFailures;
    private windowMs;
    private failures;
    constructor(maxFailures?: number, windowMs?: number);
    isLocked(now?: number): boolean;
    recordFailure(now?: number): void;
}
export interface ViewRenderRequest {
    viewId: string;
    route: string;
    name: string;
    pageName: string;
    useSeparatePage: boolean;
}
/**
 * Devuelve la petición saneada o un mensaje de error. Solo se aceptan vistas del catálogo,
 * identificadores simples y rutas de URL; los argumentos van a execFile SIN shell.
 */
export declare function validateViewRenderRequest(payload: any, catalogIds: string[]): ViewRenderRequest | string;
//# sourceMappingURL=hub-security.d.ts.map