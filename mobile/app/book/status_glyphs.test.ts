import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { glyphs } from './statusGlyphs.ts';

// Statuses never in the row (status-line-rulings.md, "Drawings"): a crop's or a hen's state, or
// one the player never wears.
const never = [
  'spoiling',
  'rot',
  'growing',
  'growing_croft',
  'withered',
  'ruin',
  'weathering',
  'hen_fed',
  'spent',
  'furious',
].map((n) => `condition.${n}`);

// Breaks: a cartridge status the row can show added without its drawing, so it falls back to a
// bare polarity sign (status-line-rulings.md; book-ui.md Conditions details).
test('every cartridge status the row can show has its own drawing', () => {
  const root = new URL('../../../', import.meta.url);
  const names = globSync('cartridges/**/statuses/*.json', { cwd: root }).map(
    (f) => JSON.parse(readFileSync(new URL(f, root), 'utf8')).name as string,
  );
  assert.ok(names.length > 40); // the glob found the cartridges
  const missing = [...new Set(names)].filter((n) => !never.includes(n) && !(n in glyphs));
  assert.deepEqual(missing, []);
});
