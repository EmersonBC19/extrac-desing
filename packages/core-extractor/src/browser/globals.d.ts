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
  /** Exportar el bloque como HTML + CSS + JS (export-html.ts) */
  __codeToFigmaExportHtml?: (element: Element, opts?: any) => Promise<any>;
  /** Bytes de un .zip "store" con los archivos dados */
  __codeToFigmaZip?: (files: Array<{ name: string; content: string }>) => Uint8Array;
  /** Lo define content.js: descarga el texto de una hoja de estilo de otro dominio */
  __codeToFigmaFetchCss?: (url: string) => Promise<string | null>;
}
