import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const publicRoot = join(root, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

try {
  const local = await readFile(join(root, '.env'), 'utf8');
  for (const line of local.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch { /* .env is optional for the visual preview */ }

const handlers = {
  '/api/auth': () => import('./api/auth.js'),
  '/api/config': () => import('./api/config.js'),
  '/api/google': () => import('./api/google.js'),
  '/api/profile': () => import('./api/profile.js'),
  '/api/name': () => import('./api/name.js'),
  '/api/logout': () => import('./api/logout.js')
};

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (handlers[pathname]) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) {
          res.writeHead(413).end('Request too large');
          return;
        }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      req.body = raw ? JSON.parse(raw) : {};
      const module = await handlers[pathname]();
      await module.default(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    let file = resolve(publicRoot, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
    if (file !== publicRoot && !file.startsWith(publicRoot + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
    const content = await readFile(file);
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error?.code === 'ENOENT') res.writeHead(404).end('Not found');
    else if (error instanceof SyntaxError) res.writeHead(400).end('Invalid request');
    else { console.error('[dev server]', error); res.writeHead(500).end('Server error'); }
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '127.0.0.1', () => console.log(`MATCHMAN site: http://127.0.0.1:${port}`));
