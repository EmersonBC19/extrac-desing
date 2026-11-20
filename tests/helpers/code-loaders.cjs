// Carga lógica pura del código real para pruebas unitarias sin navegador ni Figma.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Funciones internas del extractor (window.__codeToFigmaInternals), evaluado en un vm de Node */
function loadExtractorInternals() {
  const ctx = { window: { scrollX: 0, scrollY: 0, innerWidth: 1440, innerHeight: 900 }, console: { log() {}, warn() {} }, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }, TextEncoder, btoa, atob, URL };
  vm.createContext(ctx);
  vm.runInContext(read('packages/browser-extension/extractor.js'), ctx);
  const internals = ctx.window.__codeToFigmaInternals;
  if (!internals) throw new Error('extractor.js no expone __codeToFigmaInternals');
  return internals;
}

/**
 * Lógica pura del tablero, delimitada en code.ts con @@BOARD_PURE_START/END.
 * Se lee del plugin compilado (dist/code.js) porque el plugin aún no tiene módulos
 * (llega con el empaquetador de la fase 3; entonces se importará directamente).
 */
function loadBoardPure() {
  const code = read('packages/figma-plugin/dist/code.js');
  const a = code.indexOf('@@BOARD_PURE_START');
  const b = code.indexOf('@@BOARD_PURE_END');
  if (a < 0 || b < 0) throw new Error('dist/code.js sin marcadores @@BOARD_PURE (¿falta compilar el plugin?)');
  const body = code.slice(a, b).replace(/^@@BOARD_PURE_START[^\n]*\n/, '');
  return new Function(body + '\nreturn { boardHash, boardColorKey, boardSignature, boardDetectComponents, boardCleanName, boardCollect };')();
}

/** Política de descarga de imágenes del service worker (background.js) */
function loadImageFetchPolicy() {
  const src = read('packages/browser-extension/background.js');
  const a = src.indexOf('function isPrivateHost');
  const b = src.indexOf('async function fetchImageBase64');
  if (a < 0 || b < 0) throw new Error('background.js sin imageFetchPolicy');
  return new Function(src.slice(a, b) + '\nreturn { isPrivateHost, siteOf, imageFetchPolicy };')();
}

module.exports = { loadExtractorInternals, loadBoardPure, loadImageFetchPolicy, read, ROOT };
