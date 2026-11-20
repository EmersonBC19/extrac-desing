/**
 * Reensamblado de renders enviados por partes (plan de mejoras, fase 5.1).
 *
 * La extensión parte el JSON de un RENDER_NODES grande en trozos (RENDER_CHUNK) para que el
 * plugin pueda mostrar el progreso. Un ensamblador por cliente; límites para que un cliente no
 * pueda agotar la memoria del hub: tamaño total, número de partes, transferencias simultáneas y
 * caducidad de las incompletas.
 */
export interface ChunkMessage {
    transferId: string;
    index: number;
    total: number;
    data: string;
}
export type ChunkResult = {
    status: 'progress';
    transferId: string;
    received: number;
    total: number;
    bytes: number;
} | {
    status: 'complete';
    transferId: string;
    text: string;
    total: number;
    bytes: number;
} | {
    status: 'error';
    transferId: string;
    error: string;
};
export interface ChunkAssemblerLimits {
    maxBytes: number;
    maxTransfers: number;
    ttlMs: number;
}
export declare class ChunkAssembler {
    private limits;
    private now;
    private transfers;
    constructor(limits?: ChunkAssemblerLimits, now?: () => number);
    accept(msg: ChunkMessage): ChunkResult;
    /** Transferencias en curso (para pruebas y diagnóstico) */
    pending(): number;
    clear(): void;
    private expire;
}
//# sourceMappingURL=chunk-assembler.d.ts.map