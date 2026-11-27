// size: allow 600, a cut page’s caption, the phone field tests and the Checks refusal (shown, cleared) join the field seam’s harness
// Build's in-place field (docs/system/book-ui.md#author-mode; slice 1.3): a room description's
// line opens its field through the Book seam. The server's /line and /edit: kernel/ts/test/author.test.ts.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';
import { bind, tagged } from './prose_rules.ts';

const KEY = 'room.loft.description';
const LINKED = 'A low loft. A [hearth](hearth) smokes.';
const seen = new Map<string, string>();
const said = new Map<string, string>();
const sent: [string, any][] = []; // every request the page makes, hold included
let answers: [number, unknown][] = []; // the next /line and /edit answers, in order
let map: object[] = []; // /story's rooms
const hearth = () => {};
const tick = () => new Promise((r) => setTimeout(r));
const edits = () => sent.filter(([path]) => path === '/__author/edit').map(([, b]) => b);
const holds = () => sent.filter(([path]) => path === '/__author/hold').map(([, b]) => b.on);

Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => (k === BUILD ? '{"on":true}' : null), setItem() {} },
  addEventListener() {},
  fetch: async (path: string, init?: { body: string }) => {
    if (path === '/__author/story') return { status: 200, json: async () => ({ map }) };
    if (path === '/__author/todo') return { status: 200, json: async () => [] }; // Checks' files
    sent.push([path.split('?')[0], init && JSON.parse(init.body)]);
    const [status, body] = path.startsWith('/__author/hold') ? [200, null] : answers.shift()!;
    return { status, json: async () => body };
  },
});
const build = await import('./build/Build.tsx');
const { RoomPage } = await import('../book/Body.tsx');
const { line: seamLine, shut } = await import('./build/field.tsx');
const api = async (path: string, body?: object): Promise<[number, any]> => {
  const r = await fetch(`/__author${path}`, body && { method: 'POST', body: JSON.stringify(body) });
  return [r.status, await r.json()];
}; // page.ts's, which panel.tsx hands in
build.install({ seen, said, redraw() {}, api });

/** The room page as the author preview draws it: panel.tsx's played().text binds each line. */
function page(description: string, title = 'Loft') {
  const text = (key: string) => {
    const words = key === KEY ? description : title;
    const shown = tagged(key, words);
    bind(seen, shown, key);
    said.set(key, words);
    said.set('room.cellar.description', undefined as any); // a key the cartridge has no words for
    return shown;
  };
  const view = {
    place: { title: { key: 'room.loft.title' }, description: { key: KEY } },
    exits: [],
    entities: [],
    inventory: [],
    actions: [],
    notices: [],
  };
  return nodes(
    RoomPage({
      view,
      text,
      log: [],
      g: { place: [], door: () => [] },
      press() {},
      open() {},
      links: new Map([['hearth', hearth]]),
    } as any),
  );
}
const line = (drawn: any[]) => drawn.find((n) => n.props?.accessibilityLabel?.endsWith(', edit'));
const field = (drawn: any[]) => drawn.find((n) => n.type === 'TextInput');
const at = (words: string) => ({ file: 'world/loft.md', line: 4, was: words, words });
async function opened(description: string, answer: object) {
  answers = [[200, answer]];
  line(page(description)).props.onPress();
  await tick();
  return field(page(description));
}

