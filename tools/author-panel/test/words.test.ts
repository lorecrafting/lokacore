// A card's words field in a browser (split from panel.test.ts, size): a words row edited in place
// through GET /line and POST /edit, as the Book's field (fields.tsx WordsField), on harness.ts's
// Vite + bin/loka dev server pair and Chrome (its own boot). Its Book frame is empty: every line is
// off the Book's page. A new check: a test() here naming its break, with a red control.
// bin/mutate_diff.sh runs this file for every panel .tsx line, by this marker: mutate-covers: src
import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Locator, Page } from 'playwright';
import { author, dir, open } from './harness.ts';

const TEXT = join(dir, 'showcase/text.json');
const FELL_TOP = 'Open moor under a wide, quiet sky. A hut stands east, a brewhouse west; the shelter is south.';
const RAIN = 'Open moor under the sky. Rain sheets across the heather; only an oilskin keeps it out. A hut stands east, a brewhouse west; the shelter is south.';

/** The page's POSTs to /edit and /open, as sent. */
function sent(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => void (/\/__author\/(edit|open)$/.test(r.url()) && urls.push(r.url())));
  return urls;
}
async function until(done: () => boolean) {
  for (let t = 0; !done() && t < 50; t++) await new Promise((r) => setTimeout(r, 100));
}
/** The field once GET /line has answered: the file's words. */
async function shows(field: Locator, words: string) {
  for (let t = 0; (await field.inputValue()) !== words && t < 50; t++) await field.page().waitForTimeout(100);
  assert.equal(await field.inputValue(), words);
}
const room = { right: 420, selection: { kind: 'room', key: 'fell_top' } };

// Breaks: Esc still writes on the blur after it; the room's description written to another line, or
// written only by opening it in the Book (POST /open, off the Book's page here).
test('a room card writes its description line in place, off the Book page; Esc writes nothing', async () => {
  const before = readFileSync(TEXT, 'utf8');
  const page = await open(room);
  const posts = sent(page);
  try {
    const field = page.getByTitle('room.fell_top.description');
    await shows(field, FELL_TOP);
    await field.fill('~');
    await field.press('Escape');
    await field.blur();
    await page.waitForTimeout(300);
    assert.equal(await field.inputValue(), FELL_TOP);
    assert.equal(posts.length, 0);
    assert.equal(readFileSync(TEXT, 'utf8'), before);
    await field.fill('~');
    await field.blur();
    await until(() => readFileSync(TEXT, 'utf8') !== before);
    const want = before.replace(`"room.fell_top.description": "${FELL_TOP}"`, '"room.fell_top.description": "~"');
    assert.notEqual(want, before);
    assert.equal(readFileSync(TEXT, 'utf8'), want);
    assert.deepEqual(posts.map((u) => u.slice(u.lastIndexOf('/'))), ['/edit']); // never /open
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: a keystroke commits (one /edit per key), or Enter's save and the blur after it send two.
test("the generic card's words commit once, on Enter, never per keystroke", async () => {
  const before = readFileSync(TEXT, 'utf8');
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  const posts = sent(page);
  try {
    const field = page.getByLabel('name words');
    await field.click();
    await shows(field, 'a lute');
    await field.selectText();
    await field.pressSequentially('~'); // one keystroke
    await page.waitForTimeout(300);
    assert.equal(posts.length, 0);
    await field.press('Enter');
    await field.blur();
    await until(() => readFileSync(TEXT, 'utf8') !== before);
    await page.waitForTimeout(300);
    assert.equal(posts.length, 1);
    assert.equal(
      readFileSync(TEXT, 'utf8'),
      before.replace('"item.lute.short": "a lute"', '"item.lute.short": "~"'),
    );
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: words typed while a save is out are lost (its re-read writes the saved line over them).
test('the field is read-only while its save is out', async () => {
  const before = readFileSync(TEXT, 'utf8');
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/__author/edit', async (r) => (await held, r.continue()), { times: 1 });
  try {
    const field = page.getByLabel('name words');
    await shows(field, 'a lute');
    await field.fill('~');
    await field.press('Enter'); // its /edit held
    await page.waitForTimeout(100);
    assert.equal(await field.isEditable(), false);
    release();
    await until(() => readFileSync(TEXT, 'utf8') !== before);
    await shows(field, '~');
    for (let t = 0; !(await field.isEditable()) && t < 50; t++) await page.waitForTimeout(100);
    assert.equal(await field.isEditable(), true);
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: POST /edit's `was` guard bypassed (a fresh read's `was` sent, or none), so an outside save
// is overwritten; or a refused save drops the author's draft; or Keep mine on a draft equal to theirs
// leaves the conflict shown.
test('a line changed on disk since the card read it is refused and the draft kept', async () => {
  const before = readFileSync(TEXT, 'utf8');
  const page = await open(room);
  try {
    const field = page.getByTitle('room.fell_top.description');
    await shows(field, FELL_TOP);
    await field.fill('~');
    const theirs = before.replace(`"room.fell_top.description": "${FELL_TOP}"`, `"room.fell_top.description": "${RAIN}"`);
    writeFileSync(TEXT, theirs);
    await field.blur();
    await page.getByText(`Changed on disk since you opened it. ${RAIN}`).waitFor();
    assert.equal(await field.inputValue(), '~');
    assert.equal(readFileSync(TEXT, 'utf8'), theirs);
    await field.fill(RAIN); // mine now equals theirs: Keep mine has nothing to write and takes theirs
    await page.getByRole('button', { name: 'Keep mine' }).click();
    await page.getByText('Changed on disk since you opened it.', { exact: false }).waitFor({ state: 'detached' });
    assert.equal(readFileSync(TEXT, 'utf8'), theirs);
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: a refused GET /line taken as the line, so the field opens on no words and saves a bad `was`.
test('a line the server cannot find leaves the field shut and says why', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  const nowhere = JSON.stringify('No line for this key.');
  await page.route('**/__author/line?*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: nowhere }));
  try {
    await page.reload(); // the first GET /line answered before the route
    await page.getByText('No line for this key.').first().waitFor();
    assert.equal(await page.getByLabel('name words').isDisabled(), true);
  } finally {
    await page.close();
  }
});

// Last: it switches the world. Breaks: a `.scene` words line written to another line, or its `* `
// lost (Scene.tsx's words hint, prose.ts edit).
test("a scene card writes its words line in place", async () => {
  const file = join(dir, 'identity_sampler/scenes/stranger_talk.scene');
  const before = readFileSync(file, 'utf8');
  const world = { method: 'POST', body: JSON.stringify({ name: 'identity_sampler' }) };
  assert.equal((await fetch(`http://localhost:${author}/world`, world)).status, 200);
  const page = await open({ selection: { kind: 'dialogue', key: 'stranger_talk' } }, 'line 1 npc');
  try {
    const field = page.getByLabel('scene card').locator('input[aria-label$=" words"]').first();
    await shows(field, 'The stranger waits.');
    const mtime = statSync(file).mtimeMs;
    await field.fill('~');
    await field.press('Enter');
    await until(() => statSync(file).mtimeMs !== mtime);
    assert.equal(readFileSync(file, 'utf8'), before.replace('\n* The stranger waits.\n', '\n* ~\n'));
  } finally {
    writeFileSync(file, before);
    await page.close();
  }
});
