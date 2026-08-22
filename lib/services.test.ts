/**
 * The part of the app that has to survive the shop changing.
 *
 * Every test here answers the same question: if Schedulista's list changes
 * overnight — a barber joins, a barber leaves, a service nobody has seen before
 * appears — does the app rearrange itself correctly, or does it need a developer?
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  barberNames,
  bookingSubtitle,
  categorise,
  chairsPhrase,
  cheapest,
  classify,
  featured,
  headlinePrice,
  listNames,
  money,
  priceRange,
  type Provider,
  type ServicesDoc,
} from './services.ts';

/* ------------------------------------------------------------------ */
/* fixtures — a barber we have never met                               */
/* ------------------------------------------------------------------ */

let nextId = 9000;

function service(name: string, priceGBP: number | null) {
  const id = String(nextId++);
  return {
    id,
    name,
    priceGBP,
    priceLabel: priceGBP === null ? '' : money(priceGBP),
    note: null,
    description: '',
    bookingUrl: `https://example.test/?service_id=${id}`,
  };
}

function barber(name: string, names: Array<[string, number | null]>): Provider {
  return {
    id: `p-${name}`,
    name,
    role: 'Barber',
    services: names.map(([label, price]) => service(label, price)),
  };
}

function doc(...providers: Provider[]): ServicesDoc {
  return { fetchedAt: '2026-08-22T09:00:00Z', source: 'https://example.test/', providers };
}

const SAM = barber('Sam', [
  ["Men's Haircut", 26],
  ['Skin Fade', 30],
  ['Beard Trim', 14],
  ['Haircut & Beard', 36],
  ['Hot Towel Shave', 22],
  ['Head Massage', 12],
]);

/* ------------------------------------------------------------------ */
/* grouping without a single line of configuration                     */
/* ------------------------------------------------------------------ */

test('a service groups itself from its name, so a new barber is never "More"', () => {
  assert.equal(classify("Men's Haircut"), 'Haircuts');
  assert.equal(classify('Skin Fade'), 'Haircuts');
  assert.equal(classify('Buzz Cut'), 'Haircuts');
  assert.equal(classify('Beard Trim'), 'Beard');
  assert.equal(classify('Hot Towel Shave'), 'Beard');

  // The combination has to win over both halves of itself.
  assert.equal(classify('Haircut & Beard'), 'Haircut & Beard');
  assert.equal(classify('Buzz Cut & Beard Buzz'), 'Haircut & Beard');

  // "Head Massage" is not a haircut — a loose rule used to file it as one.
  assert.equal(classify('Head Massage'), 'Extras');

  // Nothing recognisable still lands somewhere sensible rather than vanishing.
  assert.equal(classify('Gift Voucher'), 'More');
});

test('a brand-new barber is grouped and ordered with no override anywhere', () => {
  const groups = categorise(SAM);
  const names = groups.map((group) => group.name);

  assert.deepEqual(names, ['Haircuts', 'Beard', 'Haircut & Beard', 'Extras']);
  // Within a group, the barber's own order in Schedulista survives.
  assert.deepEqual(
    groups[0].services.map((s) => s.name),
    ["Men's Haircut", 'Skin Fade']
  );
  // Every service is accounted for; none is dropped on the floor.
  assert.equal(groups.reduce((n, g) => n + g.services.length, 0), SAM.services.length);
});

/* ------------------------------------------------------------------ */
/* the front page rearranges itself                                    */
/* ------------------------------------------------------------------ */

test('every barber reaches the front page, however many there are', () => {
  const ben = barber('Ben', [
    ["Men's Haircut", 24],
    ['Beard Trim', 12],
  ]);

  const picks = featured(doc(SAM, ben), 4);
  const who = new Set(picks.map((pick) => pick.provider.name));

  assert.equal(picks.length, 4);
  assert.deepEqual([...who].sort(), ['Ben', 'Sam']);
  // The haircut leads for each of them — not whatever happened to be first.
  assert.equal(picks[0].service.name, "Men's Haircut");
  assert.equal(picks[1].service.name, "Men's Haircut");
});

test('a barber with fewer services than the others does not stall the list', () => {
  const solo = barber('Ali', [['Buzz Cut', 15]]);
  const picks = featured(doc(SAM, solo), 4);

  assert.equal(picks.length, 4);
  assert.equal(picks.filter((p) => p.provider.name === 'Ali').length, 1);
});

test('asking for more than the shop offers stops rather than looping forever', () => {
  const tiny = barber('Ali', [['Buzz Cut', 15]]);
  assert.equal(featured(doc(tiny), 10).length, 1);
  assert.equal(featured(doc(), 4).length, 0);
});

/* ------------------------------------------------------------------ */
/* sentences that must not name anybody                                */
/* ------------------------------------------------------------------ */

test('copy about the shop counts the chairs rather than assuming two', () => {
  const one = doc(SAM);
  const three = doc(SAM, barber('Ben', [['Cut', 20]]), barber('Ali', [['Cut', 18]]));

  assert.equal(chairsPhrase(one), 'One chair');
  assert.equal(chairsPhrase(three), 'Three chairs');

  assert.equal(barberNames(one), 'Sam');
  assert.equal(barberNames(three), 'Sam, Ben and Ali');
  assert.equal(listNames([]), '');

  assert.match(bookingSubtitle(one), /^Sam’s chair · /);
  assert.match(bookingSubtitle(three), /^Three barbers · /);
});

/* ------------------------------------------------------------------ */
/* prices                                                              */
/* ------------------------------------------------------------------ */

test('prices read the way a barbershop board reads', () => {
  assert.equal(money(18), '£18');
  assert.equal(money(51.5), '£51.50');
  assert.equal(cheapest(SAM), 12);
  assert.equal(cheapest(barber('Ali', [['Voucher', null]])), null);
  assert.equal(priceRange(doc(SAM)), '£12 to £36');
  // One price everywhere is a price, not a range.
  assert.equal(priceRange(doc(barber('Ali', [['Cut', 20]]))), '£20');
  assert.equal(priceRange(doc()), '');
});

test('the headline price is the haircut, because that is what people compare', () => {
  assert.equal(headlinePrice(SAM), 'Haircut £26');
  // No haircut at all — fall back to the cheapest rather than saying nothing.
  assert.equal(headlinePrice(barber('Ali', [['Beard Trim', 14]])), 'from £14');
  assert.equal(headlinePrice(barber('Ali', [['Voucher', null]])), '');
});
