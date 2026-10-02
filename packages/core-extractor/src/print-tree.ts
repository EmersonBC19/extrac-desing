import { BrowserExtractor } from './browser.js';
import type { UINode } from '@code-to-figma/contracts';

function printTree(node: UINode, depth = 0) {
  const indent = '  '.repeat(depth);
  const details = node.type === 'TEXT' ? `("${node.textData?.characters}")` : `[${node.layout.mode}, w:${node.layout.width}, h:${node.layout.height}]`;
  console.log(`${indent}- [${node.type}] ${node.name} ${details}`);
  if (node.children) {
    for (const child of node.children) {
      printTree(child, depth + 1);
    }
  }
}

async function inspect() {
  const extractor = new BrowserExtractor();
  const node = await extractor.extractFromUrl({
    url: 'http://localhost:4210',
    selector: 'app-root'
  });

  console.log('\n--- Jerarquía de Componentes de cloud-pichincha-front ---');
  printTree(node);
  await extractor.close();
}

inspect();
