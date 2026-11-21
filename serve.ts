// Night Post — tiny static server for local play and screenshots.
// Serves the repo root so /game/index.html works. Default port 8080;
// pass --port <n> to pick another.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

let port = 8080;
const portFlag = process.argv.indexOf('--port');
if (portFlag !== -1 && process.argv[portFlag + 1]) {
  port = Number.parseInt(process.argv[portFlag + 1], 10);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let path = normalize(join(here, decodeURIComponent(url.pathname)));
    if (!path.startsWith(here)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (path.endsWith('/')) path = join(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Night Post serving at http://127.0.0.1:${port}/game/index.html`);
});
