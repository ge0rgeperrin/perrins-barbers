/**
 * Fails the build if a long dash reaches a customer.
 *
 * The em dash and the en dash are the loudest tell that a page was written by a
 * machine, and this project had 60-odd of them. They are banned from anything a
 * customer can read: owner content, screen copy, legal documents, page titles.
 *
 * Comments are exempt. They are for whoever maintains this, not for the shop's
 * customers, and stripping them would only make the code worse. A line ending
 * in `dash-ok` is exempt too, which is how the Schedulista parser is allowed to
 * keep matching the en dashes that appear in the shop's own service labels.
 *
 *   npm run check:dashes
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DASH = /[–—]/;
const ROOTS = ['app', 'components', 'lib', 'server', 'content'];
const SKIP = /node_modules|\.expo|dist|\.test\.|fixtures/;
const CODE = new Set(['.ts', '.tsx', '.mjs', '.js']);

/** Strip // and /* *\/ comments so a note to a developer never fails the check. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (whole, lead) => lead + ' '.repeat(whole.length - lead.length));
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (SKIP.test(path)) continue;
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const offences = [];

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const ext = extname(path);
    if (ext !== '.json' && !CODE.has(ext)) continue;

    const raw = readFileSync(path, 'utf8');
    const source = raw.split('\n');
    const text = (ext === '.json' ? raw : stripComments(raw)).split('\n');

    text.forEach((line, i) => {
      // The marker is read off the original line, because the comment carrying
      // it has already been blanked out by the time we look at the code.
      if (source[i].includes('dash-ok')) return;
      if (DASH.test(line)) offences.push(`${path}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
}

if (offences.length) {
  console.error(`\nLong dashes reaching a customer (${offences.length}):\n`);
  for (const offence of offences) console.error('  ' + offence);
  console.error('\nUse a full stop, a comma, a colon, brackets, or a plain hyphen.\n');
  process.exit(1);
}

console.log('No long dashes in anything a customer can read.');
