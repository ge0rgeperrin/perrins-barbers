/**
 * Reading the shop's own scheduler page and turning it into our service list.
 *
 * This is the single parser. The nightly sync script uses it to write
 * services.json into the build, and the /api/services route uses it at runtime
 * so a change made in Schedulista reaches the site and the app within minutes
 * instead of waiting for the next deploy. One parser means the build-time list
 * and the live list can never disagree about what a service is called.
 *
 * Deliberately regex, not a DOM library: this module is imported by an Expo
 * Router API route, so it has to bundle for the server runtime, and the markup
 * it reads is server-rendered Rails output with a fixed, simple shape.
 */
export type ParsedService = {
  id: string;
  name: string;
  priceGBP: number | null;
  priceLabel: string;
  note: string | null;
  description: string;
  bookingUrl: string;
};

export type ParsedProvider = {
  id: string;
  name: string;
  role: string;
  services: ParsedService[];
};

export const SRC = 'https://perrins1.schedulista.com/';
const UA = 'PerrinsBarbershopSite/1.0 (+https://perrinsbarbers.co.uk)';

/* ------------------------------------------------------------------ */
/* text                                                                */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  pound: '£',
  '#39': "'",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    const key = name.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number(key.slice(1)));
    return whole;
  });
}

/** Strip tags, decode entities, collapse whitespace, normalise apostrophes. */
export function clean(html: string): string {
  return decode(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* labels                                                              */
/* ------------------------------------------------------------------ */

/** A parenthetical is a surcharge only if it quotes a price: "(Skin Fade +£4)". */
const SURCHARGE = /\+\s*£/;

/**
 * Split one link label into name / price / surcharge.
 *
 * The barbers type their services differently and both forms are live:
 *   "Under 14's Haircut - £23.50 (Skin Fade +£5)"
 *   "Men's Haircut (Skin Fade +£4) - £24"
 *
 * A parenthetical that is not a surcharge belongs to the name and must stay
 * there — "Beard Trim (Full Beard)" is a service, not a service plus an extra.
 */
export function splitLabel(label: string) {
  // Non-greedy name so a hyphen inside the name ("12 - 16's Haircut") survives.
  // The en dash here is not ours. Schedulista's own labels use one, so the
  // parser has to match it.
  const m = label.match(/^(.*?)\s*[-–]\s*£\s*([\d.]+)\s*(?:\((.+)\))?\s*$/); // dash-ok
  if (!m) return { name: label, priceGBP: null as number | null, priceLabel: '', note: null as string | null };

  let name = clean(m[1]);
  let note: string | null = null;

  if (m[3]) {
    if (SURCHARGE.test(m[3])) note = clean(m[3]);
    else name = `${name} (${clean(m[3])})`; // part of the name, put it back
  }

  if (!note) {
    const trailing = name.match(/^(.*?)\s*\(([^()]*\+\s*£[^()]*)\)$/);
    if (trailing) {
      name = clean(trailing[1]);
      note = clean(trailing[2]);
    }
  }

  return { name, priceGBP: Number(m[2]), priceLabel: `£${m[2]}`, note };
}

/* ------------------------------------------------------------------ */
/* the page                                                            */
/* ------------------------------------------------------------------ */

/**
 * The whole element containing `marker`, found by balancing div tags from the
 * opening tag that carries it. Cheaper and far less brittle than guessing where
 * the list ends from the markup that follows it.
 */
function elementAround(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at < 0) return '';
  const open = html.lastIndexOf('<div', at);
  if (open < 0) return '';

  const tags = /<\/?div\b/g;
  tags.lastIndex = open;
  let depth = 0;
  let tag: RegExpExecArray | null;
  while ((tag = tags.exec(html))) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(open, tag.index);
  }
  return html.slice(open);
}

const SERVICE_ROW =
  /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*(?:<dd\b[^>]*service-description[^>]*>([\s\S]*?)<\/dd>)?/gi;
