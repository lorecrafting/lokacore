// size: allow 513, one editor's keys, saves and conflicts walked over one stubbed page
// E5's in-Book editor (docs/design/prose-in-the-book-rulings.md) in headless Google Chrome, over a
// page of plain lines and a stubbed /__author route; the Book itself is the walk's (web-preview.md).
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { build } from 'esbuild';
import { chromium, type Browser, type Page } from 'playwright';
import type { start } from './inbook.ts';

const ORIGIN = 'http://localhost:19999'; // the relay takes only a local origin; the route answers, no server
const LINES = [
  ['a.rain', 'Rain falls.'],
  ['a.one', '~'],
  ['a.two', '~'],
] as const;
const RAIN = { file: 'a.loka', line: 3, was: 'Rain falls.', words: 'Rain falls.' };
let browser: Browser;
let page: Page;
let bundle: string;
let asked: { path: string; body: any }[];
let answer: (path: string, body: any) => [number, unknown] | Promise<[number, unknown]>;
let thrown: Error[]; // a guard dropped, a key or click throws in the page

before(async () => {
  const out = await build({
    entryPoints: [`${import.meta.dirname}/inbook.ts`],
    bundle: true,
    format: 'iife',
    globalName: 'inbook',
    write: false,
  });
  bundle = out.outputFiles[0].text;
  browser = await chromium.launch({ channel: 'chrome' });
});
after(() => browser.close());

beforeEach(async () => {
  asked = [];
  answer = (path) => (path.startsWith('/line') ? [200, RAIN] : [200, { id: 7, file: 'a.loka' }]);
  page = await browser.newPage();
  thrown = [];
  page.on('pageerror', (e) => thrown.push(e));
  page.setDefaultTimeout(5000); // a broken editor fails in seconds, not 30 s per wait
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/__author'))
      return route.fulfill({ contentType: 'text/html', body: '<main></main><button>Go</button>' });
    const path = url.pathname.slice('/__author'.length) + url.search;
    const body = route.request().postDataJSON();
    asked.push({ path, body });
    const [status, sent] = await answer(path, body);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(sent) });
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate((lines) => {
    const w = window as unknown as {
      inbook: { tagged: (k: string, w: string) => string; start: typeof start };
      told: object[];
    };
    const seen = new Map<string, string>();
    const said = new Map<string, string>();
    w.told = [];
    for (const [key, words] of lines) {
      const el = document.querySelector('main')!.appendChild(document.createElement('p'));
      el.dir = 'auto';
      el.textContent = w.inbook.tagged(key, words);
      seen.set(el.textContent, key);
      said.set(key, words);
    }
    Object.assign(w, { said, seen });
    w.inbook.start({ seen, said, tell: (m) => w.told.push(m), redraw: () => {} });
  }, LINES);
});

afterEach(() => assert.deepEqual(thrown, []));

const told = () => page.evaluate(() => (window as unknown as { told: object[] }).told);
const note = () => page.locator('.loka-note').textContent();
const noteSays = (text: string) =>
  page.waitForFunction((t) => document.querySelector('.loka-note')?.textContent === t, text);
const told1 = async (act: () => Promise<unknown>) => {
  const n = (await told()).length;
  await act();
  await page.waitForFunction((n) => (window as unknown as { told: object[] }).told.length > n, n);
  return (await told()).at(-1);
};
const openFirst = async () => {
  await page.locator('p').first().dblclick();
  await page.locator('[data-loka-field]').waitFor();
};
const posted = (op: string) => asked.filter((a) => a.path === op).map((a) => a.body);

// Breaks: a double-click opens no field, the field holds the shown words not the source's, Enter
// posts the wrong line, or the line keeps the field's editing after it closes.
test('a double-click opens the source words; Enter saves them to that line and closes', async () => {
  answer = (path) =>
    path.startsWith('/line') ? [200, { ...RAIN, words: 'Rain ~' }] : [200, { id: 7 }];
  await page.locator('p').first().dblclick();
  const field = page.locator('[data-loka-field]');
  assert.equal(await field.textContent(), 'Rain ~');
  assert.equal(asked[0].path, '/line?key=a.rain&words=Rain%20falls.');
  assert.equal(await note(), 'a.loka:3  Enter saves · Esc cancels');
  await page.keyboard.type(' still');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  assert.deepEqual(posted('/edit'), [
    { file: 'a.loka', line: 3, was: 'Rain falls.', words: 'Rain ~ still', key: 'a.rain' },
  ]);
  assert.equal(await page.locator('p').first().textContent(), 'Rain falls.');
  assert.equal(await page.locator('p').first().getAttribute('contenteditable'), null);
  assert.ok(
    await page
      .locator('p')
      .first()
      .evaluate((el) => el === document.activeElement),
  );
});

