/**
 * The booking proxy's pure logic. Nothing here touches the network — the live
 * contract with Schedulista is checked separately by scripts/canary-booking.mjs.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seal, unseal, SealExpired, SealInvalid, HOLD_TTL_MS } from './seal.ts';
import { assertSane, parseScheduler } from './catalog.ts';
import {
  absorbCookies,
  assertKnownPair,
  assertWithinHorizon,
  compact,
  dateRange,
  daysBetween,
  isValidDate,
  MONTHS_AHEAD,
  SchedulistaError,
} from './schedulista.ts';

/* ------------------------------------------------------------------ */
/* seal                                                                */
/* ------------------------------------------------------------------ */

const HOLD = {
  cookie: '_schedulista_session=abc123; XSRF-TOKEN=def456',
  token: 'a-csrf-token',
  serviceId: '1074623634',
  providerId: '1074010081',
  date: '20260825',
  time: '2026-08-25T09:00:00+0100',
};

test('a sealed hold survives a round trip', () => {
  const opened = unseal<typeof HOLD>(seal(HOLD));
  assert.equal(opened.cookie, HOLD.cookie);
  assert.equal(opened.token, HOLD.token);
  assert.equal(opened.time, HOLD.time);
});

test('the session cookie is not readable in the sealed blob', () => {
  const blob = seal(HOLD);
  assert.ok(!blob.includes('schedulista_session'));
  assert.ok(!blob.includes('a-csrf-token'));
  // base64url only — safe in a JSON body and a URL alike.
  assert.match(blob, /^[A-Za-z0-9_-]+$/);
});

test('a tampered blob is rejected, not silently accepted', () => {
  const blob = seal(HOLD);
  const flipped =
    blob.slice(0, -2) + (blob.slice(-2, -1) === 'A' ? 'B' : 'A') + blob.slice(-1);
  assert.throws(() => unseal(flipped), SealInvalid);
  assert.throws(() => unseal('not-a-seal'), SealInvalid);
  assert.throws(() => unseal(''), SealInvalid);
});

test('a hold expires', () => {
  const issued = 1_000_000;
  const blob = seal(HOLD, issued);
  assert.doesNotThrow(() => unseal(blob, issued + HOLD_TTL_MS - 1));
  assert.throws(() => unseal(blob, issued + HOLD_TTL_MS + 1), SealExpired);
});

/* ------------------------------------------------------------------ */
/* cookies                                                             */
/* ------------------------------------------------------------------ */

function fakeResponse(cookies: string[]): Response {
  const headers = new Headers();
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { headers });
}

test('Set-Cookie headers merge into one Cookie value', () => {
  const first = absorbCookies(
    '',
    fakeResponse([
      '_schedulista_session=one; path=/; HttpOnly; SameSite=Lax',
      'XSRF-TOKEN=two; path=/; SameSite=Lax',
    ])
  );
  assert.equal(first, '_schedulista_session=one; XSRF-TOKEN=two');

  // A later response replacing one cookie must not duplicate it.
  const second = absorbCookies(first, fakeResponse(['_schedulista_session=three; path=/']));
  assert.equal(second, '_schedulista_session=three; XSRF-TOKEN=two');
});

test('a response with no cookies leaves the jar alone', () => {
  assert.equal(absorbCookies('a=1', fakeResponse([])), 'a=1');
});

/* ------------------------------------------------------------------ */
/* dates                                                               */
/* ------------------------------------------------------------------ */

test('dates convert to the format Schedulista wants', () => {
  assert.equal(compact('2026-08-25'), '20260825');
});

test('bad dates are rejected before they reach Schedulista', () => {
  assert.ok(isValidDate('2026-08-25'));
  assert.ok(!isValidDate('25-08-2026'));
  assert.ok(!isValidDate('2026-8-5'));
  assert.ok(!isValidDate('2026-13-01'));
  assert.ok(!isValidDate(''));
});

