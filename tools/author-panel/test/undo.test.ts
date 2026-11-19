// A card's Undo in a browser (split from panel.test.ts, size): what it does to the draft a card
// holds, on harness.ts's Vite + bin/loka dev server pair and Chrome (its own boot). A new check: a
// test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { boot, dir, fill, open } from './harness.ts';

// Breaks: Undo throws the held draft away before POST /undo answers, so a 409 (the file changed since
// that write) loses the author's edit with nothing written (loka-wfrgk.89).
test('a refused Undo keeps the held draft and says why', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'oilskin' } });
  const field = page.locator('#root_mass_grams');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const refusal = page.getByText('mass_grams must be >= 0'); // the held line, not rjsf's own
  await field.waitFor({ timeout: boot });
  await fill(field, '600');
  await field.blur();
  for (let t = 0; (await undo.isDisabled()) && t < 50; t++) await page.waitForTimeout(100);
  assert.equal(await undo.isDisabled(), false); // the write armed it
  await page.route('**/__author/undo', (r) => r.fulfill({ status: 409, json: 'Changed since: not undone.' }));
  await fill(field, '-1'); // a held draft this Undo must not eat
  await field.blur();
  await refusal.waitFor({ timeout: boot });
  await undo.click();
  await page.waitForTimeout(1500); // the 409 answered; the card has redrawn
  assert.equal(await field.inputValue(), '-1'); // the draft is still there to fix
  assert.equal(await refusal.count(), 1); // and so is what held it
  await page.close();
});

// Breaks: the undo resets the draft to the undone file when its answer lands, so an edit typed while
// it was in flight is erased and never sent (loka-wfrgk.89).
test('an edit typed while Undo is in flight survives it', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'oilskin' } });
  const file = join(dir, 'showcase/areas/fell_road/items/oilskin.json');
  const mass = () => JSON.parse(readFileSync(file, 'utf8')).mass_grams;
  const field = page.locator('#root_mass_grams');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const set = async (v: number) => (await fill(field, `${v}`), await field.blur());
  await field.waitFor({ timeout: boot });
  const was = mass(); // the file's value as this test finds it: the undo puts this back
  await set(was + 100);
  for (let t = 0; mass() !== was + 100 && t < 50; t++) await page.waitForTimeout(100);
  for (let t = 0; (await undo.isDisabled()) && t < 50; t++) await page.waitForTimeout(100);
  assert.equal(await undo.isDisabled(), false); // the write armed it
  await page.route('**/__author/undo', async (r) => (await page.waitForTimeout(1200), await r.continue()));
  await undo.click(); // held at the server, unanswered
  await set(was + 200); // typed and blurred while it waits
  await page.waitForTimeout(3000); // the undo answered, wrote, and reloaded
  for (let t = 0; mass() !== was + 200 && t < 50; t++) await page.waitForTimeout(100);
  assert.equal(mass(), was + 200); // the edit typed meanwhile was sent, not erased by the reload that raced it
  assert.equal(await field.inputValue(), `${was + 200}`);
  await page.close();
});
