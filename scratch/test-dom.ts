import { chromium } from 'playwright';
import { browserDomExtractorScript } from '../packages/core-extractor/src/dom-to-node.js';

async function test() {
  console.log('Iniciando test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Vamos a probar con un HTML de prueba que simule la estructura de Angular
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; background: #f8fafc; font-family: sans-serif; }
        .sidebar { position: fixed; left: 0; top: 0; width: 240px; height: 100vh; background: #0f172a; color: white; }
        .content { margin-left: 240px; padding: 20px; }
        .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #1e293b; font-size: 24px; }
        p { color: #64748b; font-size: 14px; }
        .btn { background: #2563eb; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; }
      </style>
    </head>
    <body>
      <app-root>
        <app-sidebar class="sidebar">
          <h2>Banco Pichincha</h2>
          <nav>
            <a href="#">Dashboard</a>
            <a href="#">Seguridad</a>
          </nav>
        </app-sidebar>
        <main class="content">
          <app-users>
            <div class="card">
              <h1>Lista de Usuarios</h1>
              <p>Total de usuarios registrados en el sistema.</p>
              <button class="btn">Nuevo Usuario</button>
            </div>
          </app-users>
        </main>
      </app-root>
    </body>
    </html>
  `;

  await page.setContent(testHtml);

  const result = await page.evaluate((code) => {
    try {
      const evalFn = new Function(code + '; return extractNodeTree;')();
      const node = evalFn(document.body);
      function dump(n) {
        if (!n) return null;
        return {
          id: n.id,
          name: n.name,
          type: n.type,
          layout: { w: n.layout?.width, h: n.layout?.height, x: n.layout?.x, y: n.layout?.y, mode: n.layout?.mode },
          text: n.textData?.characters,
          children: (n.children || []).map(dump)
        };
      }
      return { ok: true, tree: dump(node) };
    } catch (e: any) {
      return { ok: false, error: e.message, stack: e.stack };
    }
  }, browserDomExtractorScript);

  console.log('RESULTADO:', JSON.stringify(result, null, 2));
  await browser.close();
}

test().catch(console.error);
