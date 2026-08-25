/**
 * Where this site lives.
 *
 * One value, used three ways, and it has to be right in all of them:
 *
 *   - the canonical and og:url tags in the pre-rendered HTML, which is what
 *     Google indexes and what Facebook reads when the shop shares a link
 *   - the base the iOS and Android apps call for prices and for booking, since
 *     a phone has no same-origin to fall back on
 *   - nothing on the web itself, where every request is same-origin and a
 *     hardcoded host would break the moment the site moved
 *
 * Set EXPO_PUBLIC_SITE_URL in the hosting environment before building. It is
 * read at BUILD time, not at request time, because Metro inlines every
 * EXPO_PUBLIC_ variable into the bundle: changing it means a redeploy, not a
 * restart. Locally, put it in `.env` (see `.env.example`).
 *
 * No trailing slash, ever. Two of the three uses concatenate a path onto it.
 */
const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (configured && configured.length > 0
  ? configured
  : 'https://perrinsbarbers.co.uk'
).replace(/\/+$/, '');

/**
 * Whether a relative URL will resolve — which is the only thing `apiOrigin`
 * actually needs to know, and it is true in a browser and nowhere else.
 *
 * NOT `Platform.OS === 'web'`, even though that is what it means, and not
 * `typeof window !== 'undefined'`, which is the obvious test and the wrong one:
 *
 *   - React Native sets `global.window = global`, so a `window` check is true
 *     on a phone as well as in a browser. The earlier version of this test
 *     survived only because nothing happens to define `window.location` on
 *     native. The day a dependency shims it, every phone would ask for a
 *     relative `/api/services`, that fetch would fail, and the app would serve
 *     the build-time price snapshot for ever with no error anywhere.
 *
 *   - `Platform` cannot be imported here. This module is reached from
 *     lib/services.ts, which lib/services.test.ts imports under bare `node
 *     --test`; react-native's entry point is Flow-typed and Node's TypeScript
 *     stripping refuses it. That test is the reason this file has no
 *     dependencies, and it is worth keeping.
 *
 * `document` is defined in a browser, undefined under React Native, and
 * undefined in Node — so the static export renders the absolute URL and the
 * browser bundle renders the relative one, which is correct for both.
 *
 * ONE ANSWER, IN ONE PLACE. Two modules asking this question two different ways
 * is what put the bug here to begin with.
 */
export const IS_BROWSER = typeof document !== 'undefined';

/**
 * The base for our own API calls.
 *
 * Empty on the web so every call is same-origin, which is what makes the site
 * work on a preview URL, on a staging domain and on the real one without a
 * rebuild. Absolute everywhere else, because a phone has nowhere else to look.
 */
export function apiOrigin(): string {
  return IS_BROWSER ? '' : SITE_URL;
}
