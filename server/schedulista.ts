/**
 * Everything that talks to Schedulista. Server-side only — this module is
 * imported by the API routes under app/api and must never reach the client.
 *
 * WHY A PROXY EXISTS AT ALL
 * Schedulista's scheduler is a Rails app that sends no CORS headers, and its
 * session cookie is SameSite=Lax. A browser on perrinsbarbers.co.uk therefore
 * cannot call it directly, and a cross-site form POST would arrive without the
 * session its CSRF token is bound to. So the booking conversation happens
 * server-side and the customer only ever talks to us.
 *
 * THE FLOW, as observed on the live scheduler:
 *   GET  /schedule/<code>/available_times_json?service_id&provider_id&date&time_zone
 *          -> [{ start_time: "2026-08-25T09:00:00+0100", provider_id: 1074010081 }]
 *   GET  /schedule/<code>/reserve_appointment?service_id&provider_id&date&time
 *          -> the customer-details form, carrying an authenticity_token bound to
 *             the session cookies set on that same response
 *   POST /schedule/<code>/reserve_appointment?<same query>
 *          -> 302 on success; 400 re-rendering the form with field errors;
 *             422 if the token and session do not match
 *
 * These endpoints are undocumented. Everything here assumes they can change
 * without notice, so every failure is explicit and the caller can fall back to
 * the hosted scheduler rather than guess.
 */
// The import attribute is required by Node, which runs the API routes and the
// tests; Metro accepts it too.
import services from '../public/services.json' with { type: 'json' };
import content from '../content/content.json' with { type: 'json' };
import { liveCatalog } from './catalog.ts';

export const BUSINESS_CODE = 'perrins1';
export const BASE = `https://www.schedulista.com/schedule/${BUSINESS_CODE}`;
export const HOSTED_SCHEDULER = 'https://perrins1.schedulista.com/';

/**
 * How far ahead the shop takes bookings. The owners set it in content.json;
 * both the calendar and this module read the same number, so they cannot drift.
 */
export const MONTHS_AHEAD = Math.min(24, Math.max(1, Math.round(content.booking?.monthsAhead ?? 3)));

/** Rails' friendly zone name, which is what the scheduler's own dropdown sends. */
export const TIME_ZONE = 'London';

const UA = 'PerrinsBarbershopSite/1.0 (+https://perrinsbarbers.co.uk)';
const TIMEOUT_MS = 8000;

export type Slot = { start_time: string; provider_id: number };

export class SchedulistaError extends Error {
  status: number;
  /** True when the customer should be sent to the hosted scheduler instead. */
  fallback: boolean;

  // Written out longhand rather than as constructor parameter properties, which
  // Node's type stripping cannot run — and this file is unit tested under Node.
  constructor(message: string, status: number, fallback = true) {
    super(message);
    this.name = 'SchedulistaError';
    this.status = status;
    this.fallback = fallback;
  }
}

/* ------------------------------------------------------------------ */
/* cookies                                                             */
/* ------------------------------------------------------------------ */

/** Merge Set-Cookie headers into a single Cookie header value. */
export function absorbCookies(previous: string, res: Response): string {
  const set = res.headers.getSetCookie?.() ?? [];
  if (!set.length) return previous;

  const jar = new Map<string, string>();
  for (const pair of previous ? previous.split('; ') : []) {
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  for (const header of set) {
    const [pair] = header.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      signal,
      headers: { 'user-agent': UA, ...(init.headers ?? {}) },
    });
  } catch (cause) {
    throw new SchedulistaError(
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'The booking system did not answer in time.'
        : 'Could not reach the booking system.',
      504
    );
  }
}

/* ------------------------------------------------------------------ */
/* whitelist                                                           */
/* ------------------------------------------------------------------ */

type PairInfo = { provider: string; service: string; priceLabel: string };

type IndexableProvider = {
  id: string;
  name: string;
  services: Array<{ id: string; name: string; priceLabel: string }>;
};

function index(providers: IndexableProvider[]): Map<string, PairInfo> {
  return new Map(
    providers.flatMap((provider) =>
      provider.services.map((service): [string, PairInfo] => [
        `${provider.id}:${service.id}`,
        { provider: provider.name, service: service.name, priceLabel: service.priceLabel },
      ])
    )
  );
}

/** The pairs that existed when this build was made. Never the only answer. */
const BUNDLED = index(services.providers);

