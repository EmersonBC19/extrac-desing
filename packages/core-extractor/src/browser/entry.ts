/**
 * Punto de entrada del extractor de navegador. scripts/build-extractor.mjs lo empaqueta (IIFE) en
 * packages/browser-extension/extractor.js, que usan la extensión y el crawler (core-extractor).
 *
 * Expone:
 *  - window.__codeToFigmaExtract(element) → { rootNode, tokens }
 *  En la extensión corre en el mundo aislado del content script: la página no lo ve.
 */
import { extractNodeTree } from './extract-node';
import { resolvePendingImages } from './images';
import { extractDesignTokens } from './tokens';

window.__codeToFigmaExtract = async function (rootElement: Element) {
  if (!rootElement || rootElement.nodeType !== Node.ELEMENT_NODE) return null;
  const counter: any = { id: 0 };
  const rawNode = extractNodeTree(rootElement, counter, null, null);
  if (!rawNode) return null;
  if (counter.hasCarouselSlides) rawNode.clipsContent = true;
  const resolved = await resolvePendingImages(rawNode);
  const tokens = extractDesignTokens();
  return { rootNode: resolved, tokens };
};

console.log('[CodeToFigma] Extractor Engine v2.1 (Geometric Direction & Centered Stacking) ready.');
