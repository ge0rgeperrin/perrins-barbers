/**
 * Serves the production build the way Netlify will.
 *
 *   npm run build:web && npm run serve
 *
 * This exists so a deploy is never the first time the exported bundle is run.
 * `expo start` runs Metro, which is a different thing entirely: it transpiles on
 * demand, it has no pre-rendered HTML and it does not care whether the API
 * routes survived being exported. This runs the actual files that get uploaded.
 *
 * Static files come off disk from dist/client, exactly as Netlify's CDN will
 * serve them, and anything left over goes to the Expo request handler, which is
 * what the Netlify function does. If booking works here it will work there.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * The CommonJS build on purpose, not `import ... from 'expo-server/adapter/http'`.
 *
 * expo-server's ESM build uses extensionless relative imports ('./abstract'),
 * which every bundler resolves and Node's own ESM loader refuses. Bundled code
 * is fine, which is why the Netlify function can import it normally, but plain
 * Node cannot. Its CommonJS build has the same API and resolves.
 */
const require = createRequire(import.meta.url);
const { createRequestHandler } = require('expo-server/adapter/http');

const PORT = Number(process.env.PORT ?? 8081);
const CLIENT = path.resolve('dist/client');
const SERVER = path.resolve('dist/server');

if (!existsSync(SERVER)) {
  console.error('No dist/server. Run `npm run build:web` first.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const handler = createRequestHandler({ build: SERVER });

/** dist/client/<path>, or the same with .html, or nothing. */
function staticFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  // Nothing outside dist/client, whatever the request says.
  const resolved = path.resolve(CLIENT, '.' + clean);
  if (!resolved.startsWith(CLIENT)) return null;

  for (const candidate of [resolved, `${resolved}.html`, path.join(resolved, 'index.html')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

createServer((req, res) => {
  const file = req.method === 'GET' ? staticFile(req.url ?? '/') : null;

  if (file) {
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
    return;
  }

  handler(req, res, (error) => {
    if (error) console.error(error);
    res.writeHead(error ? 500 : 404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(error ? 'Server error' : 'Not found');
  });
}).listen(PORT, () => {
  console.log(`Production build on http://localhost:${PORT}`);
});