/**
 * Only this shop's own service/barber pairs may pass through the proxy. Without
 * this the endpoint would happily book appointments at any other Schedulista
 * business, which is not a thing we want to host.
 *
 * The live scheduler is consulted first and the build-time list is the floor.
 * That matters both ways round: a barber taken on this morning can be booked
 * today rather than after the next deploy, and a scheduler outage cannot lock
 * every customer out of a shop whose services have not actually changed.
 */
export async function assertKnownPair(providerId: string, serviceId: string): Promise<PairInfo> {
  const key = `${providerId}:${serviceId}`;

  const bundled = BUNDLED.get(key);
  if (bundled) return bundled;

  try {
    const { catalog } = await liveCatalog();
    const live = index(catalog.providers).get(key);
    if (live) return live;
  } catch {
    // Fall through to the refusal below: an unreadable scheduler is not a
    // reason to let an unknown pair through.
  }

  throw new SchedulistaError('That barber does not offer that service.', 400, false);
}

/* ------------------------------------------------------------------ */
/* how far ahead                                                       */
/* ------------------------------------------------------------------ */

/**
 * The booking horizon, enforced here as well as in the calendar.
 *
 * The client stops its arrows at the same number, but the client is not a
 * security boundary — without this, a hand-typed address could ask the shop's
 * diary for next Christmas and hold a slot the owners never meant to sell.
 */
export function assertWithinHorizon(isoDate: string) {
  const now = new Date();
  const limit = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + MONTHS_AHEAD + 1, 0, 23, 59, 59)
  );
  const asked = Date.parse(`${isoDate}T00:00:00Z`);

  // Yesterday is not bookable either; allow today in full, in London terms.
  const floor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86_400_000;

  if (Number.isNaN(asked) || asked < floor) {
    throw new SchedulistaError('That date has already passed.', 400, false);
  }
  if (asked > limit.getTime()) {
    throw new SchedulistaError(
      `Bookings open ${MONTHS_AHEAD} month${MONTHS_AHEAD === 1 ? '' : 's'} ahead. Ring the shop for anything further out.`,
      400,
      false
    );
  }
}

/* ------------------------------------------------------------------ */
/* dates                                                               */
/* ------------------------------------------------------------------ */

/** Schedulista wants YYYYMMDD; we speak YYYY-MM-DD everywhere else. */
export const compact = (isoDate: string) => isoDate.replace(/-/g, '');

export function isValidDate(isoDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && !Number.isNaN(Date.parse(isoDate));
}

/** The next `count` dates from `from`, as YYYY-MM-DD. */
export function dateRange(from: Date, count: number): string[] {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10)
  );
}

/** Every date from `from` to `to` inclusive. Empty if `to` is before `from`. */
export function daysBetween(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const count = Math.round((end - start) / 86_400_000) + 1;
  return dateRange(new Date(start), count);
}

/* ------------------------------------------------------------------ */
/* availability                                                        */
/* ------------------------------------------------------------------ */

/**
 * Free slots for one barber, one service, one day.
 *
 * Note: Schedulista also exposes available_days_json, which would save a round
 * trip per day — but it answers 500 for every parameter combination the live
 * page's own JavaScript builds, so it is not used. Asking per day is slower
 * upstream and identical downstream, because we fan the days out in parallel.
 */
export async function slotsForDay(
  serviceId: string,
  providerId: string,
  isoDate: string,
  attempt = 0
): Promise<Slot[]> {
  const url =
    `${BASE}/available_times_json?service_id=${encodeURIComponent(serviceId)}` +
    `&provider_id=${encodeURIComponent(providerId)}` +
    `&date=${compact(isoDate)}&time_zone=${encodeURIComponent(TIME_ZONE)}`;

  const res = await call(url, { headers: { accept: 'application/json' } });

  // A month is 31 of these at once, and Schedulista starts shedding load under
  // that. One backed-off retry turns nearly all of those into a normal answer;
  // whatever is left is reported as a failure, never as "no times that day".
  if (!res.ok) {
    if (attempt < 1 && (res.status === 429 || res.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 400 + attempt * 400));
      return slotsForDay(serviceId, providerId, isoDate, attempt + 1);
    }
    throw new SchedulistaError(`Availability lookup failed (${res.status}).`, 502);
  }

  const body = await res.json().catch(() => null);
  if (!Array.isArray(body)) {
    throw new SchedulistaError('The booking system returned something unexpected.', 502);
  }
  return body as Slot[];
}

