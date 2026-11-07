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

// Break: a switch to Opening keeps the story point's fields (valid_source?, scenes.ex:149-156: the
// compile refuses a start with any other key), or the trigger chooser is missing from a modal scene.
test('a modal scene switched to Opening writes exactly start: true', async () => {
  const page = await open({ selection: { kind: 'scene', key: 'letter_ash' } });
  const file = join(dir, 'showcase/scenes/letter_ash.json');
  const before = readFileSync(file, 'utf8');
  const on = () => JSON.parse(readFileSync(file, 'utf8')).on;
  try {
    const kind = page.getByLabel('scene card').getByLabel('on', { exact: true });
    await kind.waitFor({ timeout: boot });
    await kind.selectOption('start');
    for (let t = 0; !on().start && t < 50; t++) await page.waitForTimeout(100);
    assert.deepEqual(on(), { start: true });
  } finally {
    writeFileSync(file, before); // the other tests' showcase has no opening
    await page.close();
  }
});

// Break: a switch to a quest writes a key outside the compiled quests or no outcome (valid_source?,
// scenes.ex:149-156), or a typed quest outcome never reaches the file (Enter, blur).
test('a modal scene switched to a quest writes its key and completed, then the typed outcome', async () => {
  const page = await open({ selection: { kind: 'scene', key: 'letter_ash' } });
  const file = join(dir, 'showcase/scenes/letter_ash.json');
  const before = readFileSync(file, 'utf8');
  const on = () => JSON.parse(readFileSync(file, 'utf8')).on;
  const until = async (outcome: string) => {
    for (let t = 0; on().outcome !== outcome && t < 50; t++) await page.waitForTimeout(100);
  };
  try {
    const card = page.getByLabel('scene card');
    await card.getByLabel('on', { exact: true }).waitFor({ timeout: boot });
    await card.getByLabel('on', { exact: true }).selectOption('quest');
    await until('completed');
    assert.deepEqual(on(), { quest: 'bounty', outcome: 'completed' });
    await card.getByLabel('outcome', { exact: true }).fill('delivered');
    await card.getByLabel('outcome', { exact: true }).press('Enter');
    await until('delivered');
    assert.deepEqual(on(), { quest: 'bounty', outcome: 'delivered' });
  } finally {
    writeFileSync(file, before);
    await page.close();
  }
});
