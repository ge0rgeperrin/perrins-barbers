/**
 * Puts the Worker entry where wrangler.toml expects it.
 *
 * `find_additional_modules` names every module it finds relative to `base_dir`,
 * which is `dist`, and the entry imports `./server/...`. So the entry has to sit
 * at dist/index.mjs rather than in worker/. `expo export` empties dist, so this
 * runs after it, not once.
 */
import { copyFileSync } from 'node:fs';

copyFileSync('worker/index.mjs', 'dist/index.mjs');
console.log('copied worker/index.mjs -> dist/index.mjs');
