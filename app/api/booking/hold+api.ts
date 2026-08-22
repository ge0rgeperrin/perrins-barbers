/**
 * GET /api/booking/hold?serviceId=&providerId=&date=&iso=
 *
 * Prepares the final step. We fetch Schedulista's own details form for the
 * chosen slot and keep the session and CSRF token that belong together, sealed
 * into an opaque blob the browser hands back when it submits.
 *
 * This does NOT reserve anything — Schedulista has no hold concept, so the slot
 * is still first-come until the reservation lands. The client says so.
 */
import { failure, json, rateLimit } from '../../../server/http';
import {
  assertKnownPair,
  assertWithinHorizon,
  isValidDate,
  openHold,
  SchedulistaError,
} from '../../../server/schedulista';
import { HOLD_TTL_MS, seal } from '../../../server/seal';

export type HoldResponse = {
  ok: true;
  seal: string;
  expiresAt: string;
  summary: { provider: string; service: string; priceLabel: string; date: string; iso: string };
};

export async function GET(request: Request): Promise<Response> {
  try {
    rateLimit(request, 'hold', 30, 60_000);

    const params = new URL(request.url).searchParams;
    const serviceId = params.get('serviceId') ?? '';
    const providerId = params.get('providerId') ?? '';
    const date = params.get('date') ?? '';
    const iso = params.get('iso') ?? '';

    const known = await assertKnownPair(providerId, serviceId);
    if (!isValidDate(date)) throw new SchedulistaError('That date is not valid.', 400, false);
    assertWithinHorizon(date);
    if (!iso || Number.isNaN(Date.parse(iso))) {
      throw new SchedulistaError('That time is not valid.', 400, false);
    }
    // The slot has to belong to the day it claims, or the form and the diary
    // would disagree about what is being booked.
    if (!iso.startsWith(date)) {
      throw new SchedulistaError('That time is not on that day.', 400, false);
    }

    const hold = await openHold(serviceId, providerId, iso, date);
    const now = Date.now();

    const body: HoldResponse = {
      ok: true,
      seal: seal(hold, now),
      expiresAt: new Date(now + HOLD_TTL_MS).toISOString(),
      summary: { ...known, date, iso },
    };
    return json(body);
  } catch (error) {
    return failure(error);
  }
}