// Breaks: the field seeded with the drawn words (links stripped), so any save deletes the
// `[hearth](hearth)` link; Enter not sending /edit with the line's file, line and old words; the
// field not holding compiles while it is open; a link tap opening the field instead of playing.
test('a tap opens the source words in place, Enter sends them, links still play', async () => {
  const drawn = page(LINKED);
  const link = drawn.find((n) => n.props?.accessibilityLabel === 'hearth, open');
  assert.equal(link.props.onPress, hearth, 'the link no longer plays in Build');
  const whole = page('[hearth](hearth)'); // a link that is the whole description: its words name the key
  const only = whole.find((n) => n.props?.accessibilityLabel === 'hearth, open');
  assert.equal(
    only.props.onPress,
    hearth,
    'a link that is its whole line edits instead of playing',
  );
  assert.equal(line(drawn).props.accessibilityLabel, 'A low loft. A hearth smokes., edit');
  const key = (target: object) => ({
    key: 'Enter',
    target,
    currentTarget: {},
    preventDefault() {},
  });
  line(drawn).props.onKeyDown(key({})); // Enter on the link inside bubbles to its line
  assert.equal(sent.length, 0, "a link's Enter opens the field too");
  const input = await opened(LINKED, at(LINKED));
  assert.equal(input.props.defaultValue, LINKED);
  input.props.onFocus();
  input.props.onChangeText('A high loft. A [hearth](hearth) smokes.');
  answers = [[200, { id: 1 }]];
  input.props.onSubmitEditing();
  await tick();
  assert.deepEqual(edits(), [
    { ...at(LINKED), words: 'A high loft. A [hearth](hearth) smokes.', key: KEY },
  ]);
  assert.equal(field(page(LINKED)), undefined, 'the field stays open after a save');
  await tick(); // the release waits a turn (Build.tsx `hold`)
  assert.deepEqual(holds(), [true, false], 'the field took no Hold, or kept it');
  sent.length = 0;
});

// Breaks: a field left open (a notice, then a page change) refusing every later tap, or keeping
// the Hold after it lost focus; Build turned off leaving the field open; an emptied field writing a
// blank line instead of its notice (ported from tools/author-panel/test/words.test.ts:115).
test('a field left open blocks nothing and holds only while focused', async () => {
  const press = line(page(LINKED)).props.onPress;
  const input = await opened(LINKED, at(LINKED));
  input.props.onFocus();
  input.props.onChangeText('');
  input.props.onSubmitEditing(); // the "Empty." notice keeps it open
  assert.match(JSON.stringify(page(LINKED)), /Empty\./, 'an emptied field shut without its notice');
  input.props.onBlur();
  await tick();
  assert.deepEqual(holds(), [true, false], 'the Hold outlived the focus');
  assert.deepEqual(edits(), [], 'an emptied field wrote a blank line');
  sent.length = 0;
  answers = [[200, at('A cold loft.')]];
  press(); // the same line drawn again, as on a page that no longer shows the field
  await tick();
  assert.equal(
    field(page(LINKED)).props.defaultValue,
    'A cold loft.',
    'the stale field refused the tap',
  );
  shut();
  assert.equal(field(page(LINKED)), undefined, 'Build off left the field open');
  sent.length = 0;
});

// Breaks: Enter or Space on the line itself, or a line with an empty child, opening nothing; a
// refusal's own words or an unwritten line's first words lost; Esc leaving a field that a blur saves.
test('keys, refusals and Esc on the field', async () => {
  const drawn = page('A low loft.');
  assert.ok(!JSON.stringify(line(drawn).props.style).includes('border'), 'a written line is ruled');
  const self = {};
  for (const key of ['Enter', ' ']) {
    answers = [[200, at('A low loft.')]];
    line(drawn).props.onKeyDown({ key, target: self, currentTarget: self, preventDefault() {} });
    await tick();
    assert.ok(field(page('A low loft.')), `${JSON.stringify(key)} on the line opened nothing`);
    shut();
  }
  assert.ok(
    seamLine({ children: [null, 'A low loft.'] } as any).onPress,
    'an empty child broke the line',
  );
  answers = [[404, 'a choice label has no line']];
  line(drawn).props.onPress();
  await tick();
  assert.match(JSON.stringify(page('A low loft.')), /scene card/, "the refusal's reason was lost");
  const input = await opened('A low loft.', at('A low loft.'));
  input.props.onChangeText('A bare loft.');
  answers = [[500, 'no such file']];
  input.props.onSubmitEditing();
  await tick();
  assert.match(JSON.stringify(page('A low loft.')), /no such file/, "the server's words were lost");
  const pressed: string[] = [];
  const keyPress = (key: string, shiftKey = false) =>
    input.props.onKeyPress({
      nativeEvent: { key, shiftKey },
      preventDefault: () => pressed.push(key),
    });
  keyPress('Enter', true);
  keyPress('A', true);
  assert.ok(field(page('A low loft.')), 'Shift+Enter closed the field');
  keyPress('Escape');
  assert.deepEqual(pressed, ['Enter'], 'Shift+Enter broke the line, or another key was swallowed');
  input.props.onBlur();
  await tick();
  assert.equal(edits().length, 1, 'a blur after Esc saved');
  const blank = await opened('~', at('~'));
  blank.props.onChangeText('Rain falls.');
  answers = [[200, { id: 3 }]];
  blank.props.onSubmitEditing();
  await tick();
  assert.equal(
    edits().at(-1).words,
    'Rain falls.',
    "an unwritten line's first words were not sent",
  );
  sent.length = 0;
});

