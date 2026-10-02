import { chromium } from 'playwright';
import { WebSocket } from 'ws';
import { browserDomExtractorScript } from '../packages/core-extractor/src/dom-to-node.js';

async function test() {
  console.log('Iniciando test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
          <h2 style="padding: 20px; color: #fbbf24;">Banco Pichincha</h2>
          <nav style="padding: 10px 20px;">
            <p style="color: white; margin: 10px 0;">Dashboard</p>
            <p style="color: #94a3b8; margin: 10px 0;">Seguridad</p>
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
      return { ok: true, json: JSON.stringify(node) };
    } catch (e: any) {
      return { ok: false, error: e.message, stack: e.stack };
    }
  }, browserDomExtractorScript);

  if (result.ok && result.json) {
    const parsed = JSON.parse(result.json);
    console.log('Enviando a Figma via WS...');
    const ws = new WebSocket('ws://localhost:8080');
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'CLI_OR_MCP' }));
        ws.send(JSON.stringify({
          type: 'RENDER_NODES',
          payload: {
            rootNode: parsed,
            clearPage: false,
            targetCanvasPosition: { x: 4000, y: 0 }
          }
        }));
      });
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        console.log('Respuesta de Hub/Figma:', msg);
        if (msg.type === 'RENDER_SUCCESS' || msg.type === 'RENDER_ERROR') {
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
      setTimeout(() => {
        console.log('Timeout esperando respuesta de Figma');
        ws.close();
        resolve();
      }, 8000);
    });
  }

  console.log('RESULTADO OK:', result.ok);
  await browser.close();
}

test().catch(console.error);
