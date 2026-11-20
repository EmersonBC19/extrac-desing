// Servidor estático mínimo para las páginas fixture (tests/fixtures).
// Puerto 0 = el sistema elige uno libre (las pruebas no chocan con un hub o servidor del usuario).
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.css': 'text/css', '.js': 'text/javascript',
};

function startStaticServer(root, port = 0) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.resolve(base, '.' + (urlPath === '/' ? '/index.html' : urlPath));
    if (!file.startsWith(base)) { res.writeHead(403); return res.end(); } // sin salir de la carpeta
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      resolve({ url: `http://localhost:${actual}`, port: actual, close: () => new Promise(r => server.close(r)) });
    });
  });
}

module.exports = { startStaticServer };
