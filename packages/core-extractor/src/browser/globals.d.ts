// Globales del entorno donde corre el extractor (página o content script de la extensión)
declare const chrome: any;

interface Window {
  __codeToFigmaExtract?: (element: Element) => Promise<{ rootNode: any; tokens: any } | null>;
  /** Lo define content.js: recorta regiones de una captura de pantalla de la pestaña */
  __codeToFigmaCaptureRegions?: (rects: Array<{ left: number; top: number; width: number; height: number }>) => Promise<Array<string | null>>;
}
