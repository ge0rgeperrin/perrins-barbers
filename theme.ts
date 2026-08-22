/**
 * The whole visual system. Every colour, size and face used anywhere in the app
 * comes from here. Nothing else in the codebase may write a hex value.
 *
 * The values themselves live in content/content.json under "design", so the
 * owners can change the shop's colours, corner radius and spacing without
 * touching a line of code. This file reads them, fills in anything missing, and
 * derives the handful of tokens that are computed rather than chosen.
 *
 * DIRECTION: BLACK AND GOLD.
 * The page is black, a true neutral one: an earlier version carried a little
 * warmth in it and read as brown next to the gold, which is the one thing this
 * palette cannot afford. Panels are one step up from the page, not a different
 * material, so the gold carries the whole hierarchy on its own and nothing else
 * needs a colour.
 *
 * The gold is not chosen, it is SAMPLED: #C6A43C is the exact value of the
 * lettering on the badge, read off the file, and the two status colours are the
 * rose and its leaves read the same way. Gold text on this site and gold text
 * on the shop's own mark are the same colour to the byte.
 *
 * CONTRAST BUDGET, measured rather than estimated:
 *
 *   cream on ink     17.0:1   body text and headings
 *   goldLift on ink  11.5:1   lifted gold, hover, prices
 *   muted on ink      9.4:1   secondary text
 *   gold on ink       8.5:1   any size, anywhere
 *   gold on panel     7.9:1   any size, on a card
 *   ink on gold       8.5:1   the label on the Book now button
 *   mutedDim on ink   5.6:1   captions and footnotes
 *
 * On the black ground gold clears AA at every size, which it did not on the
 * previous mid-tone ground. So small caps labels are plain gold again, and
 * goldLift is what it says: gold catching the light, for hover and for numbers.
 */
import raw from './content/content.json' with { type: 'json' };

type Palette = {
  ink: string;
  panel: string;
  panel2: string;
  gold: string;
  goldLift: string;
  goldDeep: string;
  cream: string;
  muted: string;
  mutedDim: string;
  open: string;
  closed: string;
};

/** What ships if the owners delete a key, or the whole design block. */
const DEFAULTS: Palette = {
  ink: '#050505',
  panel: '#111111',
  panel2: '#1B1B1B',
  gold: '#C6A43C',
  goldLift: '#D8C17A',
  goldDeep: '#877029',
  cream: '#F2EADA',
  muted: '#B4B0A8',
  mutedDim: '#8A867E',
  open: '#3C8F6A',
  closed: '#ED2F0A',
};

export type Design = {
  palette: Partial<Palette>;
  corner: number;
  density: number;
};

const design = (raw as { design?: Partial<Design> }).design ?? {};
const chosen: Palette = { ...DEFAULTS, ...(design.palette ?? {}) };

/** Keep an owner's typo from producing a layout nobody can read. */
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const density = clamp(design.density, 0.8, 1.3, 1);
const corner = clamp(design.corner, 0, 24, 2);

/** rgba() from a #rrggbb, so the rules stay gold-tinted whatever gold becomes. */
function alpha(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
}

