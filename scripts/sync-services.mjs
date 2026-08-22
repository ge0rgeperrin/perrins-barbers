/**
 * Reads the public Schedulista scheduler for Perrin's Barber Shop and writes
 * services.json into the build. Run by .github/workflows/sync-services.yml three
 * times a day, and by `npm run sync` locally.
 *
 * The parsing itself lives in server/catalog.ts, because the running site parses
 * the same page at request time to stay current between deploys. Two parsers
 * would eventually disagree about what a service is called; there is one.
 *
 * Schedulista is the source of truth for service names, prices, which barber
 * offers what, and who the barbers are. Nothing in this repo may hard-code any
 * of it.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertSane, parseScheduler, splitLabel, SRC } from '../server/catalog.ts';

const OUT = 'public/services.json';
const MIRROR = 'assets/services.json';
const UA = 'PerrinsBarbershopSite/1.0 (+https://perrinsbarbers.co.uk)';

// Re-exported so the tests, and anyone reaching for the script, get the same
// functions the server uses rather than a second copy.
export { assertSane, splitLabel, SRC };
export const parse = parseScheduler;

function logDiff(prev, next) {
  const index = (doc) =>
    new Map(
      (doc?.providers ?? []).flatMap((p) =>
        p.services.map((s) => [s.id, `${p.name} / ${s.name} ${s.priceLabel}`])
      )
    );
  const before = index(prev);
  const after = index(next);

  const barbersBefore = new Set((prev?.providers ?? []).map((p) => p.name));
  const barbersAfter = new Set(next.providers.map((p) => p.name));
  for (const name of barbersAfter) if (!barbersBefore.has(name)) console.log(`+ BARBER   ${name}`);
  for (const name of barbersBefore) if (!barbersAfter.has(name)) console.log(`- BARBER   ${name}`);

  for (const [id, label] of after) {
    if (!before.has(id)) console.log(`+ added    ${label}`);
    else if (before.get(id) !== label) console.log(`~ changed  ${before.get(id)} -> ${label}`);
  }
  for (const [id, label] of before) {
    if (!after.has(id)) console.log(`- removed  ${label}`);
  }
}

function readIfPresent(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function write(path, doc) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}

async function main() {
  const res = await fetch(SRC, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Schedulista returned ${res.status}`);

  const { providers } = parseScheduler(await res.text());
  const total = assertSane(providers);

  const next = { fetchedAt: new Date().toISOString(), source: SRC, providers };
  logDiff(readIfPresent(OUT), next);

  write(OUT, next);
  write(MIRROR, next); // bundled with the app build so the first paint has data
  console.log(`\nWrote ${providers.length} providers / ${total} services to ${OUT}`);
}

// Only fetch when run directly; importing this file (tests) must not hit the network.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
