/**
 * Service and price data. Schedulista is the only source of truth; this module
 * never invents, edits or caches a price.
 *
 * IT ALSO NEVER HARD-CODES A BARBER. Everything the screens need — how many
 * chairs there are, what to call them in a sentence, which prices to feature,
 * how the list is grouped — is worked out from whatever Schedulista is offering
 * right now. Add a barber in Schedulista and they appear, grouped and priced,
 * with no edit here. Remove one and every trace of them goes with them.
 *
 * The bundled copy in assets/services.json is written by scripts/sync-services.mjs
 * at build time so the first paint has real data. The app then re-fetches
 * SERVICES_URL, which reads the live scheduler, so a change made in Schedulista
 * shows up within minutes without a rebuild. Nothing is written to disk: the app
 * deliberately has no offline store, so a device with no connection gets the
 * waiting screen, not stale prices.
 */
import bundled from '../assets/services.json' with { type: 'json' };
import content from '../content/content.json' with { type: 'json' };
import { layout } from './content.ts';
import { apiOrigin } from './site.ts';

/**
 * Our own API route, which re-reads the scheduler on a short cache. Relative in
 * a browser, absolute on a phone. See lib/site.ts.
 */
export const SERVICES_URL = `${apiOrigin(typeof window !== 'undefined' && !!window.location)}/api/services`;

export type Service = {
  id: string;
  name: string;
  priceGBP: number | null;
  priceLabel: string;
  note: string | null;
  description: string;
  bookingUrl: string;
};

export type Provider = {
  id: string;
  name: string;
  role: string;
  services: Service[];
};

export type ServicesDoc = {
  fetchedAt: string;
  source: string;
  providers: Provider[];
};

export type Override = {
  category?: string;
  order?: number;
  featured?: boolean;
  hidden?: boolean;
  blurb?: string;
};

const overrides = content.serviceOverrides as Record<string, Override>;
const categoryOrder = content.categoryOrder as string[];

export const bundledServices = bundled as ServicesDoc;

/** The scheduler's own front page — the fallback when our flow cannot finish. */
export const BOOKING_HOME = bundledServices.source;

export function overrideFor(serviceId: string): Override {
  return overrides[serviceId] ?? {};
}

export type Category = { name: string; services: Service[] };

/* ------------------------------------------------------------------ */
/* grouping, worked out from the name                                  */
/* ------------------------------------------------------------------ */

/**
 * Which group a service belongs in, read off its name.
 *
 * This exists so the price list organises itself. The alternative — a hand-kept
 * list of service ids — was what shipped first, and it had one fatal property:
 * a barber added in Schedulista arrives with ids nobody has ever seen, so every
 * one of their services fell into "More" and the new chair looked broken until
 * someone edited a JSON file. Names are the only thing we know about a service
 * we have never met, so names are what we group on.
 *
 * Order matters: "Haircut & Beard" has to be tested before either half of it.
 */
const RULES: Array<{ category: string; test: RegExp }> = [
  { category: 'Haircut & Beard', test: /(hair)?cut.*(beard|shave)|(beard|shave).*(hair)?cut|combo|full works/i },
  { category: 'Beard', test: /beard|shave|moustache|mustache|tash/i },
  // Deliberately not "head": "Head Massage" is not a haircut, and a loose rule
  // that quietly files one service wrongly is worse than one that files it under
  // Extras, where a customer will still find it.
  { category: 'Haircuts', test: /haircut|hair cut|\bcut\b|fade|clipper|buzz|crop|trim|shape.?up|line.?up/i },
  { category: 'Colour', test: /colou?r|dye|bleach|highlight|tint|perm/i },
  { category: 'Extras', test: /wash|treatment|wax|thread|facial|massage|brow|nose|ear/i },
];

/** Services that match nothing still show, at the end, under this heading. */
const FALLBACK_CATEGORY = 'More';

export function classify(serviceName: string): string {
  return RULES.find((rule) => rule.test.test(serviceName))?.category ?? FALLBACK_CATEGORY;
}

/** The owners' choice wins; otherwise the name decides. */
export function categoryOf(service: Service): string {
  return overrideFor(service.id).category ?? classify(service.name);
}

/**
 * Group one barber's services for the price list: hidden ones dropped, the rest
 * bucketed and sorted.
 *
 * Within a group the barber's own order in Schedulista is kept. They arranged
 * that list; second-guessing it with a price sort would put the cheapest tidy-up
 * above the cut the shop is known for.
 */
export function categorise(provider: Provider): Category[] {
  const position = new Map(provider.services.map((service, index) => [service.id, index]));
  const buckets = new Map<string, Service[]>();

  for (const service of provider.services) {
    if (overrideFor(service.id).hidden) continue;
    const name = categoryOf(service);
    const bucket = buckets.get(name);
    if (bucket) bucket.push(service);
    else buckets.set(name, [service]);
  }

  const rank = (name: string) => {
    const i = categoryOrder.indexOf(name);
    return i === -1 ? categoryOrder.length : i;
  };

  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, services]) => ({
      name,
      services: services.sort(
        (a, b) =>
          (overrideFor(a.id).order ?? 99) - (overrideFor(b.id).order ?? 99) ||
          (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)
      ),
    }));
}

