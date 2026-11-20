// Empaqueta el plugin de Figma (módulos TS + @code-to-figma/contracts con Zod) en un solo archivo:
//
//   packages/figma-plugin/src/code.ts (+ módulos)  ──esbuild──▶  packages/figma-plugin/dist/code.js
//
// Figma carga un único archivo JS en su sandbox (manifest.json → "main"): sin empaquetador el
// plugin no podía tener módulos ni importar los esquemas compartidos.
// Uso: node scripts/build-plugin.mjs [--check]
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/figma-plugin/dist/code.js');

const result = await build({
  entryPoints: [path.join(ROOT, 'packages/figma-plugin/src/code.ts')],
  bundle: true,
  // Rutas de los comentarios de módulo relativas a la raíz: salida idéntica se ejecute desde donde se ejecute
  absWorkingDir: ROOT,
  format: 'iife',
  // El sandbox de plugins de Figma ejecuta ES2020 (el plugin ya se compilaba a ese target)
  target: 'es2020',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  // contracts desde su fuente TS (ESM): así esbuild descarta lo que no se usa de Zod.
  // Su dist es CommonJS y arrastraba Zod entero, con las traducciones a ~40 idiomas (≈ 1 MB).
  alias: { '@code-to-figma/contracts': path.join(ROOT, 'packages/contracts/src/index.ts') },
  metafile: true,
  charset: 'utf8',
  legalComments: 'none',
  banner: {
    js: '// ⚠️ ARCHIVO GENERADO — no editar. Fuente: packages/figma-plugin/src · Generar: npm run build:plugin',
  },
  write: false,
  logLevel: 'warning',
});

const code = result.outputFiles[0].text.replace(/\r\n/g, '\n');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  } catch (_e) {}
  if (current !== code) {
    console.error('✗ packages/figma-plugin/dist/code.js no está al día. Ejecuta: npm run build:plugin');
    process.exit(1);
  }
  console.log('✓ plugin dist/code.js al día');
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, code);
  console.log(`✓ plugin dist/code.js generado (${(code.length / 1024).toFixed(0)} KB)`);
}