// Breaks: a 409 overwriting the disk's line, Keep mine sending the stale old words (a second 409),
// or Take theirs writing anything.
test('a line changed on disk offers Keep mine and Take theirs', async () => {
  const theirs = at('A cold loft.');
  const conflicted = async () => {
    const input = await opened(LINKED, at(LINKED));
    input.props.onChangeText('Mine.');
    answers = [
      [409, null],
      [200, theirs],
    ];
    input.props.onSubmitEditing();
    await tick();
    const choices = page(LINKED).filter((n) => n.props?.accessibilityRole === 'button');
    return (label: string) => choices.find((n) => n.props.children === label).props.onPress();
  };
  (await conflicted())('Take theirs');
  assert.equal(field(page(LINKED)), undefined);
  assert.equal(edits().length, 1, 'Take theirs wrote');
  sent.length = 0;
  const choose = await conflicted();
  answers = [[200, { id: 2 }]];
  choose('Keep mine');
  await tick();
  assert.deepEqual(edits().at(-1), { ...theirs, words: 'Mine.', key: KEY });
  sent.length = 0;
});

// Breaks (ruling 9): an unwritten line showing the owner `~` or unruled, its field opening on `~`, or
// leaving it empty writing an empty line or refusing to close.
test('an unwritten line is a blank ruled line whose field opens empty', async () => {
  const on = line(page('~')).props;
  assert.ok(!/~/.test(JSON.stringify(on.children)) && /loka-line/.test(JSON.stringify(on.style)));
  assert.equal(on.accessibilityLabel, 'Unwritten description, edit');
  const input = await opened('~', at('~'));
  assert.equal(input.props.defaultValue, '');
  input.props.onSubmitEditing();
  await tick();
  assert.deepEqual(edits(), []);
  assert.equal(field(page('~')), undefined, 'an empty unwritten line stays open');
  sent.length = 0;
});

// Breaks: an unwritten link (a new person's name on the room page) showing `~` in Build, losing its
// press or its rule; out of Build that link no longer drawn as the Book draws it.
test('an unwritten link is a blank captioned line that still plays; out of Build it is as drawn', () => {
  const link = (drawn: any[]) => drawn.find((n) => n.props?.onPress === hearth);
  const on = link(page('A [~](hearth) smokes.'));
  assert.equal(on.props.children.props.children, 'name', 'the caption, no `~`');
  assert.equal(on.props.accessibilityLabel, 'Unwritten name, open');
  assert.ok(on.props.style.flat().some((s: any) => s?.borderBottomWidth)); // ruled
  button('✎ Build').props.onPress(); // Build off
  const off = link(page('A [~](hearth) smokes.'));
  button('Build').props.onPress();
  assert.ok(JSON.stringify(off.props.children).includes('~'), 'out of Build the `~` is gone');
  assert.equal(off.props.accessibilityLabel.startsWith('~'), true);
});

