/**
 * Owner-editable content. Today it comes from content/content.json; when the
 * shop moves onto Sanity this file is the only place that changes — every screen
 * imports from here, never from the JSON directly.
 */
// The import attribute keeps this module runnable under Node, which is how the
// tests reach it. Metro accepts it too.
import raw from '../content/content.json' with { type: 'json' };
import type { DayHours, Holiday } from './hours';

export type Business = {
  name: string;
  established: number;
  /** The few words under the shop name on the front page, off the badge. */
  strapline: string;
  /** One sentence, for search results and social cards. */
  tagline: string;
  about: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: string[];
  mapsUrl: string;
  instagram: string;
  facebook: string;
};

export type Banner = { active: boolean; text: string; link: string };

export type BookingSettings = {
  /** How many months past this one the calendar will page. */
  monthsAhead: number;
  /** How many empty months the flow will skip through on its own. */
  autoAdvanceMonths: number;
  smsRemindersOffered: boolean;
};

/** The named blocks of the home screen, in the order the owners put them. */
export type HomeBlock = 'hero' | 'about' | 'prices' | 'hours' | 'find';

export type LayoutSettings = {
  home: HomeBlock[];
  featuredCount: number;
};

export const business = raw.business as Business;
export const hours = raw.hours as DayHours[];
export const holidays = raw.holidays as Holiday[];
export const banner = raw.banner as Banner;

const HOME_BLOCKS: HomeBlock[] = ['hero', 'about', 'prices', 'hours', 'find'];

/**
 * Owner settings are read defensively. A missing block, a typo in a block name
 * or a nonsense number falls back to the shipped value rather than rendering an
 * empty screen — the people editing this file are barbers, not developers, and
 * a saved typo must never take the site down.
 */
export const booking: BookingSettings = {
  monthsAhead: clampInt(raw.booking?.monthsAhead, 1, 24, 3),
  autoAdvanceMonths: clampInt(raw.booking?.autoAdvanceMonths, 0, 6, 2),
  smsRemindersOffered: raw.booking?.smsRemindersOffered !== false,
};

export const layout: LayoutSettings = {
  home: (raw.layout?.home ?? HOME_BLOCKS).filter((block): block is HomeBlock =>
    (HOME_BLOCKS as string[]).includes(block)
  ),
  featuredCount: clampInt(raw.layout?.featuredCount, 1, 12, 4),
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** "5 Old Cross, Hertford, SG14 1HX" */
export const addressLine = business.address.join(', ');