const TILDE = { file: 'a.loka', line: 4, was: '~', words: '~' };

// Breaks: a bare `~` opens with the caret after it, so typing saves "~Ab, c'd": a stray `~` in
// the prose, and the line drops out of Still to write (a placeholder is a line that trims to `~`).
test('typing in a bare ~ line replaces the ~', async () => {
  answer = (path) => (path.startsWith('/line') ? [200, TILDE] : [200, { id: 7 }]);
  await page.locator('p').nth(1).dblclick();
  await page.locator('[data-loka-field]').waitFor();
  await page.keyboard.type("Ab, c'd");
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  assert.deepEqual(posted('/edit'), [{ ...TILDE, words: "Ab, c'd", key: 'a.one' }]);
});

// Breaks: the fix empties a bare `~` on open instead of selecting it, so the field no longer
// shows the line as written; Esc must still leave the line and the file as they were.
test('a bare ~ opens showing ~; Esc writes nothing and restores the line', async () => {
  const drawn = await page.locator('p').nth(1).textContent(); // `~` and its key's marks
  answer = () => [200, TILDE];
  await page.locator('p').nth(1).dblclick();
  assert.equal(await page.locator('[data-loka-field]').textContent(), '~');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('p').nth(1).textContent(), drawn);
  assert.deepEqual(posted('/edit'), []);
});

// Breaks: a space's keyup presses the button around a line (a room title's): the field blurs and
// saves the words typed so far.
test('a space mid-edit in a line inside a button keeps the field open', async () => {
  await page.evaluate(() => {
    const button = document.querySelector('button')!;
    button.append(document.querySelector('p')!);
    button.onclick = () => button.focus(); // a Book press takes the focus
  });
  await page.locator('button p').dblclick();
  await page.locator('[data-loka-field]').waitFor();
  await page.keyboard.type(' at dusk');
  assert.equal(await page.locator('[data-loka-field]').textContent(), 'Rain falls. at dusk');
  assert.deepEqual(posted('/edit'), []);
});

// Breaks: Esc or an untouched field writes, an emptied field saves, or a paste keeps its newline.
test('Esc and unchanged words write nothing; empty words say how to leave a line unwritten', async () => {
  await openFirst();
  await page.locator('[data-loka-field]').dblclick(); // picks a word; keeps the caption
  assert.equal(await note(), 'a.loka:3  Enter saves · Esc cancels');
  await page.keyboard.press('Escape');
  await openFirst();
  await page.keyboard.press('Enter'); // unchanged
  await openFirst();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await noteSays('Empty. Write ~ to leave it unwritten.');
  await page.locator('[data-loka-field]').evaluate((el) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', 'Wet\nstones\tshine');
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertFromPaste',
        dataTransfer,
        cancelable: true,
      }),
    );
  });
  assert.equal(await page.locator('[data-loka-field]').textContent(), 'Wet stones shine');
  assert.deepEqual(posted('/edit'), []);
});

// Breaks: the walk skips a `~` line, stops at the end, leaves the counts stale, or Enter on a
// control (a choice) opens the landed line too.
test('] walks the ~ lines and wraps, } every line; Enter opens the landed one, off a control', async () => {
  const at = () => page.locator('[data-loka-landed]').evaluate((el) => el.textContent);
  await page.keyboard.press(']');
  assert.equal((await at()).trim()[0], '~');
  assert.deepEqual((await told()).at(-1), { todoHere: { here: 2, at: 1 } });
  await page.keyboard.press(']');
  await page.keyboard.press(']');
  assert.deepEqual((await told()).at(-1), { todoHere: { here: 2, at: 1 } });
  await page.keyboard.press('[');
  assert.deepEqual((await told()).at(-1), { todoHere: { here: 2, at: 2 } });
  await page.keyboard.press('}');
  assert.equal(await at(), 'Rain falls.');
  await page.locator('button').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-loka-field]').count(), 0);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press('}'); // the button's Enter was a click, which ended the landing
  await page.keyboard.press('Enter');
  await page.locator('[data-loka-field]').waitFor();
  assert.equal(await page.locator('[data-loka-field]').textContent(), 'Rain falls.');
});