// Breaks: a refused compile's line drawn like a confirmed one.
test('a line the compile refused carries the unconfirmed mark', () => {
  const marked = () => line(page('A low loft.')).props;
  assert.ok(!JSON.stringify(marked().style).includes('underline'));
  build.hear({ text: {}, said: [], unconfirmed: [{ key: KEY }] });
  assert.ok(JSON.stringify(marked().style).includes('underline'));
  assert.equal(marked().accessibilityLabel, 'A low loft., unconfirmed, edit');
  build.hear({ text: {}, said: [], unconfirmed: [] });
});

const strip = () => nodes(build.Strip({ children: 'book' }));
const button = (label: string) =>
  strip().find((n) => n.type === 'Pressable' && n.props.children?.props?.children === label);
const shows = (words: string) => strip().some((n) => n.props?.children === words);
async function write(id: number, before = async () => {}) {
  const input = await opened(LINKED, at(LINKED));
  await before();
  input.props.onChangeText('A high loft.');
  answers = [[200, { id }]];
  input.props.onSubmitEditing();
  // Until the save closes the field, right after its Undo chip (an earlier chip may still show): a fixed
  // count of turns fell short under CI load (loka-2z6b0). Real setImmediate; a mocked-timer hop never ends.
  const end = performance.now() + 2000;
  while (field(page(LINKED)) && performance.now() < end) await new Promise((r) => setImmediate(r));
  assert.equal(field(page(LINKED)), undefined, 'the save never settled');
}

