// ESLint (flat config) — plan de mejoras, fase 4.3.
// Objetivo: atrapar errores reales (variables sin declarar, código inalcanzable, promesas mal usadas),
// no imponer estilo: del formato se encarga Prettier (npm run format).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'swarm-cursors-main/**', // referencia de terceros, solo consulta
      'scratch/**', // experimentos locales
      'packages/browser-extension/extractor.js', // generado por npm run build:extractor
      'test-results/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Reglas comunes: el código usa `any` en las fronteras con el DOM y la API de Figma, y bloques
  // `catch (_e) {}` a propósito (fallos tolerados). Lo demás, como lo trae la configuración recomendada.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
    },
  },

  // Servidor MCP, hub, crawler, scripts y pruebas: Node
  {
    files: [
      'packages/mcp-server/**/*.ts',
      'packages/core-extractor/src/*.ts',
      'scripts/**/*.mjs',
      'tests/**/*.{ts,mts}',
      '*.{mjs,mts}',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // `const WebSocket = require('ws')`: Node 22+ trae WebSocket global, aquí se usa el de ws a propósito
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  // Pruebas: page.evaluate(() => ...) usa document/window del navegador
  {
    files: ['tests/**/*'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Extractor que corre en la página (se empaqueta a extractor.js)
  {
    files: ['packages/core-extractor/src/browser/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Plugin de Figma: sandbox (figma, __html__) — los tipos los da @figma/plugin-typings
  {
    files: ['packages/figma-plugin/src/**/*.ts'],
    languageOptions: { globals: { figma: 'readonly', __html__: 'readonly', console: 'readonly' } },
  },

  // Extensión de Chrome: scripts clásicos (sin módulos) con las APIs del navegador y de extensiones
  {
    files: ['packages/browser-extension/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
);
