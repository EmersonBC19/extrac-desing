export class ChunkAssembler {
    limits;
    now;
    transfers = new Map();
    constructor(limits = { maxBytes: 64 * 1024 * 1024, maxTransfers: 2, ttlMs: 60_000 }, now = Date.now) {
        this.limits = limits;
        this.now = now;
    }
    accept(msg) {
        const { transferId, index, total, data } = msg;
        this.expire();
        let t = this.transfers.get(transferId);
        if (!t) {
            if (this.transfers.size >= this.limits.maxTransfers) {
                return { status: 'error', transferId, error: 'Demasiados envíos por partes simultáneos' };
            }
            t = { total, parts: new Array(total), received: 0, bytes: 0, startedAt: this.now() };
            this.transfers.set(transferId, t);
        }
        const fail = (error) => {
            this.transfers.delete(transferId);
            return { status: 'error', transferId, error };
        };
        if (total !== t.total)
            return fail('Número de partes inconsistente');
        if (index < 0 || index >= total)
            return fail('Índice de parte fuera de rango');
        if (t.parts[index] !== undefined)
            return fail(`Parte ${index} repetida`);
        t.bytes += data.length;
        if (t.bytes > this.limits.maxBytes)
            return fail('El envío supera el tamaño máximo permitido');
        t.parts[index] = data;
        t.received++;
        if (t.received < t.total) {
            return { status: 'progress', transferId, received: t.received, total: t.total, bytes: t.bytes };
        }
        this.transfers.delete(transferId);
        return { status: 'complete', transferId, text: t.parts.join(''), total: t.total, bytes: t.bytes };
    }
    /** Transferencias en curso (para pruebas y diagnóstico) */
    pending() {
        this.expire();
        return this.transfers.size;
    }
    clear() {
        this.transfers.clear();
    }
    expire() {
        const limit = this.now() - this.limits.ttlMs;
        for (const [id, t] of this.transfers)
            if (t.startedAt < limit)
                this.transfers.delete(id);
    }
}
//# sourceMappingURL=chunk-assembler.js.map