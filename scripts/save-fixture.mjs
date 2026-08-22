/**
 * Refreshes fixtures/schedulista.html — the frozen copy of the scheduler page
 * that sync-services.test.mjs asserts against. Run it deliberately, never in CI:
 * the whole point is that the fixture lags the live page so the test notices
 * when Schedulista changes their markup.
 *
 *   node scripts/save-fixture.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { SRC } from './sync-services.mjs';

const html = await fetch(SRC, {
  headers: { 'user-agent': 'PerrinsBarbershopSite/1.0 (+https://perrinsbarbers.co.uk)' },
}).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`Schedulista ${r.status}`))));

mkdirSync('fixtures', { recursive: true });
writeFileSync('fixtures/schedulista.html', html);
console.log(`Saved fixtures/schedulista.html (${html.length} bytes)`);
