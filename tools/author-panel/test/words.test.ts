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
import { boot, dir, open, world as openWorld } from './harness.ts';

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
// the focused element's title, as a string: the test tsconfig has no DOM lib
const focused = `document.activeElement && document.activeElement.getAttribute('title')`;

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

// Break: a click into a bare `~` field puts the caret after it, so typing writes `~Cold`, which
// ships as written with a placeholder_tilde warning (loka-wfrgk.121); the Book's field selects it.
test('a click into an unwritten field and typing replaces the `~`', async () => {
  const before = readFileSync(TEXT, 'utf8');
  const unwritten = before.replace(`"room.fell_top.description": "${FELL_TOP}"`, '"room.fell_top.description": "~"');
  assert.notEqual(unwritten, before);
  writeFileSync(TEXT, unwritten);
  const page = await open(room);
  try {
    const field = page.getByTitle('room.fell_top.description');
    await shows(field, '~');
    await field.click();
    await field.pressSequentially('Cold');
    await field.blur();
    await until(() => readFileSync(TEXT, 'utf8') !== unwritten);
    assert.match(readFileSync(TEXT, 'utf8'), /"room\.fell_top\.description": "Cold"/);
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

// Breaks: an emptied field posts /edit (a blank line written) instead of refusing with the hint.
test('an emptied field is refused at the field and nothing is sent', async () => {
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } });
  const posts = sent(page);
  try {
    const field = page.getByLabel('name words');
    await shows(field, 'a lute');
    await field.fill('');
    await field.blur();
    await page.getByText('Empty. Write ~ to leave it unwritten.').waitFor();
    assert.equal(posts.length, 0);
    assert.equal(await field.inputValue(), '');
  } finally {
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

// Breaks: a JSON dialogue choice's label shown as its bare key with no words field (the stale
// ruling-11 refusal: a choice's key is fixed, its words free, owner 2026-11-06), its words written
// anywhere but its text.json line, or its narration loses its field.
test('a choice label and its narration each have a words field; the label writes its own line', async () => {
  const before = readFileSync(TEXT, 'utf8');
  const page = await open({ right: 420, selection: { kind: 'dialogue', key: 'aldous_talk' } });
  try {
    const bounty = page.locator('[aria-label="choice bounty"]');
    await bounty.locator('summary').click();
    const text = JSON.parse(before);
    await shows(bounty.getByLabel('narration words'), text['narration.aldous_talk.bounty']);
    const label = bounty.getByLabel('label words');
    await shows(label, text['dialogue.aldous_talk.bounty']);
    await label.fill('~');
    await label.blur();
    await until(() => readFileSync(TEXT, 'utf8') !== before);
    const want = before.replace(
      '"dialogue.aldous_talk.bounty": "Take the bounty on the raider"',
      '"dialogue.aldous_talk.bounty": "~"',
    );
    assert.notEqual(want, before);
    assert.equal(readFileSync(TEXT, 'utf8'), want);
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: a fetch that never answers taken as a line (an unhandled rejection, the field left shut with
// nothing said), or a shut field whose only way back is reopening the card. The dev server reboots on
// every write (`bin/loka dev --watch`), so this is the author's own case. The server stays down for the
// whole test: a remount re-reads `/line`, so a server that came back would open the field itself and
// the button would detach under the click.
test('a field whose read the server never answered says so and offers the read again', async () => {
  const asked: string[] = [];
  const page = await open({ right: 420, selection: { kind: 'item', key: 'lute' } }, 'Inspector', (p) =>
    p.route('**/__author/line?**', (r) => (asked.push(r.request().url()), r.abort())),
  );
  try {
    const field = page.getByLabel('name words');
    // every words field on this card says it: the first is enough
    const said = page.getByText('The server did not answer. Is it running?').first();
    await said.waitFor({ timeout: boot });
    assert.equal(await field.isEditable(), false);
    const reads = asked.length;
    await page.getByRole('button', { name: 'Try again' }).first().click();
    await until(() => asked.length > reads); // the button reads the line again, it does not just sit there
    assert.ok(asked.length > reads, 'Try again sends GET /line');
    assert.equal(await field.isEditable(), false);
  } finally {
    await page.close();
  }
});

// Last: it switches the world. Breaks: a `.scene` words line written to another line, or its `* `
// lost (Scene.tsx's words hint, prose.ts edit).
test("a scene card writes its words line in place", async () => {
  const file = join(dir, 'identity_sampler/scenes/stranger_talk.scene');
  const before = readFileSync(file, 'utf8');
  await openWorld('identity_sampler');
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

// Breaks: a 409 whose line was reworded on disk, or whose words the server no longer has, tells the
// field nothing to take, so Keep mine / Take theirs never renders and the draft is stranded.
test('a line reworded on disk offers Take theirs, with the words it now holds', async () => {
  const before = readFileSync(TEXT, 'utf8');
  await openWorld('showcase'); // the scene test above leaves the world on its own cartridge
  const page = await open(room);
  try {
    const field = page.getByTitle('room.fell_top.description');
    await shows(field, FELL_TOP);
    await field.fill('my own words');
    const theirs = before.replace(
      `"room.fell_top.description": "${FELL_TOP}"`,
      `"room.fell_top.description": "${RAIN}"`,
    );
    writeFileSync(TEXT, theirs);
    await field.blur();
    await page.getByText(`Changed on disk since you opened it. ${RAIN}`).waitFor();
    await page.getByRole('button', { name: 'Take theirs' }).click();
    await shows(field, RAIN); // their words in the field, their file still on disk
    assert.equal(readFileSync(TEXT, 'utf8'), theirs);
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: a 409 body without the line leaves the field saying only that it changed, and its draft
// with nowhere to go: the scene card's line has no key, so nothing can re-ask for it.
test('a scene line reworded on disk also offers Take theirs', async () => {
  const file = join(dir, 'identity_sampler/scenes/stranger_talk.scene');
  const before = readFileSync(file, 'utf8');
  await openWorld('identity_sampler');
  const page = await open({ selection: { kind: 'dialogue', key: 'stranger_talk' } }, 'line 1 npc');
  try {
    const at = page.getByLabel('scene card').locator('input[aria-label$=" words"]').first();
    await shows(at, 'The stranger waits.');
    // a row's key is its words until it has a key, so a reword moves the row: find it by its key
    const field = page.locator(`input[title="${await at.getAttribute('title')}"]`);
    await field.fill('my own words');
    writeFileSync(file, before.replace('* The stranger waits.', '* their words'));
    await field.blur();
    await page.getByText('Changed on disk since you opened it. their words').waitFor({ timeout: boot });
    await page.getByRole('button', { name: 'Take theirs' }).click();
    await shows(field, 'their words');
    assert.equal(readFileSync(file, 'utf8'), before.replace('* The stranger waits.', '* their words'));
  } finally {
    writeFileSync(file, before);
    await page.close();
  }
});

// Breaks: a words write drops the id POST /edit returned, so the card's Undo stays disabled and the
// author's only way back from a mistyped line is the external editor (loka-wfrgk.100.4's undo item).
test("a card's Undo puts back the words write it just made", async () => {
  const before = readFileSync(TEXT, 'utf8');
  await openWorld('showcase'); // the undo test above leaves the world on its own cartridge
  const page = await open(room);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  try {
    const field = page.getByTitle('room.fell_top.description');
    await shows(field, FELL_TOP);
    assert.equal(await undo.isDisabled(), true); // nothing written yet
    await field.fill('~');
    await field.blur();
    await until(() => readFileSync(TEXT, 'utf8') !== before);
    assert.notEqual(readFileSync(TEXT, 'utf8'), before);
    for (let t = 0; (await undo.isDisabled()) && t < 50; t++) await page.waitForTimeout(100);
    assert.equal(await undo.isDisabled(), false); // the words write armed it
    await undo.click();
    await until(() => readFileSync(TEXT, 'utf8') === before);
    assert.equal(readFileSync(TEXT, 'utf8'), before);
  } finally {
    writeFileSync(TEXT, before);
    await page.close();
  }
});

// Breaks: a scene's words row is picked by the compile's text key, which lags the write just made,
// so the words field is swapped for a plain span for one round: the input node is replaced, the
// caret leaves it and a draft typed across the save is lost (loka-3gnyd). Held focus is the check,
// since React keeps the DOM node only when the key does.
test("a scene card's words field keeps its node and its caret across its own save", async () => {
  const file = join(dir, 'identity_sampler/scenes/stranger_talk.scene');
  const before = readFileSync(file, 'utf8');
  await openWorld('identity_sampler');
  const page = await open({ selection: { kind: 'dialogue', key: 'stranger_talk' } }, 'line 1 npc');
  try {
    const field = page.locator('input[title="dialogue.stranger_talk.prompt"]');
    await shows(field, 'The stranger waits.');
    await field.click();
    assert.equal(await page.evaluate(focused), 'dialogue.stranger_talk.prompt');
    const mtime = statSync(file).mtimeMs;
    await field.fill('The stranger waits, still.');
    await field.press('Enter');
    await until(() => statSync(file).mtimeMs !== mtime);
    // the compile answers after the write: the field must be the same node, still focused, still mine
    for (let t = 0; t < 40; t++) await page.waitForTimeout(100);
    assert.equal(await page.evaluate(focused), 'dialogue.stranger_talk.prompt');
    assert.equal(await field.inputValue(), 'The stranger waits, still.');
    assert.equal(readFileSync(file, 'utf8'), before.replace('* The stranger waits.', '* The stranger waits, still.'));
  } finally {
    writeFileSync(file, before);
    await page.close();
  }
});
