/**
 * Asserts the parser against fixtures/schedulista.html — a frozen copy of the
 * live scheduler page. This is the tripwire: when Schedulista changes their
 * markup, this fails in CI before a customer sees an empty price list.
 *
 *   npm test
 *
 * If it fails because Schedulista genuinely changed, fix the parser, then
 * refresh the fixture with `node scripts/save-fixture.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, assertSane, splitLabel } from './sync-services.mjs';

const html = readFileSync(new URL('../fixtures/schedulista.html', import.meta.url), 'utf8');
const { providers } = parse(html);
const services = providers.flatMap((p) => p.services);
const byName = (name) => services.find((s) => s.name === name);

test('both barbers and all their services are found', () => {
  assert.equal(providers.length, 2);
  assert.equal(services.length, 20);
  assert.deepEqual(
    providers.map((p) => [p.name, p.role, p.id]),
    [
      ['David', 'Senior Barber', '1074010081'],
      ['Ben', 'Barber', '1074024184'],
    ]
  );
});

test('prices parse as numbers', () => {
  assert.equal(providers[0].services[0].name, "Men's Haircut");
  assert.equal(providers[0].services[0].priceGBP, 38.5);
  assert.equal(providers[1].services[0].name, "Men's Haircut");
  assert.equal(providers[1].services[0].priceGBP, 24);
  assert.ok(services.every((s) => typeof s.priceGBP === 'number' && s.priceGBP > 0));
});

test('surcharge notes are split out of the name, in both label formats', () => {
  // David: "Under 14's Haircut - £23.50 (Skin Fade +£5)"
  assert.equal(byName("Under 14's Haircut")?.note, 'Skin Fade +£5');
  // Ben: "Men's Haircut (Skin Fade +£4) - £24"
  assert.equal(providers[1].services[0].note, 'Skin Fade +£4');
  // A hyphen inside the name must survive the split.
  assert.ok(byName("12 - 16's Haircut"), 'expected "12 - 16\'s Haircut" to keep its hyphen');
});

test('a non-surcharge parenthetical stays part of the name', () => {
  assert.ok(byName('Beard Trim (Full Beard)'), 'expected "Beard Trim (Full Beard)" intact');
  assert.equal(byName('Beard Trim (Full Beard)').note, null);
});

test('typographic apostrophes are normalised', () => {
  assert.ok(services.every((s) => !s.name.includes('’')));
});

test('every service carries a usable deep link', () => {
  for (const p of providers) {
    for (const s of p.services) {
      const url = new URL(s.bookingUrl);
      assert.equal(url.pathname, '/schedule/perrins1/choose_time');
      assert.equal(url.searchParams.get('provider_id'), p.id);
      assert.equal(url.searchParams.get('service_id'), s.id);
    }
  }
});

test('guardrails reject a parse that came back thin', () => {
  assert.equal(assertSane(providers), 20);
  assert.throws(() => assertSane([]), /Parse looks wrong/);
  assert.throws(() => assertSane([{ name: 'X', services: [] }]), /Parse looks wrong/);
});

test('splitLabel handles a label with no price at all', () => {
  assert.deepEqual(splitLabel('Consultation'), {
    name: 'Consultation',
    priceGBP: null,
    priceLabel: '',
    note: null,
  });
});
