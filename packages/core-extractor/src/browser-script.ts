/**
 * El extractor de navegador que usa el crawler es EXACTAMENTE el mismo que usa la extensión:
 * packages/browser-extension/extractor.js, generado desde src/browser/*.ts por
 * scripts/build-extractor.mjs. (Antes el crawler tenía su propia copia, desactualizada.)
 *
 * Se inyecta en la página con page.evaluate y expone window.__codeToFigmaExtract(element).
 */
import { readFileSync } from 'fs';

// Misma ruta relativa desde src/ (tsx) y desde dist/ (compilado): ambos están a 2 niveles de packages/
const EXTRACTOR_URL = new URL('../../browser-extension/extractor.js', import.meta.url);

let cached: string | null = null;

/** Código del extractor listo para inyectar en una página */
export function getBrowserExtractorScript(): string {
  if (cached === null) {
    try {
      cached = readFileSync(EXTRACTOR_URL, 'utf8');
    } catch (err: any) {
      throw new Error(`No se encontró el extractor generado (${EXTRACTOR_URL.pathname}). Ejecuta: npm run build:extractor\n${err?.message || err}`);
    }
  }
  return cached;
}