/** Move a hex toward white (positive) or black (negative) by a fraction. */
function shift(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const n = Number.parseInt(full, 16);
  const move = (channel: number) =>
    Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(move);
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export const color = {
  ink: chosen.ink, // the page
  panel: chosen.panel, // cards, the price board, the booking sheet
  panel2: chosen.panel2, // a raised surface inside a panel

  /**
   * A panel under a finger. panel2 is already the raised surface inside a card,
   * so a pressed state needs one more step or the press does not register.
   */
  panelPress: shift(chosen.panel, 0.22),
  /** Blacker than the page. Sits behind a photograph while it loads. */
  inkDeep: shift(chosen.ink, -0.35),

  // Derived, not chosen: a rule is the accent at low alpha, never a grey. Doing
  // it here means an owner who changes gold gets matching rules for free.
  line: alpha(chosen.gold, 0.3),
  lineSoft: alpha(chosen.cream, 0.12),

  gold: chosen.gold, // the signwriting. 8.1:1 on the page, so it goes anywhere
  goldLift: chosen.goldLift, // gold catching the light: hover, prices, today
  goldDeep: chosen.goldDeep, // rules, dot leaders, disabled gold

  cream: chosen.cream, // primary text
  muted: chosen.muted, // secondary text
  mutedDim: chosen.mutedDim, // captions, footnotes

  open: chosen.open, // the rose's leaves. Status only, never decorative
  closed: chosen.closed, // the rose itself
  warnText: '#D9A441', // "we could not read this", not "this is wrong"

  // Text on a gold fill: the page's own black. That is how the shop's signage
  // works, black lettering cut into gold, and it measures 8.1:1.
  onGold: chosen.ink,
} as const;

/** 4-based scale, scaled by the owners' density setting. Use these, not numbers. */
const step = (n: number) => Math.round(n * density);

export const space = {
  xs: step(4),
  sm: step(8),
  md: step(12),
  base: step(16),
  lg: step(24),
  xl: step(32),
  xxl: step(48),
  huge: step(64),
} as const;

/** Traditional signage is square-cornered. Pills are for status chips only. */
export const radius = {
  card: corner,
  pill: 999,
} as const;

/**
 * The display face is **LHF OLD TOM**, the shop's own, licensed and supplied by
 * the shop. It is the face the badge is lettered in, so the type on the page
 * and the type on the mark are the same drawing rather than a near miss.
 *
 * Two of its five cuts are used, each where the shop uses it:
 *
 *   display      Old Tom Plain, the cut the badge's arched lettering is set in.
 *                Headings, prices, barber names, addresses, and every small
 *                capital label. It has a full lowercase and real figures.
 *   displayBold  Old Tom Poster Letter, the heavy poster cut. CAPITALS ONLY:
 *                lowercase in this cut renders as capitals, so it is used for
 *                the shop's name and nothing else.
 *
 * The other three (Spurred, Poster Full, Poster Highlights) are in
 * assets/fonts and are not loaded. Poster Full and Poster Highlights are the
 * layered pair: setting Letter in gold with Highlights over it in a lighter
 * gold gives the inline poster look. The badge does not use it, so neither
 * does the site.
 *
 * Outfit is the body face: a geometric sans with open, round shapes, matched to
 * the shop's own printed material. Running prose, the navigation and anything
 * typed into a form stay on it, because a Victorian display face is for signage
 * and not for paragraphs.
 */
export const font = {
  display: 'OldTom',
  displayBold: 'OldTomPoster',
  body: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
} as const;

/**
 * Type scale. Stay on it.
 *
 * Old Tom is condensed and its capitals are tall, so display sizes buy more
 * words per line than the face they replaced and the leading has to come in to
 * match. `display` below carries the tracking and leading that go with it.
 */
export const size = {
  micro: 12,
  caption: 15,
  body: 17,
  lead: 20,
  h4: 24,
  h3: 34,
  h2: 44,
  h1: 64,
  /** The shop name on the front page, and nothing else. */
  wordmark: 150,
} as const;

/**
 * Optical correction for the display face.
 *
 * Old Tom's capitals are exactly as tall as Outfit's, cap height 71 against 70
 * at the same point size, but an 'H' is 46.8 units wide against 70.6: the face
 * is a third narrower. So at a matched size it covers much less of the line and
 * reads as small type rather than as a different typeface, which is why the
 * barber names on the price list looked shrunken next to their own captions.
 *
 * Everything set in the display face is scaled by this. It is an optical
 * correction, not a change to the scale: the numbers in `size` still mean what
 * they meant, and body copy is untouched.
 *
 * Measured in a browser with `measureText`, not guessed. Re-measure if the face
 * changes, and set this to 1 for a face of normal width.
 */
export const DISPLAY_SCALE = 1.3;

/** A size from the scale, corrected for the display face. */
export const dsize = (n: number) => Math.round(n * DISPLAY_SCALE);

/** Everything set in the display face at heading size takes these with it. */
export const display = {
  fontFamily: font.display,
  // Old Tom is drawn condensed and already tightly fitted. The negative
  // tracking the previous face wanted closes its counters up here.
  letterSpacing: 0,
  lineHeight: 1.12,
} as const;

/**
 * Anything typed into a form on the web must be at least 16px, or mobile Safari
 * zooms the page the moment the field takes focus and never zooms back.
 */
export const INPUT_FONT_SIZE = 16;

/**
 * Uppercase letterspaced labels: "OPENING HOURS", "FIND US AT", "EST 1999".
 *
 * These are signage, not interface text, so they take the display face. Old Tom
 * capitals at this size read cleanly as long as they are letterspaced, which
 * they are: it is the same treatment as the arched lettering on the badge.
 */
export const label = {
  fontFamily: font.display,
  // Not the full display correction: these are capitals, which fill a line far
  // better than mixed case does, so they need less of a bump than a heading.
  fontSize: size.body,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
} as const;

/**
 * The same thing one step down: a caption attached to something else rather
 * than a heading of its own. "SENIOR BARBER", "SKIN FADE +£5", "TELEPHONE".
 *
 * These used to be 9 and 10 point Outfit, which was already the smallest type
 * in the product and became the smallest by a distance once everything around
 * them went up. One token now, so they cannot drift apart again.
 */
export const labelSmall = {
  fontFamily: font.display,
  fontSize: size.caption,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
} as const;

/**
 * The measure.
 *
 * 720 was right when every screen was a column of text. With a photograph and a
 * two column front page it reads as cramped on a desktop, so the container is
 * wider and the prose blocks carry their own maxWidth instead. Running text
 * still lands near 65 characters; only the layout got room.
 */
export const maxContentWidth = 1040;

/** Smallest comfortable tap target. Nothing pressable may be shorter. */
export const TAP = 44;
