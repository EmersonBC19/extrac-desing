// Globales del entorno donde corre el extractor (página o content script de la extensión)
declare const chrome: any;

interface Window {
  __codeToFigmaExtract?: (element: Element) => Promise<{ rootNode: any; tokens: any } | null>;
  /** Extracción del elemento en estado hover/focus emulado (fase 6.1) */
  __codeToFigmaExtractState?: (
    element: Element,
    state: 'hover' | 'focus',
  ) => Promise<{ rootNode: any; rules: number; unreadableSheets: number } | null>;
  /** Peso de una extracción y versión sin imágenes (contracts/payload-stats) */
  __codeToFigmaPayload?: Record<string, (...args: any[]) => any>;
  /** Lo define content.js: recorta regiones de una captura de pantalla de la pestaña */
  __codeToFigmaCaptureRegions?: (
    rects: Array<{ left: number; top: number; width: number; height: number }>,
  ) => Promise<Array<string | null>>;
}
