// Node 20.12+ loads local server secrets without adding them to frontend builds.
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createMarketplaceHandler } = require('../server/marketplace.cjs');
const handleApi = createMarketplaceHandler();

const generated = path.join(process.cwd(), 'generated');
const root = path.join(generated, 'dist');
const port = Number(process.argv[2] || process.env.PORT || 5174);
const types = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.map': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

http
  .createServer(async (request, response) => {
    let url;
    try { url = new URL(request.url, `http://${request.headers.host || 'localhost'}`); }
    catch { response.writeHead(400); response.end('Bad request'); return; }
    if (await handleApi(request, response, url)) return;
    let requestPath;
    try { requestPath = decodeURIComponent(url.pathname); }
    catch { response.writeHead(400); response.end('Bad request'); return; }
    if (requestPath === '/') requestPath = '/index.html';
    const filePath = path.normalize(path.join(root, requestPath));

    if (!filePath.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  })
  .on('error', (error) => {
    fs.mkdirSync(generated, { recursive: true });
    fs.writeFileSync(path.join(generated, 'dev-server.err'), `${error.stack || error}\n`);
    process.exit(1);
  })
  .listen(port, process.env.HOST || '127.0.0.1', () => {
    fs.mkdirSync(generated, { recursive: true });
    fs.writeFileSync(path.join(generated, 'dev-server.log'), `Perler Beads Generator is running at http://127.0.0.1:${port}/\n`);
  });

setInterval(() => {}, 60_000);
