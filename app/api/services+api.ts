/**
 * GET /api/services
 *
 * The live service list, read from the shop's own Schedulista page.
 *
 * This is what makes the site self-maintaining. Add a barber in Schedulista and
 * they appear here — and so on every screen — within ten minutes. Remove one and
 * they are gone just as fast. Nobody has to touch this repository for either.
 *
 * The build-time copy in assets/services.json is still bundled so the very first
 * paint has real prices with no round trip; this route is what keeps that copy
 * from ever being the newest thing the customer sees.
 */
import { liveCatalog } from '../../server/catalog';
import bundled from '../../assets/services.json';

export async function GET(): Promise<Response> {
  try {
    const { catalog, stale } = await liveCatalog();
    return Response.json(catalog, {
      headers: {
        // Short shared cache, long stale window: the shop's page going down
        // must never take the price list with it.
        'cache-control': stale
          ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=3600'
          : 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    // Cold start and the scheduler is not answering. The snapshot from the last
    // build is real data from the same source, only older — better than nothing,
    // and cached briefly so we try again soon.
    console.error('[services] falling back to the bundled list', error);
    return Response.json(bundled, {
      headers: { 'cache-control': 'public, max-age=0, s-maxage=30' },
    });
  }
}
