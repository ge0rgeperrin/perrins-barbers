/**
 * The whole site, as one Netlify function.
 *
 * Expo builds two folders. `dist/client` is the pre-rendered HTML, the JS
 * bundle and the images, and Netlify serves those straight off its CDN.
 * `dist/server` is the API routes, and something has to run them: the booking
 * flow talks to Schedulista server-side because Schedulista sends no CORS
 * headers and its session cookie is SameSite=Lax, so a browser on our domain
 * cannot call it. That is this file.
 *
 * `path: '/*'` claims every request, and `preferStatic` hands back the ones the
 * CDN can already answer, so a page load never wakes the function and only the
 * four /api routes actually run here.
 *
 * Netlify Functions 2.0, so this is a DEFAULT export of a web-standard
 * handler. Exporting `handler` instead gives you the 1.0 signature, which the
 * adapter rejects with a clear error rather than a mystery.
 *
 * The .mjs extension is deliberate: package.json has no "type": "module", so a
 * .js file here would be loaded as CommonJS and `import` would fail.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from 'expo-server/adapter/netlify';

const here = path.dirname(fileURLToPath(import.meta.url));

export default createRequestHandler({
  // netlify.toml lists dist/server in included_files, which is what puts these
  // files next to the function in the deployed bundle.
  build: path.join(here, '../../dist/server'),
});

export const config = {
  path: '/*',
  preferStatic: true,
};
