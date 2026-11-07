// A card's add menu in a browser (split from panel.test.ts, size): what the panel holds back from a
// write, on harness.ts's Vite + bin/loka dev server pair and Chrome (its own boot). A new check: a
// test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { boot, dir, open } from './harness.ts';

// Break (loka-wfrgk.62, food.ex:21): the edible Add seeds goes out with the next blur's edit, and the
// compiler refuses food with no resource, cures or applies; the whole write is lost.
test('an added edible is held from the next write until it has an effect', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  const file = join(dir, 'showcase/areas/fell_road/items/lute.json');
  const before = readFileSync(file, 'utf8');
  const saved = () => JSON.parse(readFileSync(file, 'utf8'));
  try {
    const field = page.locator('#root_mass_grams');
    await field.waitFor({ timeout: boot });
    await page.getByLabel('item card').getByLabel('Add a field').selectOption('edible');
    await field.fill('777');
    await field.blur();
    await page.getByText('.edible needs a resource, cures or applies').waitFor({ timeout: boot });
    for (let t = 0; saved().mass_grams !== 777 && t < 50; t++) await page.waitForTimeout(100);
    assert.equal(saved().mass_grams, 777); // the rest of the edit is written
    assert.equal(saved().edible, undefined);
  } finally {
    writeFileSync(file, before);
    await page.close();
  }
});
