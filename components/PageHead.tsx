/**
 * Per-page title, description and canonical URL. On the web these end up in the
 * statically rendered HTML, which is what Google reads.
 *
 * ON A PHONE IT IS NOT INERT, which this comment used to claim. expo-router's
 * Head registers an NSUserActivity for Handoff, so the screen you are on can be
 * picked up on a Mac or an iPad. That needs to know the site it corresponds to,
 * and if it is not told, every screen change raises an alert saying so, on top
 * of the app, to the customer. The origin is set in app.json, on the expo-router
 * config plugin, and changing it needs a rebuild rather than an update.
 */
import Head from 'expo-router/head';
import { SITE_URL as SITE } from '../lib/site';

/**
 * The card people see when the shop shares a link on Facebook or Instagram.
 *
 * Without this every share is a blank grey rectangle with a URL under it. The
 * shopfront is the right image for it: it is the shop, it is legible at card
 * size, and it is the thing that tells somebody scrolling past that this is a
 * real place on a real street.
 */
const SHARE_IMAGE = `${SITE}/og.jpg`;

export function PageHead({
  title,
  description,
  path = '/',
}: {
  title: string;
  description: string;
  path?: string;
}) {
  const url = `${SITE}${path === '/' ? '' : path}`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={SHARE_IMAGE} />
      <meta property="og:image:alt" content="Perrin's Barber Shop on Old Cross, Hertford" />
      <meta name="twitter:image" content={SHARE_IMAGE} />
      <link rel="canonical" href={url} />
    </Head>
  );
}