const LINK = /<a\b[^>]*class=["'][^"']*widget-nav[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i;

/**
 * The scheduler renders services server-side as a flat run of `h3` provider
 * headings, each followed by a `dl` of that provider's services.
 */
export function parseScheduler(html: string): { source: string; providers: ParsedProvider[] } {
  const section = elementAround(html, 'services-list');
  const providers: ParsedProvider[] = [];

  // Everything before the first heading is chrome, so the first piece is dropped.
  const chunks = section.split(/<h3\b[^>]*>/i).slice(1);

  for (const chunk of chunks) {
    const end = chunk.indexOf('</h3>');
    if (end < 0) continue;

    // "Senior Barber - David" -> role "Senior Barber", name "David"
    // Same again: their heading separator, not our punctuation.
    const [first, second] = clean(chunk.slice(0, end)).split(/\s+[-–]\s+/); // dash-ok
    const provider: ParsedProvider = {
      id: '',
      name: second ?? first,
      role: second ? first : '',
      services: [],
    };

    SERVICE_ROW.lastIndex = 0;
    let row: RegExpExecArray | null;
    while ((row = SERVICE_ROW.exec(chunk))) {
      const link = row[1].match(LINK);
      if (!link) continue;

      const url = new URL(decode(link[1]));
      const serviceId = url.searchParams.get('service_id');
      if (!serviceId) continue;

      provider.id ||= url.searchParams.get('provider_id') ?? '';
      provider.services.push({
        id: serviceId,
        ...splitLabel(clean(link[2])),
        description: clean(row[2] ?? ''),
        bookingUrl: url.toString(),
      });
    }

    if (provider.id && provider.services.length) providers.push(provider);
  }

  return { source: SRC, providers };
}

/**
 * Refuse to publish a list that looks like a failed parse rather than a real
 * change. A barber leaving is a legitimate one-provider day; a page that
 * suddenly parses to nothing is not.
 */
export function assertSane(providers: ParsedProvider[]): number {
  const total = providers.reduce((n, p) => n + p.services.length, 0);
  if (providers.length < 1 || total < 5 || providers.some((p) => !p.services.length)) {
    throw new Error(
      `Parse looks wrong: ${providers.length} providers / ${total} services. Refusing to use it.`
    );
  }
  const missing = providers.flatMap((p) => p.services).find((s) => !s.id);
  if (missing) throw new Error(`Service without an id: ${missing.name}`);
  return total;
}

/* ------------------------------------------------------------------ */
/* the live list                                                       */
/* ------------------------------------------------------------------ */

export type Catalog = { fetchedAt: string; source: string; providers: ParsedProvider[] };

/**
 * How long a fetched list is served before we look again. Long enough that a
 * busy Saturday is a handful of requests upstream; short enough that a barber
 * added at nine is bookable before ten.
 */
const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;

let cached: { at: number; value: Catalog } | null = null;
let inFlight: Promise<Catalog> | null = null;

async function read(): Promise<Catalog> {
  const res = await fetch(SRC, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Schedulista returned ${res.status}`);

  const { providers } = parseScheduler(await res.text());
  assertSane(providers);
  return { fetchedAt: new Date().toISOString(), source: SRC, providers };
}

/**
 * The current list, from cache when it is fresh.
 *
 * A failure is never allowed to blank the shop: the last good answer is served
 * past its expiry for as long as the scheduler stays down, and only a cold start
 * that also fails will throw. Concurrent callers share one fetch.
 */
export async function liveCatalog(): Promise<{ catalog: Catalog; stale: boolean }> {
  if (cached && Date.now() - cached.at < TTL_MS) return { catalog: cached.value, stale: false };

  inFlight ??= read()
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  try {
    return { catalog: await inFlight, stale: false };
  } catch (error) {
    if (cached) return { catalog: cached.value, stale: true };
    throw error;
  }
}
