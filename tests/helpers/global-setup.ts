import type { TestProject } from 'vitest/node';
import { createRequire } from 'module';
import * as path from 'path';

const require = createRequire(import.meta.url);
const { startStaticServer } = require('./static-server.cjs');

/** Sirve tests/fixtures en un puerto libre durante toda la ejecución de integración */
export default async function setup(project: TestProject) {
  const server = await startStaticServer(path.resolve(__dirname, '../fixtures'));
  project.provide('fixturesUrl', server.url);
  return async () => {
    await server.close();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    fixturesUrl: string;
  }
}
