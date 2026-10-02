import { BrowserExtractor } from './browser.js';

async function probe() {
  const extractor = new BrowserExtractor();
  console.log('Inspeccionando http://localhost:4210 con Chromium...');

  try {
    const node = await extractor.extractFromUrl({
      url: 'http://localhost:4210',
      selector: 'body'
    });

    console.log('Nombre:', node.name);
    console.log('Tipo:', node.type);
    console.log('Total hijos directos:', node.children?.length);
    console.log('Layout:', node.layout);
    if (node.children) {
      console.log('Primeros 3 hijos:', node.children.slice(0, 3).map(c => ({ name: c.name, type: c.type, children: c.children?.length })));
    }
  } catch (err: any) {
    console.error('Error inspeccionando:', err.message);
  } finally {
    await extractor.close();
  }
}

probe();
