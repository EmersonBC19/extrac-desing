// Carga lógica pura del código real para pruebas unitarias sin navegador ni Figma.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Política de descarga de imágenes del service worker (background.js) */
function loadImageFetchPolicy() {
  const src = read('packages/browser-extension/background.js');
  const a = src.indexOf('function isPrivateHost');
  const b = src.indexOf('async function fetchImageBase64');
  if (a < 0 || b < 0) throw new Error('background.js sin imageFetchPolicy');
  return new Function(src.slice(a, b) + '\nreturn { isPrivateHost, siteOf, imageFetchPolicy };')();
}

module.exports = { loadImageFetchPolicy, read, ROOT };
