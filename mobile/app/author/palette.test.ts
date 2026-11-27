// The Builder's palette and keys (slice 6.5b): a gesture for every command, Cmd-Z as the Undo chip,
// and the map's keys on its ground (mapcontrols.tsx `mapKey`). The rows' ranking: kernel/ts/test/palette.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';

const sent: [string, unknown][] = [];

// a reload after a field's write: its chip kept
const kept = new Map([
  [BUILD, '{"on":true}'],
  [
    'loka-build-undo',
    JSON.stringify({
      w: { id: 7, key: 'gate', words: 'Old', file: 'text.json' },
      end: Date.now() + 60_000,
    }),
  ],
]);
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener() {},
  // Cmd-E's /open goes through page.ts `api`, which fetches
  fetch: async (url: string, init?: { body: string }) => (
    sent.push([url, init && JSON.parse(init.body)]),
    { status: 200, json: async () => null }
  ),
});
const build = await import('./build/Build.tsx');
const { COMMANDS, RUN, keys, pick } = await import('./build/palette.tsx');
const { nodes } = await import('../book/__tests__/combat-book.test.ts');
const { sheets } = await import('./build/sheet.tsx');
const { mapKey } = await import('./build/mapcontrols.tsx');
const { known } = await import('./build/room.tsx');
const api = async (path: string, body?: unknown): Promise<[number, any]> => (
  sent.push([path, body]),
  [200, null]
);
build.install({ seen: new Map(), said: new Map(), redraw() {}, api } as never);

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => {
  let taken = false;
  const e = {
    key: k,
    target: { tagName: 'DIV' },
    preventDefault: () => void (taken = true),
    stopPropagation() {},
    ...mods,
  };
  keys(e as never);
  return taken;
};
const top = () => JSON.parse(kept.get(BUILD)!).sheets?.at(-1);

test('every palette command runs one Builder gesture: one handler per COMMANDS id, none else', () => {
  assert.deepEqual(Object.keys(RUN).sort(), COMMANDS.map((c) => c.id).sort());
});

test('Cmd-Z presses the Undo chip: one /undo of the last write, then nothing', async () => {
  key('z', { metaKey: true });
  key('z', { metaKey: true }); // the chip is gone
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(
    sent.filter(([p]) => p === '/undo'),
    [['/undo', { id: 7, key: 'gate', words: 'Old' }]],
  );
});

test("Delete from the palette drops the top sheet's definition, never a root file", async () => {
  // a drop reads the file's source first (kernel drop.ts), then posts delete with its sha
  const asked = (file: string) =>
    sent.filter(([p]) => p === `/source?file=${encodeURIComponent(file)}`);
  for (const file of ['text.json', 'rooms/hall.json']) {
    known.open(`def:${file}`);
    RUN.delete();
    await new Promise((r) => setTimeout(r));
  }
  assert.equal(asked('text.json').length, 0);
  assert.notEqual(asked('rooms/hall.json').length, 0);
});

const room = (key: string, x: number, y: number, z = 0) =>
  ({ ref: key, key, area: null, title: key, exits: [], at: { x, y, z } }) as const;
const rooms = [room('hall', 0, 0), room('east', 2, 0), room('west', -1, 0), room('north', 0, -1)];
const acts = () => {
  const did: unknown[] = [];
  const a = {
    pick: (k: string) => void did.push(['pick', k]),
    goTo: (k: string) => void did.push(['go', k]),
    step: (by: number) => void did.push(['step', by]),
    zoom: (f: number) => void did.push(['zoom', f]),
    fit: () => void did.push(['fit']),
  };
  return { did, a };
};
const press = (k: string, mods: object = {}, z = 0, from = 'hall') => {
  const { did, a } = acts();
  const e = {
    key: k,
    preventDefault: () => void did.push(['taken']),
    stopPropagation() {},
    ...mods,
  };
  const below = [room('cellar', 0, 0, -1), room('vault', -2, 0, -1)];
  mapKey(e as never, [...rooms, ...below] as never, z, from, undefined, a);
  return did.filter((d) => (d as string[])[0] !== 'taken');
};
const takes = (k: string) => {
  const { did, a } = acts();
  mapKey(
    { key: k, preventDefault: () => void did.push('taken'), stopPropagation() {} } as never,
    rooms as never,
    0,
    'hall',
    undefined,
    a,
  );
  return did.includes('taken');
};

// Breaks: an arrow reaching a room on another level (the vault, west of west a floor down).
test('map keys: ArrowRight selects the east neighbour, Enter selects, Shift-Enter goes', () => {
  assert.deepEqual(press('ArrowRight'), [['pick', 'east']]);
  assert.deepEqual(
    press('ArrowLeft', {}, 0, 'west'),
    [],
    'west is the last room that way on its level',
  );
  assert.deepEqual(press('Enter'), [['pick', 'hall']]);
  assert.deepEqual(press('Enter', { shiftKey: true }), [['go', 'hall']]);
});