/* ------------------------------------------------------------------ */
/* what to put on the front                                            */
/* ------------------------------------------------------------------ */

const visible = (service: Service) => !overrideFor(service.id).hidden;

/**
 * One barber's services in the order they best represent that barber: the cut
 * first, then the beard work, then everything else in their own order. Used to
 * decide what reaches the home screen when nobody has picked by hand.
 */
function signatureOrder(provider: Provider): Service[] {
  const weight = (service: Service) => {
    const category = categoryOf(service);
    if (category === 'Haircuts') return 0;
    if (category === 'Beard') return 1;
    if (category === 'Haircut & Beard') return 2;
    return 3;
  };
  return provider.services
    .filter(visible)
    .map((service, index) => ({ service, index }))
    .sort((a, b) => weight(a.service) - weight(b.service) || a.index - b.index)
    .map((entry) => entry.service);
}

/**
 * The handful of prices worth showing on the home screen, each with the barber
 * who charges it — booking needs both, and two barbers rarely charge the same.
 *
 * If the owners have marked anything `featured` by hand, that is the list. If
 * they have not — which is the normal state, and the state a brand-new barber
 * always arrives in — one signature service is taken from each barber in turn,
 * so every chair in the shop is represented on the front page and no barber can
 * be silently left off it.
 */
export function featured(
  doc: ServicesDoc,
  limit = layout.featuredCount
): Array<{ provider: Provider; service: Service }> {
  const picked = doc.providers.flatMap((provider) =>
    provider.services.filter((s) => visible(s) && overrideFor(s.id).featured).map((service) => ({ provider, service }))
  );
  if (picked.length) return picked.slice(0, limit);

  const queues = doc.providers.map((provider) => ({ provider, services: signatureOrder(provider) }));
  const out: Array<{ provider: Provider; service: Service }> = [];

  for (let round = 0; out.length < limit; round++) {
    // Every barber has had everything they offer taken — stop rather than loop.
    if (queues.every((queue) => round >= queue.services.length)) break;
    for (const queue of queues) {
      const service = queue.services[round];
      if (service && out.length < limit) out.push({ provider: queue.provider, service });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* prices                                                              */
/* ------------------------------------------------------------------ */

/** "£18" but "£51.50" — pence only when there are pence, the way a board reads. */
export function money(amount: number): string {
  return Number.isInteger(amount) ? `£${amount}` : `£${amount.toFixed(2)}`;
}

function prices(services: Service[]): number[] {
  return services
    .filter(visible)
    .map((service) => service.priceGBP)
    .filter((price): price is number => typeof price === 'number' && price > 0);
}

/** The lowest price this barber charges, or null if none of them carry one. */
export function cheapest(provider: Provider): number | null {
  const found = prices(provider.services);
  return found.length ? Math.min(...found) : null;
}

export function priceRange(doc: ServicesDoc): string {
  const found = prices(doc.providers.flatMap((p) => p.services));
  if (!found.length) return '';
  const low = Math.min(...found);
  const high = Math.max(...found);
  return low === high ? money(low) : `${money(low)} to ${money(high)}`;
}

/**
 * The headline price for a barber. "from £10" is true of everyone and tells
 * nobody anything — the number people actually compare is the standard haircut.
 */
export function headlinePrice(provider: Provider): string {
  const cut = signatureOrder(provider).find(
    (service) => categoryOf(service) === 'Haircuts' && service.priceLabel
  );
  if (cut) return `Haircut ${cut.priceLabel}`;
  const from = cheapest(provider);
  return from === null ? '' : `from ${money(from)}`;
}

/* ------------------------------------------------------------------ */
/* sentences about the shop, built from the shop                       */
/* ------------------------------------------------------------------ */

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

/** 3 -> "three", 12 -> "12". Written numbers read better up to about eight. */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

const capitalise = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** ["David","Ben","Sam"] -> "David, Ben and Sam" */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function barberNames(doc: ServicesDoc): string {
  return listNames(doc.providers.map((provider) => provider.name));
}

/** "Two chairs" / "One chair" — the count comes from the diary, not from a file. */
export function chairsPhrase(doc: ServicesDoc): string {
  const n = doc.providers.length;
  return `${capitalise(countWord(n))} chair${n === 1 ? '' : 's'}`;
}

/**
 * The line under the Book now button. Reads correctly for one barber, for two,
 * and for a shop that has just taken on a fourth.
 */
export function bookingSubtitle(doc: ServicesDoc): string {
  const range = priceRange(doc);
  const n = doc.providers.length;
  const who = n === 1 ? `${doc.providers[0].name}’s chair` : `${capitalise(countWord(n))} barbers`;
  return range ? `${who} · ${range}` : who;
}

/* ------------------------------------------------------------------ */

/**
 * Fetch the freshest price list. Throws on any failure — the caller keeps the
 * build-time snapshot rather than showing nothing.
 */
export async function fetchServices(signal?: AbortSignal): Promise<ServicesDoc> {
  const res = await fetch(`${SERVICES_URL}?t=${Date.now()}`, { signal });
  if (!res.ok) throw new Error(`services returned ${res.status}`);
  const doc = (await res.json()) as ServicesDoc;
  if (!doc?.providers?.length) throw new Error('services has no providers');
  return doc;
}
