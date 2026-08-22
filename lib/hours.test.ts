/**
 * The open/closed chip is the one thing on the home screen that can be
 * confidently, visibly wrong, so the logic behind it is pinned down here.
 *
 *   npm test
 *
 * Run by Node's type stripping — no build step, no test framework.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWeek, isBST, londonNow, openState, toMinutes, type DayHours } from './hours.ts';

// Mon–Sat 09:00–17:00, Sunday 10:00–16:00 — the shop's pattern.
const WEEK: DayHours[] = [
  { day: 0, opens: '10:00', closes: '16:00' },
  { day: 1, opens: '09:00', closes: '17:00' },
  { day: 2, opens: '09:00', closes: '17:00' },
  { day: 3, opens: '09:00', closes: '17:00' },
  { day: 4, opens: '09:00', closes: '17:00' },
  { day: 5, opens: '09:00', closes: '17:00' },
  { day: 6, opens: '09:00', closes: '17:00' },
];

const utc = (iso: string) => new Date(iso);

test('toMinutes parses and rejects', () => {
  assert.equal(toMinutes('09:00'), 540);
  assert.equal(toMinutes('17:30'), 1050);
  assert.equal(toMinutes('9:05'), 545);
  assert.equal(toMinutes('25:00'), null);
  assert.equal(toMinutes('nine'), null);
});

test('BST starts and ends on the last Sunday, 01:00 UTC', () => {
  assert.equal(isBST(utc('2026-03-29T00:59:00Z')), false);
  assert.equal(isBST(utc('2026-03-29T01:00:00Z')), true);
  assert.equal(isBST(utc('2026-10-25T00:59:00Z')), true);
  assert.equal(isBST(utc('2026-10-25T01:00:00Z')), false);
  assert.equal(isBST(utc('2026-01-15T12:00:00Z')), false);
});

test('London wall-clock time shifts with BST', () => {
  // Midsummer: 08:30 UTC is 09:30 in Hertford.
  assert.equal(londonNow(utc('2026-06-15T08:30:00Z')).minutes, 9 * 60 + 30);
  // Midwinter: 08:30 UTC is 08:30 in Hertford.
  assert.equal(londonNow(utc('2026-01-15T08:30:00Z')).minutes, 8 * 60 + 30);
});

test('open through the working day, closed either side of it', () => {
  // Monday 15 June 2026. BST, so subtract an hour to get UTC.
  const monday = (hhmm: string) => utc(`2026-06-15T${hhmm}:00Z`);

  assert.equal(openState(WEEK, [], monday('07:59')).open, false); // 08:59 local
  assert.equal(openState(WEEK, [], monday('08:00')).open, true); // 09:00 local
  assert.equal(openState(WEEK, [], monday('15:59')).open, true); // 16:59 local
  assert.equal(openState(WEEK, [], monday('16:00')).open, false); // 17:00 local
});

test('closing time is reported', () => {
  const state = openState(WEEK, [], utc('2026-06-15T10:00:00Z'));
  assert.equal(state.open, true);
  assert.equal(state.open && state.closesAt, '17:00');
});

test('before opening, it says when it opens today', () => {
  const state = openState(WEEK, [], utc('2026-06-15T06:00:00Z')); // 07:00 local
  assert.equal(state.open, false);
  assert.equal(state.open === false && state.opensLabel, 'opens 09:00');
});

test('after closing, it points at tomorrow', () => {
  const state = openState(WEEK, [], utc('2026-06-15T18:00:00Z')); // Mon 19:00 local
  assert.equal(state.open === false && state.opensLabel, 'opens tomorrow 09:00');
});

test('a closed day is skipped when looking ahead', () => {
  const closedTuesday = WEEK.map((d) => (d.day === 2 ? { ...d, closed: true } : d));
  const state = openState(closedTuesday, [], utc('2026-06-15T18:00:00Z')); // Mon evening
  assert.equal(state.open === false && state.opensLabel, 'opens Wed 09:00');
});

test('a holiday closes the day and is named', () => {
  const holidays = [{ date: '2026-06-15', label: 'Closed — staff training' }];
  const state = openState(WEEK, holidays, utc('2026-06-15T10:00:00Z'));
  assert.equal(state.open, false);
  assert.equal(state.open === false && state.reason, 'Closed — staff training');
  assert.equal(state.open === false && state.opensLabel, 'opens tomorrow 09:00');
});

test('every day closed is reported rather than looping forever', () => {
  const shut = WEEK.map((d) => ({ ...d, closed: true }));
  const state = openState(shut, [], utc('2026-06-15T10:00:00Z'));
  assert.equal(state.open, false);
  assert.equal(state.open === false && state.opensLabel, null);
});

/* ------------------------------------------------------------------ */
/* the sentence about the week                                         */
/* ------------------------------------------------------------------ */

test('the week describes itself, so the prose cannot contradict the table', () => {
  // The shop's real week: closed Monday, late Wed and Fri, early Saturday.
  const real: DayHours[] = [
    { day: 0, opens: '10:00', closes: '14:00' },
    { day: 1, opens: '', closes: '', closed: true },
    { day: 2, opens: '09:00', closes: '18:00' },
    { day: 3, opens: '09:00', closes: '20:00' },
    { day: 4, opens: '09:00', closes: '18:00' },
    { day: 5, opens: '09:00', closes: '20:00' },
    { day: 6, opens: '08:00', closes: '16:00' },
  ];

  assert.equal(
    describeWeek(real),
    'Late on Wednesdays and Fridays, early on Saturdays, closed Mondays.'
  );
});

test('a week with nothing to say about it says nothing', () => {
  const flat: DayHours[] = Array.from({ length: 7 }, (_, day) => ({
    day,
    opens: '09:00',
    closes: '17:00',
  }));
  assert.equal(describeWeek(flat), '');
  assert.equal(describeWeek([]), '');
});

test('a shop that changed its hours gets a changed sentence, with no edit', () => {
  const changed: DayHours[] = [
    { day: 0, opens: '', closes: '', closed: true },
    { day: 1, opens: '', closes: '', closed: true },
    { day: 2, opens: '09:00', closes: '17:00' },
    { day: 3, opens: '09:00', closes: '17:00' },
    { day: 4, opens: '09:00', closes: '21:00' },
    { day: 5, opens: '09:00', closes: '17:00' },
    { day: 6, opens: '09:00', closes: '17:00' },
  ];
  assert.equal(describeWeek(changed), 'Late on Thursdays, closed Sundays and Mondays.');
});
