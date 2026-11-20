// Build's in-place field (docs/system/book-ui.md#author-mode; slice 1.3): a room description's
// line opens its field through the Book seam. The server's /line and /edit: kernel/ts/test/author.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';
import { bind, tagged } from './prose_rules.ts';

const KEY = 'room.loft.description';
const LINKED = 'A low loft. A [hearth](hearth) smokes.';
const seen = new Map<string, string>();
const said = new Map<string, string>();
const sent: [string, any][] = []; // every request the page makes, hold included
let answers: [number, unknown][] = []; // the next /line and /edit answers, in order
const hearth = () => {};
const tick = () => new Promise((r) => setTimeout(r));
const edits = () => sent.filter(([path]) => path === '/__author/edit').map(([, b]) => b);
const holds = () => sent.filter(([path]) => path === '/__author/hold').map(([, b]) => b.on);

Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => (k === BUILD ? '{"on":true}' : null), setItem() {} },
  addEventListener() {},
  fetch: async (path: string, init?: { body: string }) => {
    sent.push([path.split('?')[0], init && JSON.parse(init.body)]);
    const [status, body] = path.startsWith('/__author/hold') ? [200, null] : answers.shift()!;
    return { status, json: async () => body };
  },
});
const build = await import('./build/Build.tsx');
const { RoomPage } = await import('../book/Body.tsx');
build.install({ seen, said, redraw() {} });

/** The room page as the author preview draws it: panel.tsx's played().text binds each line. */
function page(description: string) {
  const text = (key: string) => {
    const words = key === KEY ? description : 'Loft';
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

// Breaks (ruling 9): an unwritten line showing the owner `~`, its field opening on `~`, or leaving
// it empty writing an empty line or refusing to close.
test('an unwritten line is a blank ruled line whose field opens empty', async () => {
  const drawn = page('~');
  assert.ok(!JSON.stringify(line(drawn).props.children).includes('~'), 'the owner sees `~`');
  assert.equal(line(drawn).props.accessibilityLabel, 'Unwritten description, edit');
  const input = await opened('~', at('~'));
  assert.equal(input.props.defaultValue, '');
  input.props.onSubmitEditing();
  await tick();
  assert.deepEqual(edits(), []);
  assert.equal(field(page('~')), undefined, 'an empty unwritten line stays open');
  sent.length = 0;
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
