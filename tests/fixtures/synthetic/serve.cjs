// Sirve una carpeta de fixtures para pruebas manuales: node tests/fixtures/synthetic/serve.cjs [carpeta] [puerto]
const path = require('path');
const { startStaticServer } = require('../../helpers/static-server.cjs');
const root = process.argv[2] || __dirname;
const port = Number(process.argv[3] || 8765);
startStaticServer(root, port).then(s => console.log(`up ${s.url} (${path.resolve(root)})`));