test("map keys: + and - zoom by M.step (1.25), 0 fits; Cmd-0 and Cmd-+ stay the browser's", () => {
  assert.deepEqual(
    [...press('+'), ...press('-'), ...press('0')],
    [['zoom', 1.25], ['zoom', 1 / 1.25], ['fit']],
  );
  assert.deepEqual([...press('0', { metaKey: true }), ...press('+', { ctrlKey: true })], []);
});

test('map keys: PageDown steps down to the cellar and no further, PageUp back up and no further; other keys pass', () => {
  assert.deepEqual([...press('PageDown'), ...press('PageUp')], [['step', -1]]);
  assert.deepEqual([...press('PageUp', {}, -1), ...press('PageDown', {}, -1)], [['step', 1]]);
  assert.equal(takes('x'), false);
  assert.equal(takes('+'), true);
});

test('Cmd-K opens the palette, Esc closes it; Cmd-E posts /open for the top sheet; other keys pass', async () => {
  assert.equal(key('k', { metaKey: true }), true);
  assert.equal(top(), 'palette');
  const typed = (q: string) =>
    nodes(sheets.palette!.body('')).find((n) => n.props?.onSubmitEditing);
  assert.ok(typed(''), 'the palette draws its field');
  assert.equal(key('Escape'), true);
  assert.notEqual(top(), 'palette');
  assert.equal(key('Escape'), false, "Esc with no palette is the Book's");
  assert.equal(key('k'), false, 'a plain k is typing');
  known.open('def:rooms/hall.json');
  assert.equal(key('e'), false);
  assert.equal(key('e', { metaKey: true, altKey: true }), false);
  assert.equal(key('e', { ctrlKey: true }), true);
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(
    sent.filter(([p]) => p === '/__author/open'),
    [['/__author/open', { file: 'rooms/hall.json' }]],
  );
});

test("Cmd-Z in a text field is the field's own undo", () => {
  kept.set(
    'loka-build-undo',
    JSON.stringify({
      w: { id: 8, key: 'g', words: 'x', file: 'text.json' },
      end: Date.now() + 60_000,
    }),
  );
  assert.equal(key('z', { metaKey: true, target: { tagName: 'INPUT' } as never }), false);
  assert.equal(key('z', { metaKey: true, shiftKey: true }), false, 'Shift-Cmd-Z is redo, not ours');
});

test('a palette row opens what it names, by kind', () => {
  known.files = { 'c@1:dialogue/d1': 'dialogue/d1.json' };
  const opened = (i: object) => (pick(i as never), top());
  assert.equal(opened({ kind: 'command', id: 'map-grow' }), 'map');
  assert.equal(
    opened({ kind: 'todo', id: 'gate', detail: 'npcs/ann.json:3' }),
    'def:npcs/ann.json',
  );
  assert.equal(opened({ kind: 'text', id: 'gate' }), 'def:text.json');
  assert.equal(opened({ kind: 'key', id: 'c@1:room/hall' }), 'room:hall');
  assert.equal(opened({ kind: 'key', id: 'c@1:dialogue/d1' }), 'def:dialogue/d1.json');
  assert.equal(opened({ kind: 'key', id: 'c@1:dialogue/none' }), 'contents');
  assert.equal(opened({ kind: 'line', id: 'story:c@1:dialogue/d1' }), 'def:dialogue/d1.json');
  assert.equal(opened({ kind: 'line', id: 'trace:gate' }), 'trace:gate');
  assert.equal(opened({ kind: 'line', id: 'beat:1' }), 'contents');
  const tabs = nodes(sheets.contents!.body(''));
  assert.ok(
    tabs.some((n) => n.key === 'Story' && n.props.accessibilityState?.selected),
    'on its Story tab',
  );
});

test('the room commands wait for a selected room on the map', () => {
  const posts = sent.length;
  RUN['map-npc']!();
  assert.equal(top(), 'map');
  assert.equal(sent.length, posts, 'no room selected: no write');
});
test('New npcs makes an NPC', async () => {
  const posts = sent.length;
  RUN['new-npcs']!();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(
    sent.slice(posts).find(([p]) => p === '/new'),
    ['/new', { kind: 'npcs', name: 'npc_1' }],
  );
});

test('the palette: Enter runs the top row; the command rows read as their label', async () => {
  const drawn = nodes(sheets.palette!.body(''));
  assert.equal(
    drawn.find((n) => n.key === 'command new-actions')?.props.children.props.children,
    'New actions',
  );
  const posts = sent.length;
  drawn.find((n) => n.props?.onSubmitEditing).props.onSubmitEditing();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(sent.slice(posts).find(([p]) => p === '/new')?.[1]?.kind, 'actions');
});

