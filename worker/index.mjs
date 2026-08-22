/**
 * The whole site, as one Cloudflare Worker.
 *
 * Expo builds two folders. `dist/client` is the JS bundle, the fonts and the
 * images, and Cloudflare's asset store serves those straight off its edge
 * without ever waking this Worker. `dist/server` is the pre-rendered pages and
 * the four API routes, and something has to run those: the booking flow talks
 * to Schedulista server-side because Schedulista sends no CORS headers and its
 * session cookie is SameSite=Lax, so a browser on our domain cannot call it.
 * That is this file.
 *
 * Workers has no filesystem, so `dist/server` cannot be read at request time
 * the way a Node host would. The adapter reaches it with
 * `await import('./server/<name>')` instead, and `find_additional_modules` in
 * wrangler.toml is what puts those files in the Worker's module registry. The
 * module `rules` there are load-bearing; the comments in that file explain why.
 *
 * A plain `import` works here and would not under plain Node: expo-server ships
 * an ESM build whose relative imports have no file extensions, which Node's own
 * loader refuses. Wrangler bundles this entry with esbuild, which resolves them
 * fine. scripts/serve.mjs hits the same trap and works around it with
 * createRequire, which would not help here: Workers has nothing to require from.
 */
import { createRequestHandler } from 'expo-server/adapter/workerd';

const handler = createRequestHandler(
  // Relative to this file once scripts/copy-worker.mjs has put it at
  // dist/index.mjs, which is also how Wrangler names the modules it finds.
  { build: './server' },
  {
    /**
     * HTML is the one thing that must not be cached: it carries the prices.
     * Fingerprinted assets under `_expo/static` get the opposite treatment, in
     * `public/_headers`.
     *
     * The API routes need nothing here. `json()` in server/http.ts already
     * sends `cache-control: no-store` on every reply, because a hold is single
     * use and a slot list is stale the moment somebody else books.
     */
    beforeHTMLResponse(init) {
      init.headers.set('cache-control', 'public, max-age=0, must-revalidate');
      return init;
    },
  }
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /**
     * Every canonical tag the site writes is the bare domain, so letting `www`
     * answer independently would split the shop's search ranking in two.
     */
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    /**
     * server/seal.ts reads `process.env.BOOKING_SECRET`. nodejs_compat fills
     * `process.env` from the Worker's vars and secrets on any compatibility
     * date from 2025-04-01, which wrangler.toml is well past, so this is belt
     * and braces. It is also one line against a failure whose only symptom is
     * booking being broken in production.
     */
    Object.assign(process.env, env);

    return handler(request, env, ctx);
  },
};
