import { defineConfig } from 'vitest/config';

/**
 * Proyectos de prueba:
 *  - unit:        lógica pura, sin navegador ni red (segundos)
 *  - integration: navegador (Playwright) contra páginas fixture locales, hub real y plugin en
 *                 el simulador de Figma. Sin internet. Es lo que corre el CI.
 *  - live:        sitios reales (Apple, GitHub…). Cambian sin aviso: solo a mano (npm run test:live).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/helpers/global-setup.ts'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
          // Un navegador y varios hubs a la vez saturan equipos modestos: archivos en serie
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'live',
          include: ['tests/live/**/*.test.ts'],
          testTimeout: 300_000,
          hookTimeout: 300_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
