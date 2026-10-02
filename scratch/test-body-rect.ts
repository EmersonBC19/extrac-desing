import { chromium } from 'playwright';
import { browserDomExtractorScript } from '../packages/core-extractor/src/dom-to-node.js';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4210');

  const result = await page.evaluate(({ scriptCode }) => {
    const evalFn = new Function(`${scriptCode}; return extractNodeTree;`)();
    const body = document.body;
    const rect = body.getBoundingClientRect();
    const node = evalFn(body);
    return {
      bodyRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      windowInner: { w: window.innerWidth, h: window.innerHeight },
      nodeIsNull: node === null,
      nodeName: node ? node.name : null
    };
  }, { scriptCode: browserDomExtractorScript });

  console.log('Result:', JSON.stringify(result, null, 2));
  await browser.close();
}

test();
