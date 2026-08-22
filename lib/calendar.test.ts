/**
 * Calendar arithmetic. A month grid that is one column out, or a leap February
 * that loses a day, is the kind of bug nobody notices until someone books the
 * wrong Tuesday — so the awkward months are pinned down here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  daysInMonth,
  longDate,
  monthBounds,
  monthGrid,
  monthLabel,
  monthOf,
  monthsApart,
  shortDate,
  weekdayOf,
} from './calendar.ts';

test('months roll over the year end in both directions', () => {
  assert.equal(addMonths('2026-08', 1), '2026-09');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-08', 12), '2027-08');
  assert.equal(addMonths('2026-08', -12), '2025-08');
});

test('the distance between two months counts whole months', () => {
  assert.equal(monthsApart('2026-08', '2026-08'), 0);
  assert.equal(monthsApart('2026-08', '2027-08'), 12);
  assert.equal(monthsApart('2026-08', '2026-07'), -1);
});

test('month lengths, including a leap February', () => {
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2028-02'), 29); // leap year
  assert.equal(daysInMonth('2026-04'), 30);
  assert.equal(daysInMonth('2026-12'), 31);
});

test('month bounds cover the whole month', () => {
  assert.deepEqual(monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthBounds('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(monthBounds('2026-08'), { from: '2026-08-01', to: '2026-08-31' });
});

test('the grid is Monday-first and every date lands in the right column', () => {
  // 1 August 2026 is a Saturday, so it belongs in column 5 of the first row.
  const august = monthGrid('2026-08');
  assert.deepEqual(august[0], [null, null, null, null, null, '2026-08-01', '2026-08-02']);

  // 22 August 2026 is a Saturday: column 5 again.
  const row = august.find((week) => week.includes('2026-08-22'))!;
  assert.equal(row.indexOf('2026-08-22'), 5);
});

test('a month starting on Monday needs no leading gap', () => {
  // 1 June 2026 is a Monday.
  assert.equal(monthGrid('2026-06')[0][0], '2026-06-01');
});

test('every grid is whole weeks and holds every day exactly once', () => {
  for (const month of ['2026-02', '2028-02', '2026-08', '2026-11', '2027-01']) {
    const grid = monthGrid(month);
    assert.ok(grid.every((week) => week.length === 7), `${month} has a ragged week`);
    const dates = grid.flat().filter(Boolean);
    assert.equal(dates.length, daysInMonth(month), `${month} lost or gained a day`);
    assert.equal(new Set(dates).size, dates.length, `${month} repeats a date`);
  }
});

test('weekdays are read in UTC, so no timezone can shift them', () => {
  assert.equal(weekdayOf('2026-08-22'), 6); // Saturday
  assert.equal(weekdayOf('2026-08-24'), 1); // Monday — the shop is closed
});

test('dates read the way a person would say them', () => {
  assert.equal(monthOf('2026-08-22'), '2026-08');
  assert.equal(monthLabel('2026-08'), 'August 2026');
  assert.equal(longDate('2026-08-22'), 'Saturday, 22 August');
  assert.equal(shortDate('2026-08-22'), 'Sat 22 Aug');
});
