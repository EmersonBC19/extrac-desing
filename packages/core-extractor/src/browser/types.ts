/**
 * Tipos del extractor de navegador (solo tipos: esbuild los borra al empaquetar).
 */

/**
 * Nodo del árbol en construcción. Es un objeto de forma libre: además de los campos del UINode
 * lleva campos privados (_pendingImageSrc, _vpRect, _needsShot…) que se limpian antes de devolverlo.
 * El esquema real se valida con Zod en @code-to-figma/contracts al recibirlo.
 */
export type RawNode = Record<string, any>;

/** Contador compartido durante el recorrido (ids y banderas globales del árbol). */
export type ExtractCounter = Record<string, any>;

/** Color RGBA normalizado (0..1). */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Rect en coordenadas del viewport. */
export interface VpRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Objeto layout de un nodo en construcción (modo, alineación, padding, medidas…). */
export type RawLayout = Record<string, any>;
