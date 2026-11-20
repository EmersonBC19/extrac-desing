/**
 * Contexto del tablero en construcción: componentes maestros por id de grupo.
 * render.ts lo consulta para dibujar bloques repetidos como instancias; board.ts lo llena.
 * (Un módulo no puede reasignar una variable importada: por eso get/set.)
 */
export interface BoardContext {
  masters: Map<string, ComponentNode>;
}

let current: BoardContext | null = null;

export function getBoardCtx(): BoardContext | null {
  return current;
}

export function setBoardCtx(ctx: BoardContext | null): void {
  current = ctx;
}