// Breaks: no Undo after a write, the chip gone early or never, Undo putting back the new words or
// another write's (its journal id), or a refused or unsent put-back passing silently.
test('a write offers Undo for five seconds; Undo puts the old words back or says why not', async () => {
  try {
    await write(7, async () => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
    mock.timers.tick(4999);
    assert.ok(button('Undo'), 'the chip left before five seconds');
    mock.timers.tick(1);
    assert.equal(button('Undo'), undefined, 'the chip outlives five seconds');
  } finally {
    mock.timers.reset();
  }
  await write(8);
  sent.length = 0;
  answers = [[409, null]];
  button('Undo').props.onPress();
  await tick();
  const undos = sent.filter(([path]) => path === '/__author/undo').map(([, b]) => b);
  assert.deepEqual(undos, [{ id: 8, key: KEY, words: LINKED }]);
  assert.equal(button('Undo'), undefined, 'the chip stays after it was pressed');
  assert.ok(shows('world/loft.md changed since; not put back.'));
  answers = [[200, null]];
  button('Open source').props.onPress();
  await tick();
  assert.deepEqual(sent.at(-1), ['/__author/open', { key: KEY, words: LINKED }]);
  await write(9);
  answers = [[200, null]];
  button('Undo').props.onPress();
  await tick();
  assert.ok(!shows('world/loft.md changed since; not put back.'), 'a put-back said it failed');
  await write(10);
  const { fetch } = globalThis;
  globalThis.fetch = async () => Promise.reject(new TypeError('the server is down'));
  button('Undo').props.onPress();
  await tick();
  globalThis.fetch = fetch;
  assert.ok(shows('world/loft.md changed since; not put back.'), 'a put-back the server never got');
  sent.length = 0;
});

// Breaks: the badge or its sheet shown outside Build, a row going nowhere or to the wrong line (a key on
// this page not opening its field, one elsewhere or with no field not opening its source, a refusal not
// opening its file), a file-less refusal posing as a link, the sheet left covering the field it opened,
// or an empty sheet drawn blank and transparent over the Book (it eats every tap).
test('Checks: the badge opens the list, each row goes to its line', async () => {
  build.hear({
    text: {},
    said: [],
    diagnostics: [{ rel: 'world/loft.md', words: 'bad' }],
    unconfirmed: [{ key: KEY, at: 'world/loft.md:4' }],
    placeholders: { 'room.cellar.description': 'world/cellar.md:4' },
  });
  const BADGE = 'Checks · 1 refused · 1 not confirmed · 1 unwritten';
  const rows = () => strip().filter((n) => n.props?.accessibilityRole === 'link');
  const row = (label: string) => rows().find((n) => n.props.children.props.children === label);
  page(LINKED); // binds KEY on this page
  assert.deepEqual(button(BADGE).props.accessibilityState, { expanded: false });
  button(BADGE).props.onPress();
  assert.deepEqual(button(BADGE).props.accessibilityState, { expanded: true });
  answers = [[200, at(LINKED)]];
  row(`${KEY}: not confirmed`).props.onPress();
  await tick();
  assert.equal(field(page(LINKED))?.props.defaultValue, LINKED, 'the row did not open its field');
  assert.equal(rows().length, 0, 'the sheet covers the field');
  shut();
  build.hear({
    text: {},
    said: [],
    diagnostics: [{ rel: 'world/loft.md', words: 'bad' }, { words: 'no start room' }],
    unconfirmed: [{ key: 'room.loft.name', at: 'world/loft.md:2' }],
    placeholders: { 'room.cellar.description': 'world/cellar.md:4' },
  });
  seen.set('Loft', 'room.loft.name'); // on this page, but no field draws it
  sent.length = 0;
  button('Checks · 2 refused · 1 not confirmed · 1 unwritten').props.onPress();
  answers = [
    [200, null],
    [200, null],
    [200, null],
  ];
  row('room.cellar.description: unwritten').props.onPress();
  row('world/loft.md: bad').props.onPress();
  row('room.loft.name: not confirmed').props.onPress();
  await tick();
  assert.deepEqual(
    sent.filter(([path]) => path === '/__author/open').map(([, b]) => b),
    [
      { key: 'room.cellar.description', words: '' },
      { file: 'world/loft.md' },
      { key: 'room.loft.name', words: '' },
    ],
  );
  assert.equal(
    rows().length,
    3,
    'a row elsewhere closed the sheet, or a row with nowhere to go is a link',
  );
  seen.delete('Loft');
  button('Checks · 2 refused · 1 not confirmed · 1 unwritten').props.onPress();
  button('✎ Build').props.onPress(); // Build off
  assert.equal(button(BADGE), undefined, 'the badge shows outside Build');
  button('Build').props.onPress();
  build.hear({ text: {}, said: [] });
  button('Checks').props.onPress();
  const sheet = strip().find((n) => n.props?.onScroll);
  assert.ok(shows('Nothing to check.'), 'an empty sheet says nothing');
  assert.ok(
    sheet.props.style.some((s: object) => 'backgroundColor' in s),
    'an invisible sheet eats taps',
  );
  button('Checks').props.onPress();
  sent.length = 0;
});

// Breaks: a Checks row whose /open is refused (a page behind the cartridge) going nowhere silently,
// or Build's message handler not passing a compile's changed files to the open field (no notice).
// Also: the refusal left standing when Checks reopens or a message comes, so it shows under another row.
test('Checks says why a row cannot open; a changed file under the open field says so', async () => {
  const cellar = {
    text: {},
    said: [],
    placeholders: { 'room.cellar.description': 'world/cellar.md:4' },
  };
  const link = () =>
    strip()
      .find((n) => n.props?.accessibilityRole === 'link')
      .props.onPress();
  build.hear(cellar);
  button('Checks · 1 unwritten').props.onPress();
  answers = [[404, null]];
  link();
  await tick();
  const drawn = strip();
  const note = drawn.findIndex(
    (n) =>
      n.props?.children === 'Changed since the last compile: this page is behind the cartridge.',
  );
  assert.ok(
    note > 0 && drawn[note - 1].props.children === 'room.cellar.description: unwritten',
    'the refusal is not under its row',
  );
  const noted = () => strip().some((n) => n.props?.children === drawn[note].props.children);
  button('Checks · 1 unwritten').props.onPress(); // closes
  button('Checks · 1 unwritten').props.onPress(); // reopens
  assert.ok(!noted(), 'a reopened Checks still shows the old refusal');
  answers = [[404, null]];
  link();
  await tick();
  assert.ok(noted());
  build.hear(cellar);
  assert.ok(!noted(), 'a message (a compile may reorder rows) keeps the old refusal');
  button('Checks · 1 unwritten').props.onPress();
  await opened(LINKED, at(LINKED));
  answers = [[200, at('A cold loft.')]];
  build.hear({ text: {}, said: [], changed: [{ file: 'world/loft.md' }] });
  await tick();
  assert.match(JSON.stringify(page(LINKED)), /Changed on disk since you opened it\. A cold loft\./);
  shut();
  sent.length = 0;
});

// Breaks: the notice shown with no refusal or missing on one; Back offered with no checkpoint to go to;
// Start in this room offered with no room, or sent another room, or the room lost by the reload a later
// structural compile causes; an action wired to another's handler.
test('the keep-my-place notice offers its three ways back', async () => {
  const kept = new Map([[BUILD, '{"on":true}']]);
  const stored = globalThis.localStorage;
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => void kept.set(k, v),
    },
  });
  const calls: string[] = [];
  const go = { intent: { action_key: 'go', target_ids: [], input: { direction: 'north' } } } as any;
  let state: { steps: any[]; refused?: number; checkpoint?: any[] } = { steps: [go] };
  build.place({
    place: () => state,
    here: () => 'loft',
    drop: () => calls.push('drop'),
    back: () => calls.push('back'),
    startIn: (room) => calls.push(`room ${room}`),
  });
  try {
    build.install({ seen, said, redraw() {}, api });
    const NOTICE = "Couldn't keep your place: step 1, go north, was refused.";
    assert.ok(!shows(NOTICE), 'a notice with nothing refused');
    state = { steps: [go], refused: 0 };
    assert.ok(shows(NOTICE));
    assert.deepEqual(
      ['Drop it and go on', 'Back to checkpoint', 'Start in this room'].map((l) => !!button(l)),
      [true, false, false],
    );
    await write(10); // the write records the room it was made in
    build.install({ seen, said, redraw() {}, api }); // the reload a structural compile causes
    state = { steps: [go], refused: 0, checkpoint: [] };
    ['Drop it and go on', 'Back to checkpoint', 'Start in this room'].forEach((l) =>
      button(l).props.onPress(),
    );
    assert.deepEqual(calls, ['drop', 'back', 'room loft']);
  } finally {
    state = { steps: [] };
    Object.assign(globalThis, { localStorage: stored });
    build.install({ seen, said, redraw() {}, api });
    sent.length = 0;
  }
});

