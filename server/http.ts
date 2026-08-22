/**
 * Shared plumbing for the booking API routes: JSON replies, error translation
 * and a small rate limit.
 */
import { SchedulistaError, HOSTED_SCHEDULER } from './schedulista';
import { SealExpired, SealInvalid } from './seal';

export function json<T>(body: T, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  });
}

/**
 * One shape for every failure the client has to render. `fallbackUrl` is present
 * whenever the honest next move is to hand the customer to Schedulista's own
 * page rather than keep them in a flow we cannot complete.
 */
export function failure(error: unknown): Response {
  if (error instanceof SchedulistaError) {
    return json(
      {
        ok: false,
        message: error.message,
        ...(error.fallback ? { fallbackUrl: HOSTED_SCHEDULER } : {}),
      },
      { status: error.status }
    );
  }
  if (error instanceof SealExpired) {
    return json({ ok: false, message: error.message, expired: true }, { status: 410 });
  }
  if (error instanceof SealInvalid) {
    return json({ ok: false, message: error.message }, { status: 400 });
  }

  console.error('[booking] unhandled', error);
  return json(
    {
      ok: false,
      message: 'Something went wrong on our side.',
      fallbackUrl: HOSTED_SCHEDULER,
    },
    { status: 500 }
  );
}

/* ------------------------------------------------------------------ */
/* rate limit                                                          */
/* ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * ponytail: in-process fixed-window counter. It is per server instance, so a
 * platform running several instances multiplies the effective limit — fine for
 * a two-chair barbershop, and it costs nothing. If booking spam ever becomes
 * real, move this to the edge (Vercel firewall) or a shared KV store.
 */
export function rateLimit(request: Request, name: string, max: number, windowMs: number) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const key = `${name}:${ip}`;
  const now = Date.now();

  // Opportunistic sweep; the map only ever holds recent callers.
  if (buckets.size > 5000) {
    for (const [k, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    throw new SchedulistaError('Too many attempts. Give it a minute and try again.', 429, false);
  }
}
