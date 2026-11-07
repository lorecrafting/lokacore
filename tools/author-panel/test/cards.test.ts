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
    await page.getByLabel('item card').getByLabel('Add a field').click();
    await page.getByRole('menuitem').filter({ has: page.getByText('edible', { exact: true }) }).click();
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

const defs = JSON.parse(readFileSync(join(import.meta.dirname, '../../../schemas/source/defs.schema.json'), 'utf8')).$defs;

// Break (loka-wfrgk.102 B): the Add menu shows bare field names, the author cannot tell what `edible`
// does; or the menu is reachable only by mouse (Enter opens it, arrows and Enter pick).
test("an Add menu option shows its field's description and is picked by keyboard", async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  const file = join(dir, 'showcase/areas/fell_road/items/lute.json');
  const before = readFileSync(file, 'utf8');
  try {
    const add = page.getByLabel('item card').getByLabel('Add a field');
    await add.waitFor({ timeout: boot });
    await add.focus();
    await page.keyboard.press('Enter');
    const edible = page.getByRole('menuitem').filter({ has: page.getByText('edible', { exact: true }) });
    const about = defs['source.ItemDefinition'].properties.edible.description; // the schema's own words
    assert.equal(await edible.locator('span').nth(1).textContent(), about);
    await page.keyboard.type('edible'); // typeahead by name; Radix moves the focus a tick later
    await edible.and(page.locator(':focus')).waitFor();
    await page.keyboard.press('Enter');
    await page.locator('[id^="root_edible"]').first().waitFor({ timeout: boot }); // revealed
  } finally {
    writeFileSync(file, before);
    await page.close();
  }
});

// Break (loka-wfrgk.102 B): a list item hides its description (FieldTemplate's array-item guard); the
// lute's one keyword is an Alias, whose schema description must show under it.
test('a list item shows its description', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  try {
    const keyword = page.locator('#root_keywords_0');
    await keyword.waitFor({ timeout: boot });
    const shown = page.locator('#root_keywords_0__description');
    assert.equal(await shown.textContent(), defs.Alias.description);
    assert.ok(await shown.isVisible());
  } finally {
    await page.close();
  }
});

// Break: a switch to Opening keeps the story point's key (valid_source?, scenes.ex:149-156: the
// compile refuses a start with a second kind key), or the trigger chooser is missing from a modal scene.
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
    assert.equal(await page.getByLabel('on start').count(), 0); // Opening has no key to pick
  } finally {
    writeFileSync(file, before); // the other tests' showcase has no opening
    await page.close();
  }
});

// Break (loka-wfrgk.102 B): the room card's Mechanics menu drops the descriptions the generic menu shows.
test("the room's Mechanics menu shows each option's description", async () => {
  const page = await open({ right: 420, selection: { kind: 'room', key: 'fell_top' } });
  try {
    const add = page.getByLabel('Mechanics').getByLabel('Add a field');
    await add.waitFor({ timeout: boot });
    await add.click();
    const sanctuary = page.getByRole('menuitem').filter({ has: page.getByText('sanctuary', { exact: true }) });
    const about = defs['source.RoomDefinition'].properties.sanctuary.description;
    assert.equal(await sanctuary.locator('span').nth(1).textContent(), about);
  } finally {
    await page.close();
  }
});

// Break: a switch to a quest writes a key outside the compiled quests or no outcome (valid_source?,
// scenes.ex:149-156), picking another quest writes the old one, or a typed quest outcome never
// reaches the file (Enter, blur), or another scene's quest and outcome (letter_read's, scenes.ex:274-292)
// or a non-Key is not marked refused.
test('a modal scene switched to a quest writes its key and completed, then the picked quest and typed outcome', async () => {
  const read = join(dir, 'showcase/scenes/letter_read.json');
  const readBefore = readFileSync(read, 'utf8');
  const taken = { ...JSON.parse(readBefore), on: { quest: 'carry_letter', outcome: 'read' } };
  writeFileSync(read, JSON.stringify(taken, null, 2) + '\n');
  const page = await open({ selection: { kind: 'scene', key: 'letter_ash' } });
  const file = join(dir, 'showcase/scenes/letter_ash.json');
  const before = readFileSync(file, 'utf8');
  const on = () => JSON.parse(readFileSync(file, 'utf8')).on;
  const until = async (field: string, value: string) => {
    for (let t = 0; on()[field] !== value && t < 50; t++) await page.waitForTimeout(100);
  };
  try {
    const card = page.getByLabel('scene card');
    await card.getByLabel('on', { exact: true }).waitFor({ timeout: boot });
    await card.getByLabel('on', { exact: true }).selectOption('quest');
    await until('outcome', 'completed');
    assert.deepEqual(on(), { quest: 'bounty', outcome: 'completed' });
    await card.getByLabel('on quest').selectOption('carry_letter');
    await until('quest', 'carry_letter');
    assert.deepEqual(on(), { quest: 'carry_letter', outcome: 'completed' });
    await card.getByLabel('outcome', { exact: true }).fill('delivered');
    await card.getByLabel('outcome', { exact: true }).press('Enter');
    await until('outcome', 'delivered');
    assert.deepEqual(on(), { quest: 'carry_letter', outcome: 'delivered' });
    const outcome = card.getByLabel('outcome', { exact: true });
    assert.equal(await outcome.getAttribute('aria-invalid'), 'false');
    for (const typed of ['read', 'Bad Key']) {
      await outcome.fill(typed);
      assert.equal(await outcome.getAttribute('aria-invalid'), 'true', typed);
    }
  } finally {
    writeFileSync(read, readBefore);
    writeFileSync(file, before);
    await page.close();
  }
});
