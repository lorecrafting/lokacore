// Build's page hooks (build/page.ts; docs/rnd/in-game-builder-mode-2026-11-19.md decision 5, slice
// 6.4) on a stand-in document: a double-click outside Build opens a line's field, the walk keys
// step through Build's lines, and the Book's palette stays set as the --loka-<role> variables.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { color } from '../book/tokens.ts';

const KEY = 'room.loft.description';
const listeners = new Map<string, (e: object) => void>();
const vars = new Map<string, string>();
const sent: [string, any][] = [];
const told: any[] = [];
let paper = 'rgb(235, 230, 215)'; // the Book page's computed background
let focused: object | undefined;
let on = false;
let coarse = false;
let reply: (path: string) => [number, object] | undefined = () => undefined; // else 200
const body = { parentElement: null };
Object.assign(globalThis, {
  HTMLElement: class {},
  document: {
    body,
    get activeElement() {
      return focused;
    },
    documentElement: { style: { setProperty: (k: string, v: string) => vars.set(k, v) } },
    addEventListener: (name: string, run: (e: object) => void) => listeners.set(name, run),
    removeEventListener: (name: string) => listeners.delete(name),
    querySelector: () => body,
    querySelectorAll: () => [body],
  },
  getComputedStyle: () => ({ backgroundColor: paper }),
  matchMedia: () => ({ matches: coarse }),
  requestAnimationFrame: (run: () => void) => setTimeout(run),
  cancelAnimationFrame: clearTimeout,
  fetch: async (path: string, init?: { body: string }) => {
    sent.push([path.split('?')[0], init && JSON.parse(init.body)]);
    const [status, given] = reply(path) ?? [200];
    if (given) return { status, json: async () => given };
    const answer = path.startsWith('/__author/line')
      ? { file: 'world/loft.md', line: 4, was: 'A low loft.', words: 'A low loft.' }
      : { id: 1 };
    return { status, json: async () => answer };
  },
});
const { api, start } = await import('./build/page.ts');
const { attach, changed, go, line, shut } = await import('./build/field.tsx');
const seen = new Map([
  ['A low loft.', KEY],
  ['~', 'room.hut.description'],
  ['~\u200c', 'room.shed.description'],
]);
const said = new Map([[KEY, 'A low loft.']]);
let redrawn = 0;
attach({
  on: () => on,
  seen,
  said,
  redraw: () => redrawn++,
  focus() {},
  commit() {},
  api,
  wrote() {},
});
const stop = start((m) => told.push(m));
const tick = () => new Promise((r) => setTimeout(r));
/** A page element as the browser hands it: an HTMLElement, a text field by its tag. */
const el = (o: object) => Object.assign(new (globalThis as any).HTMLElement(), { tagName: 'P' }, o);
const key = (k: string, target = el({})) => ({
  ...{ key: k, metaKey: false, ctrlKey: false, altKey: false, target },
});
const text = (p: { children?: unknown }) => JSON.stringify(p.children);
const box = (i: number) => ({
  i,
  focus() {
    focused = this;
  },
  scrollIntoView() {},
  compareDocumentPosition: (o: { i: number }) => (o.i > i ? 4 : 2),
  getBoundingClientRect: () => ({ height: 20 }),
});

// Breaks: line() drawing nothing outside Build (the double-click opens a field no line shows),
// opens() not called from the document's dblclick, or the field's Enter sending no /edit or two.
test('a double-click outside Build opens the line, and its Enter sends one /edit', async () => {
  const words = el({ textContent: 'A low loft.', parentElement: body });
  listeners.get('dblclick')!({ target: el({ textContent: 'A', parentElement: words }) });
  await tick();
  assert.deepEqual(
    sent.map(([p]) => p),
    ['/__author/line'],
  );
  const input = nodes(line({ children: 'A low loft.' }).children).find(
    (n) => n.type === 'TextInput',
  );
  assert.ok(input, 'outside Build the opened line draws no field');
  input.props.onChangeText('A high loft.');
  input.props.onSubmitEditing();
  await tick();
  assert.equal(sent.filter(([p]) => p === '/__author/edit').length, 1);
  shut();
});

// Breaks: a double-click picking a word inside a text field, or on a phone (no double-click to
// mean "edit"), opening the line under it.
test('a double-click in a text field, or with a coarse pointer, opens nothing', async () => {
  const before = sent.length;
  const parentElement = el({ textContent: 'A low loft.', parentElement: body });
  listeners.get('dblclick')!({ target: el({ tagName: 'INPUT', textContent: 'A', parentElement }) });
  coarse = true;
  listeners.get('dblclick')!({ target: el({ textContent: 'A', parentElement }) });
  coarse = false;
  await tick();
  assert.equal(sent.length, before);
});

// Breaks: a title two keys draw alike opening one key's field (Enter would write the other key's
// line), or opening nothing with no word why (inbook.test.ts:203 before 6.4).
test('words two keys draw alike open no field and say why under the line', async () => {
  said.set('item.oar.short', 'The lost oar').set('quest.oar.title', 'The lost oar');
  const before = sent.length;
  listeners.get('dblclick')!({ target: el({ textContent: 'The lost oar', parentElement: body }) });
  await tick();
  assert.equal(sent.length, before, 'no /line asked for either key');
  assert.match(text(line({ children: 'The lost oar' })), /Not a line of words\./);
  shut();
  said.delete('item.oar.short');
  said.delete('quest.oar.title');
});