// Breaks: the pencil missing from the room's own title, on another room's or a non-title line, a
// press (or Enter, Space) opening no Room sheet, another key opening one, its press also looking,
// no redraw when the map comes, an unwritten title or exit showing `~` (ruling 9), or a person's
// name pencil keyed by the words drawn (two names in the same words: one gets the other's sheet).
test("the room title's pencil opens its Room sheet: summary and exits", async () => {
  map = [
    { key: 'loft', area: 'mill', title: 'Loft', file: 'L', exits: [{ dir: 'down', to: 'cellar' }] },
    { key: 'cellar', area: null, title: '~', exits: [] },
  ];
  let here = 'loft';
  build.place({
    place: () => ({ steps: [] }),
    here: () => here,
    drop() {},
    back() {},
    startIn() {},
  });
  let redrawn = 0;
  build.install({ seen, said, redraw: () => redrawn++, api });
  await tick();
  assert.equal(redrawn, 1, 'the map came: the Book draws its pencil');
  const pencils = (drawn: any[]) =>
    drawn.filter((n) => n.props?.accessibilityLabel?.startsWith('Edit '));
  const pencil = (drawn: any[]) => pencils(drawn)[0];
  const pen = pencil(page('A low loft.'));
  assert.equal(pen.props.accessibilityLabel, 'Edit Loft');
  assert.equal(pencils(page('Loft')).length, 1, 'a description in the title words has a pencil');
  const dialog = () =>
    nodes(build.Strip({ children: 'book' })).find((n) => n.props?.role === 'dialog');
  const key = (k: string) =>
    pen.props.onKeyDown({ key: k, preventDefault() {}, stopPropagation() {} });
  key('a');
  assert.equal(dialog(), undefined, 'another key opens no sheet');
  for (const k of ['Enter', ' ']) {
    key(k);
    nodes(dialog())
      .find((n) => n.props?.children?.props?.children === 'Back')
      .props.onPress();
  }
  let looked = true;
  pen.props.onPress({ stopPropagation: () => (looked = false) });
  assert.equal(looked, false, "the pencil's press also looks");
  const words = nodes(dialog())
    .map((n) => n.props?.children)
    .filter((c) => typeof c === 'string');
  const at = words.indexOf('1 exit') - 2; // the head (title, file), then the summary, above the edits
  assert.deepEqual(words.slice(at, at + 4), ['Loft', 'L', '1 exit', 'down → cellar']);
  assert.equal(words.includes('L'), true, "the sheet's foot names the room's file");
  here = 'cellar';
  const drawn = page('A low loft.', '~');
  assert.equal(pencil(drawn).props.accessibilityLabel, 'Edit cellar');
  const title = drawn.find((n) => n.props?.accessibilityRole === 'header');
  assert.equal(title.props.children[0].props.children, 'title', 'a `~` title drawn');
  assert.equal(pencil(page('A low loft.', 'Loft')), undefined, "another room's title");
  const hen = (k: string) => (said.set(k, 'Hen'), pencil(page('', 'Hen')));
  assert.equal(hen('npc.hen.name').props.accessibilityLabel, 'Edit hen');
  assert.equal(hen('item.hen.name'), undefined, 'two names in the same words: no pencil');
  build.install({ seen, said, redraw() {}, api }); // the stored state: no sheet open
});