// Breaks: a click leaves the landed line taking Enter, or the panel's relay is ignored.
test('a click ends the landing; the panel relays the walk keys', async () => {
  await page.keyboard.press('}');
  await page.locator('main').click();
  assert.equal(await page.locator('[data-loka-landed]').count(), 0);
  assert.deepEqual((await told()).at(-1), { todoHere: { here: 2, at: 0 } });
  const relay = { op: 'key', key: ']', metaKey: false, ctrlKey: false, altKey: false };
  await page.evaluate((data) => postMessage(data, '*'), relay);
  await page.locator('[data-loka-landed]').waitFor();
  await page.evaluate((data) => postMessage({ ...data, key: 'Enter' }, '*'), relay);
  await page.locator('[data-loka-field]').waitFor();
});

// Breaks: the panel's selection marks no line, or every line; Cmd-K in the Book is lost to the
// panel; editing a key not on the page does nothing; a foreign origin moves the selection.
test('the selection marks its lines; the panel`s shortcuts and edits reach it from the Book', async () => {
  await page.evaluate(() => {
    const w = window as unknown as { seen: Map<string, string> };
    const el = document.querySelector('main')!.appendChild(document.createElement('p'));
    el.dir = 'auto';
    el.textContent = 'A hut.';
    w.seen.set('A hut.', 'room.hut.title');
    postMessage({ op: 'select', kind: 'room', key: 'hut' }, '*');
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-loka-selected]').length === 1);
  const data = { op: 'select', kind: 'room', key: 'barn' };
  await page.evaluate(
    (d) => dispatchEvent(new MessageEvent('message', { data: d, origin: 'https://example.com' })),
    data,
  );
  assert.equal(
    await page.locator('[data-loka-selected]').count(),
    1,
    'a foreign page moves no selection',
  );
  await page.evaluate(() => postMessage({ op: 'select', kind: 'room', key: 'barn' }, '*'));
  await page.waitForFunction(() => !document.querySelector('[data-loka-selected]'));
  assert.deepEqual(await told1(() => page.keyboard.press('ControlOrMeta+k')), { shortcut: 'k' });
  await page.evaluate(() => postMessage({ op: 'edit', key: 'a.rain' }, '*'));
  await page.locator('[data-loka-field]').waitFor();
  await page.keyboard.press('Escape');
  const gone = () => postMessage({ op: 'edit', key: 'b.gone' }, '*');
  assert.deepEqual(await told1(() => page.evaluate(gone)), {
    note: 'b.gone is not on this page; opened in your editor.',
  });
  assert.deepEqual(posted('/open'), [{ key: 'b.gone', words: '' }]);
});

// Breaks: Cmd-Z puts back nothing, the wrong id, or hides a 409 behind a success note; or sends
// not the old words, so the Book shows them only after the next compile.
test('Cmd-Z puts back this page`s edits one per press, then says none are left', async () => {
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  await page.locator('main').click();
  await page.keyboard.press('ControlOrMeta+c');
  await page.waitForTimeout(200);
  assert.deepEqual(posted('/undo'), []); // Break: any Cmd chord puts back
  assert.deepEqual(await told1(() => page.keyboard.press('ControlOrMeta+z')), {
    note: 'put back a.loka:3',
  });
  assert.deepEqual(posted('/undo'), [{ ...RAIN, id: 7, key: 'a.rain', draft: 'Rain falls.!' }]);
  assert.deepEqual(await told1(() => page.keyboard.press('ControlOrMeta+z')), {
    note: 'Nothing of yours to put back.',
  });
});

test('a 409 put-back names the file and offers its source', async () => {
  answer = (path) =>
    path === '/undo' ? [409, 'changed'] : path.startsWith('/line') ? [200, RAIN] : [200, { id: 7 }];
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  await page.locator('main').click();
  assert.deepEqual(await told1(() => page.keyboard.press('ControlOrMeta+z')), {
    note: 'a.loka changed since; not put back.',
    open: { key: 'a.rain', words: 'Rain falls.!' },
  });
  // Break: the refused edit leaves the stack, so a Cmd-Z after a fix says none are left.
  await told1(() => page.keyboard.press('ControlOrMeta+z'));
  assert.deepEqual(
    posted('/undo').map((s: { id: number }) => s.id),
    [7, 7],
  );
});

// Breaks: a 409 drops the draft, Keep mine writes against the stale line, or a refused re-read
// offers Keep mine anyway.
test('a 409 keeps the draft and shows their words; Keep mine writes against their line', async () => {
  const theirs = { file: 'a.loka', line: 4, was: 'Rain fell.', words: 'Rain fell.' };
  let lines = 0;
  answer = (path, body) => {
    if (path.startsWith('/line')) return [200, lines++ ? theirs : RAIN];
    return body.was === theirs.was ? [200, { id: 8 }] : [409, 'stale'];
  };
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.getByText('Keep mine').waitFor();
  assert.match((await note())!, /^Changed on disk since you opened it\. Rain fell\./);
  assert.equal(await page.locator('[data-loka-field]').textContent(), 'Rain falls.!');
  await page.getByText('Keep mine').click();
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  assert.deepEqual(posted('/edit').at(-1), {
    file: 'a.loka',
    line: 4,
    was: 'Rain fell.',
    words: 'Rain falls.!',
    key: 'a.rain',
  });
});

test('a 409 whose line is gone offers only Open source, and the draft stays', async () => {
  let lines = 0;
  answer = (path) =>
    path.startsWith('/line') ? (lines++ ? [404, 'gone'] : [200, RAIN]) : [409, 'stale'];
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.getByText('Open source').waitFor();
  assert.equal(await page.getByText('Keep mine').count(), 0);
  const opened = page.waitForRequest((r) => r.url().endsWith('/__author/open'));
  await page.getByText('Open source').click();
  assert.deepEqual((await opened).postDataJSON(), { key: 'a.rain', words: 'Rain falls.' });
  assert.equal(await page.locator('[data-loka-field]').count(), 1); // the draft stays
});

// Breaks: a pushed change to the field's file never warns, a refused compile marks no line, or a
// `~` line's accessible name omits it.
test('pushed messages mark unconfirmed lines and open the notice under a changed field', async () => {
  const theirs = { ...RAIN, was: 'Rain fell.', words: 'Rain fell.' };
  let lines = 0;
  answer = (path) => (path.startsWith('/line') ? [200, lines++ ? theirs : RAIN] : [200, {}]);
  await page.evaluate(() =>
    (window as any).inbook.heard({ text: '', said: [], unconfirmed: [{ key: 'a.rain' }] }),
  );
  const rain = page.locator('p').first();
  assert.equal(await rain.getAttribute('data-loka-a11y'), 'unconfirmed');
  assert.equal(await page.locator('p').nth(1).getAttribute('data-loka-a11y'), 'still to write');
  await openFirst();
  assert.equal(await page.evaluate(() => (window as any).inbook.frozen('a.rain')), 'Rain falls.');
  await page.evaluate(() =>
    (window as any).inbook.heard({ text: '', said: [], changed: [{ file: 'b.loka' }] }),
  );
  await page.evaluate(() =>
    (window as any).inbook.heard({ text: '', said: [], changed: [{ file: 'a.loka' }] }),
  );
  await page.getByText('Take theirs').waitFor();
  assert.equal(asked.filter((a) => a.path.startsWith('/line')).length, 3); // b.loka asked nothing
  await page.getByText('Take theirs').click();
  assert.equal(await page.locator('[data-loka-field]').count(), 0);
  assert.equal(await rain.getAttribute('data-loka-unconfirmed'), null);
});

// Breaks: a line with no field opens one anyway, or gives the generic note for a choice label.
// Breaks: a refused save hides the watcher's reason behind a bare status.
test('a refused save says the watcher`s reason', async () => {
  answer = (path) => (path.startsWith('/line') ? [200, RAIN] : [400, 'Two lines say this.']);
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await noteSays('Two lines say this.');
});

test('a line with no field says why', async () => {
  answer = () => [400, 'a choice label: its key is its words'];
  await page.locator('p').first().dblclick();
  await noteSays('A choice label is its key. Alt-click opens the scene.');
  await page.locator('main').click();
  assert.equal(await page.locator('.loka-note').isHidden(), true);
  await page.locator('button').dblclick();
  await noteSays('Not a line of words. Alt-click opens its source.');
  assert.equal(await page.locator('[data-loka-field]').count(), 0);
});

/** An answer held until `open()`: the request is in flight meanwhile. */
const held = () => {
  let open!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  return { gate, open };
};
const settle = () => page.waitForTimeout(200); // an answer's handler has run

// Breaks: a second double-click while the first /line is in flight opens a second field.
test('a double-click while a field is opening opens nothing more', async () => {
  const { gate, open } = held();
  answer = async () => (await gate, [200, RAIN]);
  await page.locator('p').first().dblclick();
  await page.locator('p').nth(1).dblclick();
  open();
  await page.locator('[data-loka-field]').waitFor();
  await settle();
  assert.equal(await page.locator('[data-loka-field]').count(), 1);
  assert.equal(asked.filter((a) => a.path.startsWith('/line')).length, 1);
});

// Breaks: a click's select render remounts the line while /line waits; the field opens off the page.
test('a double-click opens the field on a line remounted while it was opening', async () => {
  const { gate, open } = held();
  answer = async () => (await gate, [200, RAIN]);
  await page.locator('p').first().dblclick();
  await page.$eval('p', (p) => p.replaceWith(p.cloneNode(true)));
  open();
  assert.equal(await page.locator('[data-loka-field]').textContent(), 'Rain falls.');
});

// Breaks: a line gone from the page while /line waits throws in openField.
test('a line gone while its field was opening opens nothing', async () => {
  const { gate, open } = held();
  answer = async () => (await gate, [200, RAIN]);
  await page.locator('p').first().dblclick();
  await page.$eval('p', (p) => p.remove());
  open();
  await settle();
  assert.equal(await page.locator('[data-loka-field]').count(), 0);
});

// Breaks: a Book render while the field is open shows the newer words, not those it opened on.
test('the open field keeps the words it opened on', async () => {
  const drawn = await page.locator('p').nth(1).textContent(); // `~` and its key's marks
  answer = () => [200, { file: 'a.loka', line: 4, was: '~', words: '~' }];
  await page.locator('p').nth(1).dblclick();
  await page.locator('[data-loka-field]').waitFor();
  await page.evaluate(() => (window as any).said.set('a.one', 'Rain stops.'));
  const frozen = () => page.evaluate(() => (window as any).inbook.frozen('a.one'));
  assert.equal(await frozen(), drawn);
  await page.keyboard.press('Escape');
  assert.equal(await frozen(), undefined);
});

// Breaks: a blur while Enter's save is in flight posts the line a second time.
test('a blur during a save writes once', async () => {
  const { gate, open } = held();
  answer = async (path) =>
    path.startsWith('/line') ? [200, RAIN] : (await gate, [200, { id: 7 }]);
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.locator('button').click();
  open();
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  assert.equal(posted('/edit').length, 1);
});

// Breaks: a blur's save pulls focus back to the line from the control the author clicked.
test('a blur save leaves focus on what was clicked', async () => {
  await openFirst();
  await page.keyboard.type('!');
  await page.locator('button').click();
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON');
});

// Breaks: a key relayed from the panel walks or puts back while a field is open.
test('a relayed key leaves an open field alone', async () => {
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter'); // an edit Cmd-Z could put back
  await page.waitForFunction(() => !document.querySelector('[data-loka-field]'));
  await openFirst();
  await page.evaluate(() => postMessage({ op: 'key', key: 'z', metaKey: true }, '*'));
  await page.evaluate(() => postMessage({ op: 'key', key: ']' }, '*'));
  await settle();
  assert.deepEqual(posted('/undo'), []);
  assert.equal(await page.locator('[data-loka-landed]').count(), 0);
});

// Breaks: a save or its conflict answered after Esc closes or marks the line opened since.
test('an answer after Esc leaves the next field alone', async () => {
  const saved = held();
  answer = async (path) =>
    path.startsWith('/line') ? [200, RAIN] : (await saved.gate, [200, { id: 7 }]);
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.locator('p').nth(1).dblclick();
  await page.locator('[data-loka-field]').waitFor();
  saved.open();
  await settle();
  assert.equal(await page.locator('p').nth(1).getAttribute('data-loka-field'), '');
  await page.keyboard.press('Escape');
  const reread = held();
  let lines = 0;
  answer = async (path) =>
    path.startsWith('/line')
      ? lines++
        ? (await reread.gate, [200, RAIN])
        : [200, RAIN]
      : [409, 'stale'];
  await openFirst();
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  while (lines < 2) await page.waitForTimeout(20); // the conflict's re-read is in flight
  await page.keyboard.press('Escape');
  reread.open();
  await settle();
  assert.equal(await page.locator('.loka-note').isHidden(), true);
});
