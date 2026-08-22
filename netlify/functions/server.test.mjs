/**
 * The one failure this project cannot catch any other way.
 *
 * `expo export` builds dist/server without ever loading this file, and
 * `npm run serve` uses scripts/serve.mjs instead of the Netlify adapter. So a
 * bad import here passes the build, passes local serving, deploys green, and
 * then 502s on every single request — pages and API routes alike — because the
 * function throws while Node is still loading the module.
 *
 * That is exactly what shipped once: a named import off expo-server's broken
 * dual package. This test loads the module the way Netlify's runtime does.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the Netlify function loads and exports a Functions 2.0 handler', async () => {
  const mod = await import('./server.mjs');

  assert.equal(
    typeof mod.default,
    'function',
    'Netlify Functions 2.0 needs a default export; anything else 502s at runtime'
  );
  assert.equal(mod.config.path, '/*', 'the function has to claim every path');
  assert.equal(
    mod.config.preferStatic,
    true,
    'without preferStatic the CDN stops answering for pre-rendered pages'
  );
});
