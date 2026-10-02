import { SiteCrawler } from '../packages/core-extractor/src/crawler.js';

async function test() {
  const crawler = new SiteCrawler();
  const res = await crawler.crawl({
    baseUrl: 'http://localhost:4210',
    routes: ['/'],
    onScreen: (s) => console.log('ON_SCREEN CALLED:', s.title)
  });
  console.log('Total extracted:', res.length);
  await crawler.close();
}

test();
