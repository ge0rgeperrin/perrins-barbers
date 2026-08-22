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
 * The base for our own API calls.
 *
 * Empty on the web so every call is same-origin, which is what makes the site
 * work on a preview URL, on a staging domain and on the real one without a
 * rebuild. Absolute everywhere else, because a phone has nowhere else to look.
 */
export function apiOrigin(isWeb: boolean): string {
  return isWeb ? '' : SITE_URL;
}
