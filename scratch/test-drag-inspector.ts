import { chromium } from 'playwright';
import * as fs from 'fs';

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

  await p.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 24px; background: #f8fafc;">
        <div id="card-hero" style="width: 800px; height: 500px; background: #000; color: #fff; padding: 32px; border-radius: 12px; margin: 40px auto; position: relative;">
          <h2>Apple Watch Series 12</h2>
          <button id="btn-sample">Más información</button>
        </div>
      </body>
    </html>
  `);

  const extractorCode = fs.readFileSync('packages/browser-extension/extractor.js', 'utf-8');
  const contentCode = fs.readFileSync('packages/browser-extension/content.js', 'utf-8');

  await p.evaluate(extractorCode);
  await p.evaluate(contentCode);

  // Click card to select it
  await p.mouse.click(400, 200);

  // Check initial position of HUD
  const initialHudBox = await p.evaluate(() => {
    const instance = (window as any).__codeToFigmaInstance;
    const rect = instance.hud.getBoundingClientRect();
    return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) };
  });
  console.log('Initial HUD box (docked at bottom-center):', initialHudBox);

  // Drag HUD by header: click at (initialLeft + 100, initialTop + 15), drag to (200, 200)
  const dragHeaderX = initialHudBox.left + 100;
  const dragHeaderY = initialHudBox.top + 15;

  await p.mouse.move(dragHeaderX, dragHeaderY);
  await p.mouse.down();
  await p.mouse.move(250, 180);
  await p.mouse.up();

  // Check new position
  const draggedHudBox = await p.evaluate(() => {
    const instance = (window as any).__codeToFigmaInstance;
    const rect = instance.hud.getBoundingClientRect();
    return { top: Math.round(rect.top), left: Math.round(rect.left) };
  });
  console.log('HUD position after real mouse drag:', draggedHudBox);

  // Climb hierarchy to parent
  await p.evaluate(() => {
    const instance = (window as any).__codeToFigmaInstance;
    instance.elevateParent();
  });

  const afterClimbBox = await p.evaluate(() => {
    const instance = (window as any).__codeToFigmaInstance;
    const rect = instance.hud.getBoundingClientRect();
    return { top: Math.round(rect.top), left: Math.round(rect.left) };
  });
  console.log('HUD position after Subir a Padre (persists user position):', afterClimbBox);

  const matched = Math.abs(afterClimbBox.left - draggedHudBox.left) <= 1 && Math.abs(afterClimbBox.top - draggedHudBox.top) <= 1;
  console.log('Did position persist exactly?', matched ? 'YES! PERFECT!' : 'NO');

  await b.close();
}

main().catch(console.error);
