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

export type ChunkResult =
  | { status: 'progress'; transferId: string; received: number; total: number; bytes: number }
  | { status: 'complete'; transferId: string; text: string; total: number; bytes: number }
  | { status: 'error'; transferId: string; error: string };

export interface ChunkAssemblerLimits {
  maxBytes: number;
  maxTransfers: number;
  ttlMs: number;
}

interface Transfer {
  total: number;
  parts: (string | undefined)[];
  received: number;
  bytes: number;
  startedAt: number;
}

export class ChunkAssembler {
  private transfers = new Map<string, Transfer>();

  constructor(
    private limits: ChunkAssemblerLimits = { maxBytes: 64 * 1024 * 1024, maxTransfers: 2, ttlMs: 60_000 },
    private now: () => number = Date.now,
  ) {}

  accept(msg: ChunkMessage): ChunkResult {
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
    const fail = (error: string): ChunkResult => {
      this.transfers.delete(transferId);
      return { status: 'error', transferId, error };
    };
    if (total !== t.total) return fail('Número de partes inconsistente');
    if (index < 0 || index >= total) return fail('Índice de parte fuera de rango');
    if (t.parts[index] !== undefined) return fail(`Parte ${index} repetida`);
    t.bytes += data.length;
    if (t.bytes > this.limits.maxBytes) return fail('El envío supera el tamaño máximo permitido');
    t.parts[index] = data;
    t.received++;
    if (t.received < t.total) {
      return { status: 'progress', transferId, received: t.received, total: t.total, bytes: t.bytes };
    }
    this.transfers.delete(transferId);
    return { status: 'complete', transferId, text: t.parts.join(''), total: t.total, bytes: t.bytes };
  }

  /** Transferencias en curso (para pruebas y diagnóstico) */
  pending(): number {
    this.expire();
    return this.transfers.size;
  }

  clear(): void {
    this.transfers.clear();
  }

  private expire(): void {
    const limit = this.now() - this.limits.ttlMs;
    for (const [id, t] of this.transfers) if (t.startedAt < limit) this.transfers.delete(id);
  }
}
