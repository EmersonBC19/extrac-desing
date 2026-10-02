import { chromium } from 'playwright';
import { browserDomExtractorScript } from '../packages/core-extractor/src/dom-to-node.js';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4210');

  const result = await page.evaluate(({ scriptCode }) => {
    const evalFn = new Function(`${scriptCode}; return extractNodeTree;`)();
    const body = document.body;
    const node = evalFn(body);
    
    // Log direct children of body in DOM
    const bodyChildren = Array.from(body.children).map(c => {
      const r = c.getBoundingClientRect();
      const s = window.getComputedStyle(c);
      return {
        tag: c.tagName,
        className: c.className,
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        extracted: evalFn(c) ? true : false
      };
    });

    return {
      bodyNode: node ? { name: node.name, type: node.type, layout: node.layout, childrenCount: node.children?.length } : null,
      bodyChildren
    };
  }, { scriptCode: browserDomExtractorScript });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

test();