// Breaks: a `.cut` page's line drawn without its caption, or captioned with its step index.
test('a cut page’s line is captioned with its page number', () => {
  said.set('scene.dawn.steps.1.text', 'Mist rises.');
  const p = seamLine({ children: 'Mist rises.' } as any);
  said.delete('scene.dawn.steps.1.text');
  assert.equal(p.children[0].props.children, 'page 2\n');
});

// Breaks: the field drawn at its own two rows, so a five-line description shrinks and the page
// below jumps up while it is open (19.4), or its height taken from onLayout, which RN-web fires on
// first layout only: Build turned on after the Book loaded never hears it; a phone shown "Enter saves · Esc cancels" with no keys to
// press, or its Cancel writing the draft (owner ruling 2026-11-25).
test("the field takes its line's height; a coarse pointer shows Save and Cancel acts", async () => {
  // Build turned on after load: the drawn line mounts its box, no layout event follows
  line(page(LINKED)).props.ref({ getBoundingClientRect: () => ({ height: 168 }) });
  const input = await opened(LINKED, at(LINKED));
  assert.equal(Object.assign({}, ...input.props.style.flat()).height, 168);
  assert.match(JSON.stringify(page(LINKED)), /Enter saves/, 'a fine pointer lost its caption');
  shut();
  const coarse = (q: string) => ({ matches: q === '(pointer: coarse)' });
  Object.assign(globalThis, { matchMedia: coarse });
  try {
    const typed = await opened(LINKED, at(LINKED));
    typed.props.onChangeText('A cold loft.');
    const acts = page(LINKED).filter((n) => n.props?.accessibilityRole === 'button');
    const act = (name: string) => acts.find((n) => n.props.children === name);
    assert.doesNotMatch(JSON.stringify(page(LINKED)), /Enter saves/, 'the phone kept the caption');
    act('Cancel').props.onPress();
    typed.props.onBlur(); // a tap away blurs the field after Cancel closed it
    await tick();
    assert.equal(field(page(LINKED)), undefined, 'Cancel left the field open');
    assert.deepEqual(edits(), [], 'Cancel wrote the draft');
    const again = await opened(LINKED, at(LINKED));
    again.props.onChangeText('A cold loft.');
    answers = [[200, { id: 4 }]];
    page(LINKED)
      .find((n) => n.props?.children === 'Save')
      .props.onPress();
    await tick();
    assert.equal(edits().at(-1)?.words, 'A cold loft.', 'Save sent nothing');
  } finally {
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
    sent.length = 0;
  }
});
