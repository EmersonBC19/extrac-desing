// Empaqueta el hub WebSocket en un ejecutable autónomo (Node SEA — Single Executable Application):
//
//   packages/mcp-server/src/ws-hub.ts  ──esbuild──▶  hub-bundle.cjs  ──node sea──▶  code-to-figma-hub(.exe)
//
// Permite que cualquier usuario ejecute el hub en segundo plano sin abrir una terminal y sin
// tener Node.js instalado en su sistema.
// Uso: node scripts/build-hub-exe.mjs
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'packages/mcp-server/dist');
const BUNDLE_OUT = path.join(DIST, 'hub-bundle.cjs');
const SEA_CONFIG = path.join(DIST, 'sea-config.json');
const BLOB_OUT = path.join(DIST, 'sea-prep.blob');
const isWin = process.platform === 'win32';
const EXE_OUT = path.join(DIST, isWin ? 'code-to-figma-hub.exe' : 'code-to-figma-hub');

mkdirSync(DIST, { recursive: true });

console.log('1/4 Compilando bundle de Hub con esbuild...');
await build({
  entryPoints: [path.join(ROOT, 'packages/mcp-server/src/ws-hub.ts')],
  bundle: true,
  absWorkingDir: ROOT,
  outfile: BUNDLE_OUT,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  legalComments: 'none',
  define: {
    'process.env.CTF_STANDALONE': '"1"',
  },
  banner: {
    js: '// Code to Figma Hub — Binario autónomo (Fase 7: Cero Terminal)\nprocess.env.CTF_STANDALONE = "1";',
  },
  logLevel: 'warning',
});
console.log(`✓ Bundle generado: ${BUNDLE_OUT}`);

console.log('2/4 Generando blob SEA (Single Executable Application)...');
const seaConfig = {
  main: BUNDLE_OUT,
  output: BLOB_OUT,
  disableExperimentalSEAWarning: true,
};
writeFileSync(SEA_CONFIG, JSON.stringify(seaConfig, null, 2), 'utf8');

execFileSync(process.execPath, ['--experimental-sea-config', SEA_CONFIG], {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log(`✓ Blob SEA generado: ${BLOB_OUT}`);

console.log('3/4 Copiando binario base de Node...');
copyFileSync(process.execPath, EXE_OUT);
console.log(`✓ Binario base copiado a: ${EXE_OUT}`);

console.log('4/4 Inyectando blob SEA con postject...');
const postjectBin = path.join(ROOT, 'node_modules/.bin', isWin ? 'postject.cmd' : 'postject');
const postjectArgs = [
  EXE_OUT,
  'NODE_SEA_BLOB',
  BLOB_OUT,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];

if (isWin) {
  // En Windows se pasa el flag --overwrite para reemplazar la sección si ya existía
  postjectArgs.push('--overwrite');
}

execFileSync(postjectBin, postjectArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});

console.log(`\n🎉 ¡Ejecutable de Hub generado con éxito!\n👉 ${EXE_OUT}\n`);