// Breaks: Down not moving the active row (or it not drawn selected), a new query keeping it, Enter
// running another row, the palette closed after its row runs (Delete then reads the palette as the
// top sheet and does nothing), Delete listed over a root file, or an unwritten line read as `~`.
test('the palette: Down moves the active row, a query resets it, Enter runs it on the sheet under', async () => {
  const shim = Symbol.for('combat-state');
  const was = (globalThis as any)[shim];
  const state: unknown[] = [];
  let n = 0;
  (globalThis as any)[shim] = (v: unknown) => {
    const i = n++;
    if (!(i in state)) state[i] = v;
    return [state[i], (x: unknown) => void (state[i] = x)];
  };
  const draw = () => ((n = 0), nodes(sheets.palette!.body('')));
  const rows = () => draw().filter((d) => d.type === 'Pressable');
  const field = () => draw().find((d) => d.props?.onKeyPress).props;
  build.hear({ text: {}, said: [], placeholders: { gate: 'npcs/ann.json:3' } } as never);
  known.open('def:text.json');
  key('k', { metaKey: true });
  assert.ok(!rows().some((r) => r.key === 'command delete'), 'no Delete over a root file');
  known.open('def:scenes/dawn.scene');
  key('k', { metaKey: true });
  assert.ok(
    !rows().some((r) => r.key === 'command delete'),
    'no Delete over a scene: its sheet has none',
  );
  known.open('def:rooms/hall.json');
  key('k', { metaKey: true });
  field().onKeyPress({ nativeEvent: { key: 'ArrowUp' } });
  assert.equal(rows()[0].props.accessibilityState.selected, true, 'Up at the top stays');
  field().onKeyPress({ nativeEvent: { key: 'ArrowDown' } });
  field().onChangeText('x');
  field().onChangeText('');
  assert.equal(rows()[0].props.accessibilityState.selected, true, 'typed and erased: the first');
  field().onKeyPress({ nativeEvent: { key: 'ArrowDown' } });
  const drawn = rows();
  assert.deepEqual(
    drawn.slice(0, 2).map((r) => r.props.accessibilityState.selected),
    [false, true],
  );
  build.hear({
    text: {},
    said: [],
    placeholders: { gate: 'npcs/ann.json:3', moat: 'a.json:1' },
  } as never);
  assert.equal(
    rows()[0].props.accessibilityState.selected,
    true,
    'new rows, as a late /find: the first',
  );
  field().onKeyPress({ nativeEvent: { key: 'ArrowDown' } });
  field().onChangeText('~');
  assert.deepEqual(
    [rows()[0].key, rows()[0].props.children.props.children],
    ['todo gate', 'gate: unwritten · npcs/ann.json:3'],
  );
  const asked = () => sent.filter(([p]) => p === '/source?file=rooms%2Fhall.json').length;
  const before = asked();
  field().onChangeText('delete');
  assert.equal(rows()[0].key, 'command delete');
  assert.equal(rows()[0].props.accessibilityState.selected, true, 'a new query: the first row');
  field().onSubmitEditing();
  await new Promise((r) => setTimeout(r));
  assert.notEqual(top(), 'palette');
  assert.equal(asked(), before + 1, 'Delete read the sheet under the palette');
  (globalThis as any)[shim] = was;
});

test('typing asks /find once, after a pause; a closed palette asks nothing', async () => {
  const shim = Symbol.for('combat-state');
  const was = (globalThis as any)[shim];
  const set: unknown[] = [];
  let calls = 0;
  (globalThis as any)[shim] = (v: unknown) => [
    calls++ % 3 ? v : 'gate', // the query; the active row and the reply as given
    (n: unknown) => void set.push(n),
  ];
  const stops: (() => void)[] = [];
  (globalThis as any)[Symbol.for('combat-effect')] = (f: () => () => void) => void stops.push(f());
  const finds = () => sent.filter(([p]) => p.startsWith('/find')).length;
  const before = finds();
  nodes(sheets.palette!.body(''));
  stops.pop()!(); // closed before the pause
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(finds(), before);
  nodes(sheets.palette!.body(''));
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(sent.filter(([p]) => p.startsWith('/find')).at(-1), ['/find?q=gate', undefined]);
  assert.deepEqual(set, [{}], 'its reply, kept');
  (globalThis as any)[shim] = was;
});

test("off Build, the keys are the Book's", () => {
  nodes(build.Strip({ children: 'book' }))
    .find((n) => n.type === 'Pressable')
    .props.onPress(); // Build off
  assert.equal(key('k', { metaKey: true }), false);
});
