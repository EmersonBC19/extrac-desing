// Carga lógica pura del código real para pruebas unitarias sin navegador ni Figma.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Política de descarga de imágenes del service worker (background.js) */
function loadImageFetchPolicy() {
  const src = read('packages/browser-extension/background.js');
  const a = src.indexOf('function isPrivateHost');
  const b = src.indexOf('async function fetchImageBase64');
  if (a < 0 || b < 0) throw new Error('background.js sin imageFetchPolicy');
  return new Function(src.slice(a, b) + '\nreturn { isPrivateHost, siteOf, imageFetchPolicy };')();
}

/** Envío al hub del service worker (background.js), con el WebSocket de Node (paquete ws) */
function loadHubSender() {
  const src = read('packages/browser-extension/background.js');
  const a = src.indexOf('// ── Envío al hub (inicio)');
  const b = src.indexOf('// ── Envío al hub (fin)');
  if (a < 0 || b < 0) throw new Error('background.js sin el bloque de envío al hub');
  return new Function(
    'WebSocket',
    src.slice(a, b) +
      '\nreturn { sendToWebSocketHub, splitIntoChunks, buildRenderMessage, CHUNK_THRESHOLD_BYTES, CHUNK_SIZE_CHARS };',
  )(require('ws'));
}

module.exports = { loadImageFetchPolicy, loadHubSender, read, ROOT };
