// A card's add menu in a browser (split from panel.test.ts, size): what the panel holds back from a
// write, on harness.ts's Vite + bin/loka dev server pair and Chrome (its own boot). A new check: a
// test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    await page
      .getByRole('menuitem')
      .filter({ has: page.getByText('edible', { exact: true }) })
      .click();
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

const defs = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../schemas/source/defs.schema.json'), 'utf8'),
).$defs;

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
    const edible = page
      .getByRole('menuitem')
      .filter({ has: page.getByText('edible', { exact: true }) });
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
    const sanctuary = page
      .getByRole('menuitem')
      .filter({ has: page.getByText('sanctuary', { exact: true }) });
    const about = defs['source.RoomDefinition'].properties.sanctuary.description;
    assert.equal(await sanctuary.locator('span').nth(1).textContent(), about);
  } finally {
    await page.close();
  }
});

// Break: a field the registry holds vanishes from the Add menu when the cartridge lacks its capability,
// so the author sees no option and no reason and hunts the docs (loka-wfrgk.94, the day-one symptom:
// daily_schedule, room details and schedule cases alike). The showcase lacks `emote`, so a room's
// `ambient` is refused for a capability the author can declare, and it must say which.
test("the Mechanics menu greys a refused field and names the capability to declare", async () => {
  const page = await open({ right: 420, selection: { kind: 'room', key: 'fell_top' } });
  try {
    const add = page.getByLabel('Mechanics').getByLabel('Add a field');
    await add.waitFor({ timeout: boot });
    await add.click();
    const ambient = page
      .getByRole('menuitem')
      .filter({ has: page.getByText('ambient', { exact: true }) });
    await ambient.waitFor({ timeout: boot });
    // greyed, and not clickable: picking it must not write a field the compiler refuses
    assert.equal(await ambient.getAttribute('aria-disabled'), 'true');
    assert.match((await ambient.textContent()) ?? '', /needs emote in cartridge\.json/);
    // a field the cartridge does allow stays addable, so the list did not merely go all-grey
    const variants = page
      .getByRole('menuitem')
      .filter({ has: page.getByText('dark', { exact: true }) });
    assert.notEqual(await variants.getAttribute('aria-disabled'), 'true');
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

// Break (loka-wfrgk.100.5.2): a cut's page button the route refuses is offered (the `---` move,
// scene_structure.ts), a page op writes more than its lines, or the header's Undo does not revert it.
test("a modal scene's cut pages move by their buttons and one Undo restores the bytes", async () => {
  const json = join(dir, 'showcase/scenes/letter_ash.json');
  const cut = join(dir, 'showcase/scenes/letter_ash.cut');
  const before = readFileSync(json, 'utf8');
  const { steps: _, ...pages } = JSON.parse(before); // a twin's steps would replace the cut's pages
  writeFileSync(json, JSON.stringify(pages, null, 2) + '\n');
  writeFileSync(cut, 'One.\n\nTwo.\n---\n');
  const page = await open({ selection: { kind: 'scene', key: 'letter_ash' } });
  const until = async (bytes: string) => {
    for (let t = 0; readFileSync(cut, 'utf8') !== bytes && t < 50; t++)
      await page.waitForTimeout(100);
    assert.equal(readFileSync(cut, 'utf8'), bytes);
  };
  try {
    const card = page.getByLabel('scene card');
    await card.getByLabel('Move down page 1').waitFor({ timeout: boot });
    assert.ok(await card.getByLabel('Move down page 2').isDisabled()); // `---` stays last
    assert.ok(await card.getByLabel('Move up page 1').isDisabled());
    await card.getByLabel('Move down page 1').click();
    await until('Two.\n\nOne.\n---\n');
    await card.getByRole('button', { name: 'Undo' }).click();
    await until('One.\n\nTwo.\n---\n');
  } finally {
    writeFileSync(json, before);
    rmSync(cut, { force: true });
    await page.close();
  }
});

// Break (loka-wfrgk.90): a blur's write waits a tick, and a zero tick fired under the first keystroke
// of the field clicked into next: the walk's `21` written first as `2`, then `21` by the next blur —
// two writes for one edit, and Undo left on the half-typed `2`. Typed with the focus moved into the
// next field in the same task as the blur, which a slowed main thread does on its own.
test("a blur and the next field's first keystroke write the settled value once", async () => {
  const page = await open({ right: 420, selection: { kind: 'npc', key: 'hob' } });
  const file = join(dir, 'showcase/areas/hub/npcs/hob.json');
  const was = readFileSync(file, 'utf8');
  const writes: unknown[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/__author/change')) writes.push(r.postDataJSON()?.ops);
  });
  try {
    const from = page.locator('#root_name_variants_0_when_from');
    const to = page.locator('#root_name_variants_0_when_to');
    await from.waitFor({ timeout: boot });
    await from.click();
    await page.evaluate(() => {
      // the next field takes the focus (the blur) and types its first key before that tick runs
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      const next = document.querySelector<HTMLInputElement>('#root_name_variants_0_when_to')!;
      next.focus();
      set.call(next, '2');
      next.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await to.pressSequentially('1', { delay: 120 });
    await page.getByRole('tab').first().click(); // out of the card: its last blur writes
    for (let t = 0; !writes.length && t < 50; t++) await page.waitForTimeout(100);
    await page.waitForTimeout(1000); // a second, half-typed write would have landed by now
    assert.deepEqual(writes, [[{ path: ['name_variants', 0, 'when', 'to'], value: 21 }]]);
  } finally {
    writeFileSync(file, was);
    await page.close();
  }
});
