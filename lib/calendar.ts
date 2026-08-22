/**
 * Calendar arithmetic for the booking flow.
 *
 * Every date in the product is a plain `YYYY-MM-DD` string in Europe/London,
 * never a Date object passed around — a Date carries the device's timezone with
 * it, and a phone set to Madrid must not shift a Hertford appointment by a day.
 * Where a Date is unavoidable it is built and read in UTC only.
 */
// Explicit extension: this module is unit tested under Node's type stripping,
// which does not guess extensions. Metro resolves it the same either way.
import { londonNow } from './hours.ts';

/** "2026-08" */
export type MonthKey = string;
/** "2026-08-22" */
export type DateKey = string;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Monday first, the way a British wall calendar reads. */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Today, in the shop's timezone rather than the visitor's. */
export function today(): DateKey {
  return londonNow().date;
}

export const monthOf = (date: DateKey): MonthKey => date.slice(0, 7);

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [year, index] = month.split('-').map(Number);
  const total = year * 12 + (index - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Whole months between two keys; negative if `b` is earlier than `a`. */
export function monthsApart(a: MonthKey, b: MonthKey): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function daysInMonth(month: MonthKey): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}

/** The first and last date of a month, for asking the API. */
export function monthBounds(month: MonthKey): { from: DateKey; to: DateKey } {
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(month))}` };
}

export function monthLabel(month: MonthKey): string {
  const [year, index] = month.split('-').map(Number);
  return `${MONTHS[index - 1]} ${year}`;
}

/** 0 = Sunday … 6 = Saturday, computed in UTC so no timezone can shift it. */
export function weekdayOf(date: DateKey): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** "Saturday, 22 August" */
export function longDate(date: DateKey): string {
  const [, month, day] = date.split('-').map(Number);
  return `${WEEKDAYS_LONG[weekdayOf(date)]}, ${day} ${MONTHS[month - 1]}`;
}

/** "Sat 22 Aug" — for tight spaces. */
export function shortDate(date: DateKey): string {
  const [, month, day] = date.split('-').map(Number);
  const weekday = weekdayOf(date);
  return `${WEEKDAYS_SHORT[(weekday + 6) % 7]} ${day} ${MONTHS[month - 1].slice(0, 3)}`;
}

/**
 * A month laid out as weeks of seven, Monday first. Cells outside the month are
 * null rather than the neighbouring month's dates: greyed-out numbers from
 * another month are the single biggest source of clutter in a booking calendar,
 * and nobody has ever needed to tap one.
 */
export function monthGrid(month: MonthKey): Array<Array<DateKey | null>> {
  const total = daysInMonth(month);
  // getUTCDay is Sunday-first; shift so Monday is column 0.
  const lead = (weekdayOf(`${month}-01`) + 6) % 7;

  const cells: Array<DateKey | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7)
  );
}
