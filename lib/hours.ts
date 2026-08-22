/**
 * Opening-hours logic for the "Open now" chip and the hours table.
 *
 * The shop is in Hertford, so every calculation is in Europe/London regardless
 * of where the phone thinks it is. We work the BST offset out by hand rather
 * than through Intl: Hermes ships a cut-down ICU on some Android builds where
 * `timeZone: 'Europe/London'` silently falls back to UTC, which would put the
 * chip an hour out for seven months of the year.
 *
 * ponytail: hard-coded EU/UK DST rule (last Sunday in March / October, 01:00
 * UTC). Correct since 1996 and unchanged by the current legislation. If the UK
 * ever abolishes the clock change, replace isBST with a lookup.
 */

export type DayHours = {
  day: number; // 0 = Sunday … 6 = Saturday
  opens: string; // "09:00"
  closes: string; // "17:00"
  closed?: boolean;
};

export type Holiday = { date: string; label: string }; // date: "2026-12-26"

export type OpenState =
  | { open: true; closesAt: string }
  | { open: false; reason: string; opensLabel: string | null };

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "09:30" -> 570. Returns null for anything unparseable. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 01:00 UTC on the last Sunday of the given month, in the given year. */
function lastSundayUTC(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const date = lastDay.getUTCDate() - lastDay.getUTCDay();
  return Date.UTC(year, month, date, 1, 0, 0, 0);
}

/** True when Europe/London is on British Summer Time (UTC+1) at this instant. */
export function isBST(at: Date): boolean {
  const year = at.getUTCFullYear();
  const t = at.getTime();
  return t >= lastSundayUTC(year, 2) && t < lastSundayUTC(year, 9);
}

/** The current London weekday, minute-of-day and calendar date. */
export function londonNow(at: Date = new Date()) {
  const shifted = new Date(at.getTime() + (isBST(at) ? 60 : 0) * 60_000);
  const iso = shifted.toISOString();
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    date: iso.slice(0, 10), // "2026-08-22"
  };
}

function entryFor(hours: DayHours[], day: number): DayHours | undefined {
  return hours.find((h) => h.day === day);
}

/**
 * Whether the shop is open right now, and the next thing that happens.
 * Holidays close the whole day and take priority over the weekly pattern.
 */
export function openState(
  hours: DayHours[],
  holidays: Holiday[] = [],
  at: Date = new Date()
): OpenState {
  const now = londonNow(at);
  const holidayToday = holidays.find((h) => h.date === now.date);
  const today = entryFor(hours, now.day);

  if (!holidayToday && today && !today.closed) {
    const opens = toMinutes(today.opens);
    const closes = toMinutes(today.closes);
    if (opens !== null && closes !== null) {
      if (now.minutes >= opens && now.minutes < closes) {
        return { open: true, closesAt: today.closes };
      }
      if (now.minutes < opens) {
        return { open: false, reason: 'Closed', opensLabel: `opens ${today.opens}` };
      }
    }
  }

  // Closed for the rest of today — find the next day the shop opens.
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (now.day + ahead) % 7;
    const entry = entryFor(hours, day);
    if (!entry || entry.closed || toMinutes(entry.opens) === null) continue;

    const date = new Date(at.getTime() + ahead * 86_400_000).toISOString().slice(0, 10);
    if (holidays.some((h) => h.date === date)) continue;

    const when = ahead === 1 ? 'tomorrow' : DAY_SHORT[day];
    return {
      open: false,
      reason: holidayToday?.label ?? 'Closed',
      opensLabel: `opens ${when} ${entry.opens}`,
    };
  }

  return { open: false, reason: holidayToday?.label ?? 'Closed', opensLabel: null };
}

/* ------------------------------------------------------------------ */
/* describing the week                                                 */
/* ------------------------------------------------------------------ */

/** "Wednesdays and Fridays" */
function plural(days: number[]): string {
  const names = days.map((day) => `${DAY_NAMES[day]}s`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * A sentence about the week, worked out from the hours themselves.
 *
 * This exists because the alternative was a hand-written line saying "late on
 * Wednesdays and Fridays, closed Mondays" — which is a promise the shop has to
 * remember to keep in step every time they change a time. Now the sentence and
 * the table cannot disagree, because they are the same data.
 *
 * Returns an empty string for a week with nothing distinctive to say about it.
 */
export function describeWeek(hours: DayHours[]): string {
  const open = hours
    .filter((entry) => !entry.closed)
    .map((entry) => ({ day: entry.day, opens: toMinutes(entry.opens), closes: toMinutes(entry.closes) }))
    .filter((entry): entry is { day: number; opens: number; closes: number } =>
      entry.opens !== null && entry.closes !== null
    );

  if (!open.length) return '';

  const parts: string[] = [];

  const latest = Math.max(...open.map((entry) => entry.closes));
  const earliestClose = Math.min(...open.map((entry) => entry.closes));
  if (latest > earliestClose) {
    parts.push(`Late on ${plural(open.filter((entry) => entry.closes === latest).map((e) => e.day))}`);
  }

  const earliest = Math.min(...open.map((entry) => entry.opens));
  const latestOpen = Math.max(...open.map((entry) => entry.opens));
  if (earliest < latestOpen) {
    parts.push(`early on ${plural(open.filter((entry) => entry.opens === earliest).map((e) => e.day))}`);
  }

  const shut = hours.filter((entry) => entry.closed).map((entry) => entry.day);
  if (shut.length && shut.length < 7) parts.push(`closed ${plural(shut)}`);

  if (!parts.length) return '';
  return `${parts.join(', ')}.`;
}
