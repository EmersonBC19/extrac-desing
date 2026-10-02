import { BrowserExtractor } from './browser.js';

async function test() {
  const extractor = new BrowserExtractor();

  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          .card {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 20px;
            background-color: rgb(30, 41, 59);
            border-radius: 12px;
            width: 320px;
          }
          .title {
            color: rgb(248, 250, 252);
            font-size: 16px;
            font-weight: 700;
          }
          .button {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgb(59, 130, 246);
            color: rgb(255, 255, 255);
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="card" data-component-name="ProductCard">
          <span class="title">Tarjeta de Prueba</span>
          <button class="button">Comprar Ahora</button>
        </div>
      </body>
    </html>
  `;

  console.log('Iniciando extracción con Playwright en Chromium...');
  const result = await extractor.extractFromUrl({
    htmlContent: testHtml,
    selector: '.card'
  });

  console.log('Resultado UINode extraído:');
  console.log(JSON.stringify(result, null, 2));

  await extractor.close();
  console.log('\n✓ Test de extracción completado con éxito!');
}

test().catch(console.error);
