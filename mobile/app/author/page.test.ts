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
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: (run: () => void) => setTimeout(run),
  cancelAnimationFrame: clearTimeout,
  fetch: async (path: string, init?: { body: string }) => {
    sent.push([path.split('?')[0], init && JSON.parse(init.body)]);
    const answer = path.startsWith('/__author/line')
      ? { file: 'world/loft.md', line: 4, was: 'A low loft.', words: 'A low loft.' }
      : { id: 1 };
    return { status: 200, json: async () => answer };
  },
});
const { api, start } = await import('./build/page.ts');
const { attach, line, shut } = await import('./build/field.tsx');
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
const key = (k: string) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, target: {} });

// Breaks: line() drawing nothing outside Build (the double-click opens a field no line shows),
// opens() not called from the document's dblclick, or the field's Enter sending no /edit or two.
test('a double-click outside Build opens the line, and its Enter sends one /edit', async () => {
  const text = { textContent: 'A low loft.', parentElement: body };
  listeners.get('dblclick')!({ target: { textContent: 'A', parentElement: text } });
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

// Breaks: the palette setter dropped or run only in Build: ink() falls back to its light colour,
// so Build's sheets read light ink on the night page.
test('at night the --loka-<role> variables take the night palette', async () => {
  paper = 'rgb(16, 21, 30)'; // the dark page, #10151e
  listeners.get('focusin')!({});
  await tick();
  assert.equal(vars.get('--loka-fg'), color.dark.fg);
  assert.notEqual(color.dark.fg, color.light.fg);
});

// Breaks: `]` stepping through every line or in draw order rather than page order, the walk
// landing nowhere (no focus, so Enter opens nothing), or the panel's counts not following it.
test('`]` lands on the next unwritten line in page order, and the counts follow', async () => {
  on = true;
  const box = (i: number) => ({
    i,
    focus() {
      focused = this;
    },
    scrollIntoView() {},
    compareDocumentPosition: (o: { i: number }) => (o.i > i ? 4 : 2),
    getBoundingClientRect: () => ({ height: 20 }),
  });
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
