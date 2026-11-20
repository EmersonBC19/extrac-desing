// Empaqueta el extractor de navegador (fuente única en TypeScript) en un script autocontenido.
//
//   packages/core-extractor/src/browser/*.ts  ──esbuild──▶  packages/browser-extension/extractor.js
//
// Ese archivo lo usan la extensión (content script) y el crawler (core-extractor/src/browser-script.ts
// lo inyecta en Playwright). Así extensión y CLI usan exactamente el mismo extractor.
// Uso: node scripts/build-extractor.mjs [--check]   (--check: falla si el archivo no está al día)
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/browser-extension/extractor.js');
const BANNER = `/**
 * ⚠️ ARCHIVO GENERADO — no editar a mano.
 * Fuente: packages/core-extractor/src/browser/*.ts · Generar: npm run build:extractor
 *
 * Code to Figma — extractor de navegador: convierte un elemento del DOM renderizado en un árbol
 * UINode (layout ajustado a la geometría medida, texto enriquecido, imágenes, carruseles).
 */`;

const result = await build({
  entryPoints: [path.join(ROOT, 'packages/core-extractor/src/browser/entry.ts')],
  bundle: true,
  // Rutas de los comentarios de módulo relativas a la raíz: salida idéntica se ejecute desde donde se ejecute
  absWorkingDir: ROOT,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  charset: 'utf8',          // conservar ¹ ² ⁰ … tal cual en lugar de escapes \u
  legalComments: 'none',
  banner: { js: BANNER },
  write: false,
  logLevel: 'warning',
});

const code = result.outputFiles[0].text.replace(/\r\n/g, '\n');

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  if (current !== code) {
    console.error('✗ packages/browser-extension/extractor.js no está al día con core-extractor/src/browser.\n  Ejecuta: npm run build:extractor');
    process.exit(1);
  }
  console.log('✓ extractor.js al día');
} else {
  writeFileSync(OUT, code);
  console.log(`✓ extractor.js generado (${(code.length / 1024).toFixed(0)} KB)`);
}
