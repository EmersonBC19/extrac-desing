import { BrowserExtractor } from '../packages/core-extractor/src/browser.js';

async function test() {
  const e = new BrowserExtractor();
  try {
    const node = await e.extractFromUrl({ url: 'http://localhost:4210', selector: 'body' });
    console.log('Node result:', node ? 'OK: ' + node.name : 'NULL!');
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await e.close();
  }
}

test();
