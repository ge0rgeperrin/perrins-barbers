/**
 * The failures this project cannot catch any other way.
 *
 * `expo export` builds dist/server without ever reading wrangler.toml, and
 * `npm run serve` uses scripts/serve.mjs instead of the Worker. So a wrong
 * module rule passes the build, passes local serving, deploys green, and then
 * breaks only booking, with an error that points nowhere near the cause.
 *
 * The Worker entry itself cannot be imported here: expo-server's ESM build
 * uses extensionless relative imports that Node cannot resolve, which is why
 * scripts/serve.mjs reaches for createRequire. Wrangler bundles this entry
 * with esbuild, which can. `npx wrangler dev` is the check for that half;
 * this file guards the configuration around it.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('wrangler.toml ships dist/server on the terms the adapter needs', () => {
  assert.match(
    config,
    /type = "CommonJS"[^[]*globs = \["server\/\*\*\/\*\.js"\]/,
    'server bundles are CommonJS; as ESModule they lose require and node:crypto becomes null'
  );
  assert.match(
    config,
    /type = "Text"[^[]*globs = \[[^\]]*server\/_expo\/routes\.json[^\]]*\]/,
    'the route manifest must arrive as text; readJson parses a string, not an ArrayBuffer'
  );
  assert.match(
    config,
    /find_additional_modules = true/,
    'without this nothing under dist/server is shipped and every request 500s'
  );
  assert.match(config, /compatibility_flags = \["nodejs_compat"\]/, 'node:crypto needs it');

  const date = config.match(/compatibility_date = "([\d-]+)"/)?.[1];
  assert.ok(
    date && date >= '2025-04-01',
    'process.env is only filled from vars and secrets from 2025-04-01; ' +
      'before that BOOKING_SECRET is invisible to server/seal.ts'
  );

  assert.match(config, /NODE_ENV = "production"/, 'otherwise seal.ts falls back to a dev key');
  assert.match(config, /main = "dist\/index\.mjs"[\s\S]*base_dir = "dist"/);
});

test('the exported server bundles are still CommonJS', { skip: !existsSync('dist/server') }, () => {
  const bundle = readFileSync('dist/server/_expo/functions/api/booking/hold+api.js', 'utf8');
  assert.match(
    bundle,
    /module\.exports\s*=/,
    'Metro now emits ES modules; the CommonJS rule in wrangler.toml has to change with it'
  );
  assert.match(
    bundle,
    /\$\$require_external/,
    'the shim that reaches node:crypto is gone; check how the bundle imports it now'
  );
});
