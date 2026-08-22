/**
 * GET /api/booking/availability?serviceId=&providerId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Every free slot for one barber and one service across a date range, in a
 * single reply. The client asks for one calendar month at a time, so opening the
 * calendar is one request and every day in that month is then instant — no
 * spinner, no round trip.
 *
 * Days are fanned out upstream in small batches and the whole reply is cached
 * for a minute at the edge, so a busy Saturday morning is one upstream burst
 * rather than one per visitor.
 */
import { failure, json, rateLimit } from '../../../server/http';
import {
  assertKnownPair,
  assertWithinHorizon,
  daysBetween,
  isValidDate,
  SchedulistaError,
  slotsForDay,
  TIME_ZONE,
  type Slot,
} from '../../../server/schedulista';

/** A calendar month plus the days either side that a month grid shows. */
const MAX_DAYS = 42;
/** Politeness: never open more than this many sockets to Schedulista at once. */
const BATCH = 8;

export type AvailabilityDay = {
  /** YYYY-MM-DD */
  date: string;
  slots: Array<{
    /** The exact string Schedulista gave us; sent back verbatim when booking. */
    iso: string;
    /** "09:30", already in Europe/London — safe to render without parsing. */
    label: string;
    part: 'morning' | 'afternoon' | 'evening';
  }>;
};

export type AvailabilityResponse = {
  ok: true;
  timeZone: string;
  from: string;
  to: string;
  generatedAt: string;
  days: AvailabilityDay[];
  /**
   * True when at least one day could not be read. The days we did get are still
   * correct, but an empty day in a partial month means "we do not know", not
   * "the shop is closed" — and the client must not act as though it does.
   */
  partial: boolean;
  /** The dates we could not read, so a partial month is debuggable. */
  unreadable: string[];
};

/** "2026-08-25T14:30:00+0100" -> { label: "14:30", part: "afternoon" } */
function describe(slot: Slot) {
  const clock = slot.start_time.slice(11, 16);
  const hour = Number(clock.slice(0, 2));
  return {
    iso: slot.start_time,
    label: clock,
    part: hour < 12 ? ('morning' as const) : hour < 17 ? ('afternoon' as const) : ('evening' as const),
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    rateLimit(request, 'availability', 60, 60_000);

    const params = new URL(request.url).searchParams;
    const serviceId = params.get('serviceId') ?? '';
    const providerId = params.get('providerId') ?? '';
    await assertKnownPair(providerId, serviceId);

    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    if (!isValidDate(from) || !isValidDate(to)) {
      throw new SchedulistaError('That date range is not valid.', 400, false);
    }
    // The far end of the range is the one that can breach the horizon; the near
    // end only has to be a real date, since a month always starts on the first.
    assertWithinHorizon(to);

    const dates = daysBetween(from, to);
    if (!dates.length || dates.length > MAX_DAYS) {
      throw new SchedulistaError(`Ask for between 1 and ${MAX_DAYS} days.`, 400, false);
    }

    // A single day failing must not blank the whole month, so a rejection
    // becomes an empty day and the calendar just shows it as unavailable.
    const results: Array<Slot[] | null> = [];
    for (let i = 0; i < dates.length; i += BATCH) {
      const batch = await Promise.all(
        dates.slice(i, i + BATCH).map((date) =>
          slotsForDay(serviceId, providerId, date).catch(() => null)
        )
      );
      results.push(...batch);
    }

    const unreadable = dates.filter((_, i) => results[i] === null);

    // If every day failed, that is an outage, not a fully booked shop.
    if (unreadable.length === dates.length) {
      throw new SchedulistaError('The booking system is not answering just now.', 502);
    }

    const payload: AvailabilityResponse = {
      ok: true,
      timeZone: TIME_ZONE,
      from,
      to,
      generatedAt: new Date().toISOString(),
      days: dates.map((date, i) => ({ date, slots: (results[i] ?? []).map(describe) })),
      partial: unreadable.length > 0,
      unreadable,
    };

    return json(payload, {
      headers: { 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    return failure(error);
  }
}