/* ------------------------------------------------------------------ */
/* holding a slot                                                      */
/* ------------------------------------------------------------------ */

export type Hold = {
  cookie: string;
  token: string;
  serviceId: string;
  providerId: string;
  /** YYYYMMDD, as Schedulista wants it in the form. */
  date: string;
  /** The exact start_time string Schedulista handed us. Echoed back verbatim. */
  time: string;
};

/**
 * Fetch the details form for one slot and keep the session and CSRF token that
 * belong together. Nothing is reserved yet — Schedulista has no hold concept, so
 * the slot can still be taken by someone else until the POST lands.
 */
export async function openHold(
  serviceId: string,
  providerId: string,
  startTime: string,
  isoDate: string
): Promise<Hold> {
  const query =
    `service_id=${encodeURIComponent(serviceId)}` +
    `&provider_id=${encodeURIComponent(providerId)}` +
    `&date=${compact(isoDate)}&time=${encodeURIComponent(startTime)}`;

  const res = await call(`${BASE}/reserve_appointment?${query}`, {
    headers: { accept: 'text/html' },
  });
  if (!res.ok) throw new SchedulistaError(`Could not open that slot (${res.status}).`, 502);

  const cookie = absorbCookies('', res);
  const html = await res.text();
  const token = html.match(/name="authenticity_token"\s+value="([^"]+)"/)?.[1];

  if (!token || !cookie) {
    throw new SchedulistaError('The booking form could not be prepared.', 502);
  }
  return { cookie, token, serviceId, providerId, date: compact(isoDate), time: startTime };
}

/* ------------------------------------------------------------------ */
/* reserving                                                           */
/* ------------------------------------------------------------------ */

export type Customer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
  smsReminder?: boolean;
};

export type ReserveResult =
  | { ok: true }
  | { ok: false; errors: string[] }
  /** We could not tell what happened. Never claim a booking on this. */
  | { ok: false; indeterminate: true; errors: string[] };

/** Rails renders each failed validation as a list item inside .error / .errors. */
function fieldErrors(html: string): string[] {
  const found = [...html.matchAll(/<(?:li|div|span)[^>]*class="[^"]*error[^"]*"[^>]*>([\s\S]{0,200}?)<\//gi)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    // The form ships an empty JS template literal in the same class; drop it.
    .filter((text) => text && !text.includes('+ message +'));
  return [...new Set(found)];
}

export async function reserve(hold: Hold, customer: Customer): Promise<ReserveResult> {
  const query =
    `service_id=${encodeURIComponent(hold.serviceId)}` +
    `&provider_id=${encodeURIComponent(hold.providerId)}` +
    `&date=${hold.date}&time=${encodeURIComponent(hold.time)}`;

  const body = new URLSearchParams({
    utf8: '✓',
    authenticity_token: hold.token,
    service_id: hold.serviceId,
    provider_id: hold.providerId,
    date: hold.date,
    time: hold.time,
    fname: customer.firstName,
    lname: customer.lastName,
    email: customer.email,
    country: 'GB',
    phone: customer.phone,
    client_memo: customer.notes ?? '',
    commit: 'Schedule Appointment',
    ...(customer.smsReminder ? { send_sms: 'true', send_sms_lead_time: '120' } : {}),
  });

  const res = await call(`${BASE}/reserve_appointment?${query}`, {
    method: 'POST',
    headers: {
      cookie: hold.cookie,
      'content-type': 'application/x-www-form-urlencoded',
      referer: `${BASE}/reserve_appointment?${query}`,
      accept: 'text/html',
    },
    body: body.toString(),
  });

  // A redirect away from the form is Rails saying the appointment was created.
  if (res.status >= 300 && res.status < 400) return { ok: true };

  const html = await res.text();

  if (res.status === 422) {
    // Token and session disagreed — usually an expired hold.
    throw new SchedulistaError('That booking form expired. Please pick your time again.', 409);
  }

  if (res.status === 400 || res.status === 200) {
    const errors = fieldErrors(html);
    if (errors.length) return { ok: false, errors };

    // 200 with no errors and no redirect: most likely the confirmation page.
    if (/appointment (is |has been )?(scheduled|confirmed|booked)|thank you/i.test(html)) {
      return { ok: true };
    }
  }

  // Anything else: say so plainly rather than inventing an outcome.
  return {
    ok: false,
    indeterminate: true,
    errors: [`The booking system answered unexpectedly (${res.status}).`],
  };
}