// Breaks: a field open off Build missing the notice when its file changes under it, or a change
// to another file re-asking its line (inbook.test.ts:512 before 6.4).
test("a change to the open field's file opens the notice unasked; another file's does not", async () => {
  const words = el({ textContent: 'A low loft.', parentElement: body });
  listeners.get('dblclick')!({ target: words });
  await tick();
  const asked = () => sent.filter(([p]) => p === '/__author/line').length;
  const before = asked();
  changed([{ file: 'world/barn.md' }]);
  await tick();
  assert.equal(asked(), before, 'another file asks nothing');
  changed([{ file: 'world/loft.md' }]); // its line as the field opened on it: a save's own echo
  await tick();
  assert.doesNotMatch(text(line({ children: 'A low loft.' })), /Changed on disk/);
  reply = (path) =>
    path.startsWith('/__author/line')
      ? [200, { file: 'world/loft.md', line: 4, was: 'A tall loft.', words: 'A tall loft.' }]
      : undefined;
  changed([{ file: 'world/loft.md' }]);
  await tick();
  reply = () => undefined;
  assert.equal(asked(), before + 2);
  const drawn = text(line({ children: 'A low loft.' }));
  assert.match(drawn, /Changed on disk since you opened it\. A tall loft\./);
  assert.match(drawn, /Keep mine/);
  shut();
});

// Breaks: a Checks row whose /open is refused (the page is behind the compile) doing nothing
// silently (inbook.test.ts:686 before 6.4).
test('a Checks row whose line /open refuses says why', async () => {
  reply = (path) => (path.startsWith('/__author/open') ? [404, { kept: [] }] : undefined);
  let note = '';
  assert.equal(
    go('room.gone.description', (n) => (note = n)),
    false,
  );
  await tick();
  reply = () => undefined;
  assert.equal(
    note,
    'Changed since the last compile: this page is behind the cartridge. Wait for the compile, or press Cmd-E.',
  );
});

// Breaks: the palette setter dropped or run only in Build: ink() falls back to its light colour,
// so Build's sheets read light ink on the night page.
test('at night the --loka-<role> variables take the night palette', async () => {
  paper = 'rgb(16, 21, 30)'; // the dark page, #10151e
  listeners.get('focusin')!({});
  await tick();
  assert.equal(vars.get('--loka-fg'), color.dark.fg);
  assert.notEqual(color.dark.fg, color.light.fg);
});

// Breaks: the panel reading `~ 0 here` outside Build on a page with `~` lines (book-ui.md:933
// does not make the counts Build-only), or a walk key off Build focusing a line that takes none.
test('outside Build the `~` lines are counted, but a walk key moves nothing', async () => {
  on = false;
  line({ children: '~' }).ref(box(0));
  listeners.get('focusin')!({});
  await tick();
  assert.deepEqual(told.at(-1), { todoHere: { here: 1, at: 0 } });
  const was = focused;
  listeners.get('keydown')!(key(']'));
  assert.equal(focused, was);
});

// Breaks: `]` stepping through every line or in draw order rather than page order, the walk
// landing nowhere (no focus, so Enter opens nothing), or the panel's counts not following it.
test('`]` lands on the next unwritten line in page order, and the counts follow', async () => {
  on = true;
  const [low, hut, shed] = [box(0), box(2), box(1)]; // drawn in another order than the page's
  line({ children: 'A low loft.' }).ref(low);
  line({ children: '~' }).ref(hut);
  line({ children: '~\u200c' }).ref(shed);
  listeners.get('keydown')!(key(']'));
  assert.equal(focused, shed);
  listeners.get('keydown')!(key(']'));
  assert.equal(focused, hut);
  listeners.get('focusin')!({});
  await tick();
  assert.deepEqual(told.at(-1), { todoHere: { here: 2, at: 2 } });
  listeners.get('keydown')!(key('}'));
  assert.equal(focused, low, '`}` steps through written lines too, wrapping');
});

// Breaks: the panel's shortcuts (Cmd-K and the rest) dying while the Book has the focus.
test('Cmd-K on the Book goes to the panel, not the browser', () => {
  let prevented = false;
  listeners.get('keydown')!({
    ...key('k'),
    metaKey: true,
    preventDefault: () => (prevented = true),
  });
  assert.deepEqual([told.at(-1), prevented], [{ shortcut: 'k' }, true]);
});

// Breaks: stop() leaving a frame it already asked for, which then tells the panel stale counts.
test('a stop cancels the frame already asked for', async () => {
  listeners.get('focusin')!({}); // `}` moved the focus to a written line: the counts change
  const before = told.length;
  stop();
  await tick();
  assert.equal(told.length, before);
});

// Breaks: stop() leaving `frame` set, so after a restart no frame is ever asked for again and the
// palette and counts stop following the page.
test('after a stop and a new start, a repaint still sets the palette', async () => {
  const again = start(() => {});
  paper = 'rgb(235, 230, 215)'; // back to the day page
  listeners.get('focusin')!({});
  await tick();
  assert.equal(vars.get('--loka-fg'), color.light.fg);
  again();
});
