/**
 * The client half of the booking proxy. Nothing here knows Schedulista exists;
 * it only talks to our own /api/booking routes.
 */
import { Platform } from 'react-native';
import { monthBounds } from './calendar';
import { apiOrigin } from './site';

export type SlotView = {
  iso: string;
  label: string;
  part: 'morning' | 'afternoon' | 'evening';
};

export type DayView = { date: string; slots: SlotView[] };

export type Availability = {
  timeZone: string;
  from: string;
  to: string;
  generatedAt: string;
  days: DayView[];
  /** Some days could not be read. An empty day here means unknown, not closed. */
  partial: boolean;
  unreadable: string[];
};

export type HoldView = {
  seal: string;
  expiresAt: string;
  summary: { provider: string; service: string; priceLabel: string; date: string; iso: string };
};

export type CustomerDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
  smsReminder?: boolean;
  /** Honeypot — left empty by anything with hands. */
  website?: string;
};

/**
 * Anything the customer might need to see. `fallbackUrl` means the flow cannot
 * continue here and the honest move is to hand them to the hosted scheduler.
 */
export class BookingError extends Error {
  status: number;
  fieldErrors: string[];
  fallbackUrl?: string;
  expired: boolean;

  constructor(
    message: string,
    status: number,
    fieldErrors: string[] = [],
    fallbackUrl?: string,
    expired = false
  ) {
    super(message);
    this.name = 'BookingError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.fallbackUrl = fallbackUrl;
    this.expired = expired;
  }
}

/**
 * On the web the API is same-origin. A phone has to be told where the site is.
 * See lib/site.ts.
 */
const ORIGIN = apiOrigin(Platform.OS === 'web');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ORIGIN}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new BookingError('No connection to the booking system.', 0);
  }

  const body = await res.json().catch(() => null);

  if (!res.ok || body?.ok === false) {
    throw new BookingError(
      body?.message ?? `Booking system error (${res.status}).`,
      res.status,
      body?.errors ?? [],
      body?.fallbackUrl,
      body?.expired === true
    );
  }
  return body as T;
}

/** One calendar month of availability, asked for by its "2026-08" key. */
export function fetchAvailability(
  serviceId: string,
  providerId: string,
  month: string,
  signal?: AbortSignal
): Promise<Availability> {
  const { from, to } = monthBounds(month);
  const query = `serviceId=${serviceId}&providerId=${providerId}&from=${from}&to=${to}`;
  return request<Availability>(`/api/booking/availability?${query}`, { signal });
}

export function openHold(
  serviceId: string,
  providerId: string,
  date: string,
  iso: string,
  signal?: AbortSignal
): Promise<HoldView> {
  const query = `serviceId=${serviceId}&providerId=${providerId}&date=${date}&iso=${encodeURIComponent(iso)}`;
  return request<HoldView>(`/api/booking/hold?${query}`, { signal });
}

export function reserve(
  seal: string,
  details: CustomerDetails
): Promise<{ ok: true; message: string }> {
  return request('/api/booking/reserve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seal, ...details }),
  });
}
