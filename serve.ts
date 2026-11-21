// Night Post: a tiny static server for local play-testing (Node 22, standard library
// only). Serves this directory on http://localhost:8080 by default, so the game opens at
// http://localhost:8080/game/ and the screenshot scenes at
// http://localhost:8080/game/?shot=play&seed=1. `node serve.ts --port 8902` picks a port.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 && process.argv[portIndex + 1] ? Number(process.argv[portIndex + 1]) : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = normalize(join(here, decodeURIComponent(url.pathname)));
  if (!path.startsWith(here)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});

server.listen(port, () => {
  console.log(`Night Post serving at http://localhost:${port}/game/`);
});