test('a date range walks forward one day at a time, across a month end', () => {
  const range = dateRange(new Date('2026-08-30T23:30:00Z'), 4);
  assert.deepEqual(range, ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
});

test('a date range crosses the BST boundary without losing or repeating a day', () => {
  // Clocks go back at 02:00 local on 25 October 2026.
  const range = dateRange(new Date('2026-10-24T12:00:00Z'), 3);
  assert.deepEqual(range, ['2026-10-24', '2026-10-25', '2026-10-26']);
});

test('a month of dates comes back inclusive of both ends', () => {
  assert.equal(daysBetween('2026-08-01', '2026-08-31').length, 31);
  assert.equal(daysBetween('2028-02-01', '2028-02-29').length, 29); // leap year
  assert.deepEqual(daysBetween('2026-08-30', '2026-09-01'), [
    '2026-08-30',
    '2026-08-31',
    '2026-09-01',
  ]);
  assert.deepEqual(daysBetween('2026-08-22', '2026-08-22'), ['2026-08-22']);
});

test('a backwards or unparseable range asks for nothing rather than everything', () => {
  assert.deepEqual(daysBetween('2026-08-31', '2026-08-01'), []);
  assert.deepEqual(daysBetween('nonsense', '2026-08-01'), []);
});

/* ------------------------------------------------------------------ */
/* whitelist                                                           */
/* ------------------------------------------------------------------ */

// Note: an *unknown* pair falls through to the live scheduler before it is
// refused, so this one test does touch the network — a read of a public page,
// and a failure there still ends in a refusal, so it cannot go green wrongly.
test('the proxy only books this shop’s own barber and service pairs', async () => {
  // David + Men's Haircut, straight off the live scheduler.
  const known = await assertKnownPair('1074010081', '1074623634');
  assert.equal(known.provider, 'David');
  assert.equal(known.service, "Men's Haircut");

  // Ben's id with David's service — a real pair of ids, an invalid combination.
  await assert.rejects(() => assertKnownPair('1074024184', '1074623634'), SchedulistaError);
  // Another business entirely.
  await assert.rejects(() => assertKnownPair('999', '888'), SchedulistaError);
  await assert.rejects(() => assertKnownPair('', ''), SchedulistaError);
});

/* ------------------------------------------------------------------ */

test('the booking horizon is enforced on the server, not just in the calendar', () => {
  const inRange = new Date();
  inRange.setUTCDate(inRange.getUTCDate() + 7);
  assertWithinHorizon(inRange.toISOString().slice(0, 10));

  const tooFar = new Date();
  tooFar.setUTCMonth(tooFar.getUTCMonth() + MONTHS_AHEAD + 2);
  assert.throws(() => assertWithinHorizon(tooFar.toISOString().slice(0, 10)), SchedulistaError);

  const longPast = new Date();
  longPast.setUTCDate(longPast.getUTCDate() - 30);
  assert.throws(() => assertWithinHorizon(longPast.toISOString().slice(0, 10)), SchedulistaError);
});

/* ------------------------------------------------------------------ */

test('the scheduler page parses without a DOM library, barbers and all', () => {
  const html = readFileSync('fixtures/schedulista.html', 'utf8');
  const { providers } = parseScheduler(html);

  assert.equal(providers.length, 2);
  assert.equal(providers[0].name, 'David');
  assert.equal(providers[0].role, 'Senior Barber');
  assert.equal(providers[0].id, '1074010081');

  const haircut = providers[0].services[0];
  assert.equal(haircut.name, "Men's Haircut");
  assert.equal(haircut.priceGBP, 38.5);
  assert.equal(haircut.id, '1074623634');

  // "Haircut &amp; Full Beard" — the entity has to survive the parse.
  assert.ok(providers[0].services.some((s) => s.name === 'Haircut & Full Beard'));

  // Every service on the page, and nothing from outside the services list.
  const total = providers.reduce((n, p) => n + p.services.length, 0);
  assert.equal(total, 20);
  assert.equal(assertSane(providers), 20);
});

test('a page that did not parse is refused rather than published', () => {
  assert.throws(() => assertSane([]), /Parse looks wrong/);
  assert.throws(() => assertSane(parseScheduler('<html><body>nothing</body></html>').providers), /Parse looks wrong/);
});
