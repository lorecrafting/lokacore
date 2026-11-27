// The World tab and the World card's block (author/build/world.tsx, slices 6.1a-b): a resource's new
// entry as newEntry makes it, a cartridge field picking a root file's key, and a capability's Turn
// on, after which Add mechanic… offers its field.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story, known } = await import('./build/room.tsx');
const { sheets, raise } = await import('./build/sheet.tsx');
Object.assign(globalThis, { localStorage: { getItem: () => null, setItem() {} } }); // Build's Undo chip
await import('./build/Build.tsx'); // the app's registration of the def: and contents sheets
const { WORDS } = await import('./build/form.tsx');
const { WORDS: WORLD, matches } = await import('./build/world.tsx');
const { refused, run } = await import('./build/roomedit.tsx');
const { BUSY } = await import('./build/formwrite.ts');

const root = new URL('../../../', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
const settle = () => new Promise((r) => setTimeout(r));

const caps = Object.fromEntries(
  (read('protocol/capability_registry.json') as { key: string; version: number }[]).map((c) => [
    c.key,
    c.version,
  ]),
);
const { commerce, ...lacking } = caps; // the fixture cartridge lacks commerce only
const files = new Map<string, any>([
  [
    'cartridge.json',
    {
      requires: { capabilities: lacking },
      entry: 'r1',
      world: { movement: { cost: { resource: 'mv' } } },
    },
  ],
  ['facts.json', { facts: {} }],
  ['resources.json', { resources: { gold: {} } }],
]);
let storyFiles: Record<string, string> = {}; // the /story's node files (the world files test names its own)
let storyBundled: Record<string, string> = {}; // the /story's area-bundled node files
let storyNodes = [{ ref: 'r1', kind: 'room' }]; // the last good compile's nodes
const posts: { file: string; ops: { path: string[]; value?: unknown; delete?: true }[] }[] = [];
/** The builder api: a /change lands in `files` (as write.ts writes it), so the next /story rereads it. */
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (sent) {
    posts.push(sent);
    for (const { path: p, value } of sent.ops) {
      let o = files.get(sent.file);
      for (const k of p.slice(0, -1)) o = o[k] ??= {};
      o[p.at(-1)] = structuredClone(value);
    }
    return [200, { id: posts.length }];
  }
  if (path === '/story')
    return [
      200,
      {
        map: [],
        graph: { nodes: storyNodes },
        files: { ...storyFiles },
        bundled: storyBundled, // a fresh map per /story (load rereads on a new one); no root file
      },
    ];
  if (path === '/templates' || path.startsWith('/fights')) return [200, []];
  const dir = /^\/schema\/(\w+)$/.exec(path)?.[1];
  if (dir) {
    const stub = read(`schemas/source/${dir}.schema.json`);
    return [200, { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs }];
  }
  const file = decodeURIComponent(path.split('file=')[1]);
  return files.has(file)
    ? [
        200,
        {
          bytes: JSON.stringify(files.get(file)),
          sha256: 'S',
          kind: /^areas\/\w+\/(\w+)/.exec(file)?.[1] ?? file.split(/[/.]/)[0],
        },
      ]
    : [404, null];
}
story(
  api,
  () => {},
  () => {},
  () => {},
);
await settle();

/** Sheet `id`'s nodes once its reads settle, and a press on the button whose key starts `key`. */
async function opened(id: string) {
  const [name, arg] = id.startsWith('def:') ? ['def', id.slice(4)] : [id, undefined];
  const shown = () => nodes((sheets as any)[name].body(arg));
  const drawn = async () => {
    for (let i = 0; i < 4; i++) (shown(), await settle()); // each read a file's sheet starts
  };
  await drawn();
  const find = (key: string) =>
    shown().find((x) => x.props?.accessibilityRole === 'button' && String(x.key).startsWith(key));
  const press = async (key: string) => (find(key).props.onPress(), await drawn());
  return { shown, find, press };
}
/** The cartridge sheet with world.movement.cost unfolded. */
async function cartridge() {
  const s = await opened('def:cartridge.json');
  for (const path of [['world'], ['world', 'movement'], ['world', 'movement', 'cost']])
    if (
      s.find(`fold cartridge.json:${JSON.stringify(path)}`)?.props.accessibilityState?.expanded ===
      false
    )
      await s.press(`fold cartridge.json:${JSON.stringify(path)}`);
  return s;
}
const sent = () => posts.splice(0).flatMap((p) => p.ops.map((o) => [o.path.join('.'), o.value]));
/** Key `k` typed into sheet `s`'s new-entry field (its map unfolded at `fold` first), then Add. */
async function added(s: Awaited<ReturnType<typeof opened>>, fold: string, k: string) {
  const id = `${fold.slice(0, -1)},"+key"]`;
  const key = () =>
    nodes(s.shown().find((x) => x.key === id)?.props.children).find(
      (x) => x.props?.accessibilityLabel === WORDS.key,
    );
  if (!key()) await s.press(`fold ${fold}`);
  key().props.onChangeText(k);
  await s.press(`entry ${id}`);
}

// break: an unread resources.json counts as one with no keys, so a real key is refused (code review)
test('with resources.json unread, a cartridge resource field takes gold as free text', async () => {
  const [kept, cart] = [files.get('resources.json'), structuredClone(files.get('cartridge.json'))];
  files.delete('resources.json'); // before any test reads it
  const s = await cartridge();
  sent();
  const input = s.shown().find((x) => x.props?.defaultValue === 'mv' && x.props.onBlur);
  input.props.onChangeText('gold');
  input.props.onBlur();
  await settle();
  assert.deepEqual(sent(), [['world.movement.cost.resource', 'gold']]);
  files.set('resources.json', kept).set('cartridge.json', cart); // the /story test 3 sends rereads both
});

// break: a resource's new entry is the schema's least value, not the World card's (newEntry)
test('a resource New hp writes {}, focus the blank row, a key inside gold the least value', async () => {
  const s = await opened('def:resources.json');
  sent();
  await added(s, 'resources.json:["resources"]', 'hp');
  await added(await opened('def:resources.json'), 'resources.json:["resources"]', 'focus');
  await added(await opened('def:resources.json'), 'resources.json:["resources","gold"]', 'note');
  assert.deepEqual(sent(), [
    ['resources.hp', {}],
    ['resources.focus', { minimum: 0, maximum: 0, start: 0, gain: 0 }],
    ['resources.gold.note', ''], // a key inside an entry is not a new resource
  ]);
});

// break: Turn on writes elsewhere, or the cartridge is not read again, so shop stays greyed
test('Turn on commerce: one op at requires.capabilities.commerce, then npcs.shop is offered', async () => {
  files.set('npcs/n.json', {});
  story(
    api,
    () => {},
    () => {},
    () => {},
  );
  await settle();
  const shop = async () => {
    const s = await opened('def:npcs/n.json');
    if (!s.find('mechanic shop ')) await s.press('mechanic npcs/n.json');
    return s.find('mechanic shop ').props.accessibilityState;
  };
  assert.ok('disabled' in (await shop()), 'greyed before');
  const c = await opened('contents');
  await c.press(WORLD.tab);
  const keys = (pre: string) =>
    c
      .shown()
      .filter((x) => String(x.key).startsWith(pre))
      .map((x) => String(x.key));
  assert.deepEqual(keys('on '), ['on commerce']); // only what the cartridge lacks
  assert.deepEqual(
    c
      .shown()
      .filter((x) => /\.json$/.test(words(x)) && x.props?.onPress)
      .map(words),
    ['cartridge.json', 'facts.json', 'resources.json'], // the root files that read, in order
  );
  sent();
  await c.press('on commerce');
  assert.deepEqual(sent(), [['requires.capabilities.commerce', commerce]]);
  assert.ok(!('disabled' in ((await shop()) ?? {})), 'offered after');
});

// break: a resource field offers no keys, offers a room's, or takes a key no resources.json entry has
test('a cartridge resource field picks hp, ma, mv and resources.json keys', async () => {
  files.get('resources.json').resources.focus ??= {}; // its own, so it runs alone
  const s = await cartridge();
  const at = (path: string[]) =>
    s.shown().find((x) => x.key === `picks cartridge.json:${JSON.stringify(path)}`);
  const picks = nodes(at(['world', 'movement', 'cost', 'resource'])?.props.children).filter(
    (x) => x.props?.onPress,
  );
  assert.deepEqual(picks.map(words), ['hp', 'ma', 'mv', 'gold', 'focus']); // the pools, then resources.json
  sent();
  const input = s.shown().find((x) => x.props?.defaultValue === 'mv' && x.props.onBlur);
  input.props.onChangeText('nope');
  input.props.onBlur();
  await settle();
  assert.deepEqual(sent(), []);
  assert.ok(
    s.shown().some((x) => words(x) === 'no resource nope'),
    'the refusal shown',
  );
});

// break: the World tab lists no population, transport or barrier (or opens no sheet), or a world file's sheet writes
// the wrong path or value (a number as text, opens_when not the least Policy)
test('the World tab lists the world files; each sheet writes cap 3, fare 5 and opens_when (Add mechanic…)', async (t) => {
  const was = known.open;
  t.after(() => ((storyFiles = {}), (known.open = was))); // the next /story names none again, even on a failure
  files
    .set('populations/p.json', { cap: 1 })
    .set('transports/t.json', { fare: 0 })
    .set('barriers/b.json', { keywords: ['gate'], name: 'x', initial: 'locked' });
  storyFiles = {
    'x@1/population/p': 'populations/p.json',
    'x@1/transport/t': 'transports/t.json',
    'x@1/barrier/b': 'barriers/b.json',
    'x@1/npc/n': 'npcs/n.json',
  };
  const opens: string[] = [];
  story(
    api,
    () => {},
    () => {},
    (id) => void opens.push(id),
  );
  await settle();
  const c = await opened('contents');
  if (!c.find('on ')) await c.press(WORLD.tab);
  assert.deepEqual(
    c
      .shown()
      .filter((x) => /\//.test(words(x)) && x.props?.onPress)
      .map(words),
    ['barriers/b.json', 'populations/p.json', 'transports/t.json'], // not npcs/n.json
  );
  await c.press('populations/p.json');
  assert.deepEqual(opens, ['def:populations/p.json']);
  sent();
  const type = async (file: string, was: string, t: string) => {
    const s = await opened(`def:${file}`);
    const input = s.shown().find((x) => x.props?.defaultValue === was && x.props.onBlur);
    input.props.onChangeText(t);
    input.props.onBlur();
    await settle();
  };
  await type('populations/p.json', '1', '3');
  await type('transports/t.json', '0', '5');
  const b = await opened('def:barriers/b.json');
  await b.press('mechanic barriers/b.json');
  await b.press('mechanic opens_when ');
  assert.deepEqual(sent(), [
    ['cap', 3], // PopulationPlan.cap: an integer, not the words '3'
    ['fare', 5],
    ['opens_when', { op: 'all', items: [] }], // the least Policy (anyOf's first: all of nothing)
  ]);
});

// break: a group out of order (prefix before the equal key), case not ignored, the cap not six, or N off by the cap
test('matches: the equal key, then those starting with the text, then those containing it; six, then how many more', () => {
  const keys = ['xa', 'a2', 'A', 'ba', 'a1', 'ca', 'da', 'ea', 'b'];
  assert.deepEqual(matches(keys, 'a'), { shown: ['A', 'a2', 'a1', 'xa', 'ba', 'ca'], more: 2 });
  assert.deepEqual(matches(keys, ''), { shown: keys.slice(0, 6), more: 3 }); // an emptied field matches every key
  assert.deepEqual(matches(keys, 'b'), { shown: ['b', 'ba'], more: 0 });
});

/** Story nodes `n` (with files and bundles) read again; the sheet of `file`, its field `label`. */
async function compiled(n: typeof storyNodes, file: string, label: string) {
  storyNodes = n;
  story(
    api,
    () => {},
    () => {},
    () => {},
  );
  await settle();
  const s = await opened(`def:${file}`);
  const input = () =>
    s.shown().find((x) => x.props?.accessibilityLabel === label && x.props.onBlur);
  const typed = async (t: string, blur = true) => {
    input().props.onChangeText(t);
    if (blur) input().props.onBlur();
    await settle();
  };
  const picks = (path: string[]) =>
    nodes(s.shown().find((x) => x.key === `picks ${file}:${JSON.stringify(path)}`)?.props.children)
      .filter((x) => x.props?.onPress)
      .map(words);
  const said = () =>
    s
      .shown()
      .filter((x) => typeof x.props?.children === 'string' && x.props.children.startsWith('no '))
      .map((x) => [x.props.children, x.props['aria-live']]);
  return { s, input, typed, picks, said };
}

// break: the Book offers another area's item or one its area bundles (not the panel's reachable list),
// a non-key leaves the field or refuses at the sheet's top, a press on another field's match drops
// this field's blur write, or a field with no keys of its kind refuses
test('a population corpse picks the keys the panel offers; nope stays at the field; with no items, free text', async (t) => {
  t.after(
    () => ((storyFiles = {}), (storyBundled = {}), (storyNodes = [{ ref: 'r1', kind: 'room' }])),
  );
  const file = 'areas/a/populations/p.json';
  files.set(file, { cap: 1, corpse: 'i_a', item: 'i_a' });
  storyFiles = { i_a: 'areas/a/items/i.json', i_b: 'areas/b/items/i.json', i_top: 'items/x.json' };
  storyBundled = { i_in_b: 'areas/b.json' };
  const n = ['r1', 'i_a', 'i_b', 'i_in_b', 'i_top'].map((ref) => ({
    ref,
    kind: ref[0] === 'r' ? 'room' : 'item',
  }));
  const f = await compiled(n, file, 'corpse');
  // the panel's right.tsx:37 list for these files: reachable() in kernel/ts/play/world_card.ts, which world.tsx calls too
  assert.deepEqual(f.picks(['corpse']), ['i_a', 'i_top']);
  sent();
  await f.typed('nope');
  assert.deepEqual(sent(), []);
  assert.deepEqual(f.said(), [['no item nope', 'polite']]);
  assert.equal(refused(), '');
  await f.typed('i_top');
  assert.deepEqual(sent(), [['corpse', 'i_top']]);
  // a click on another field's match: this field's blur still writes
  f.input().props.onChangeText('i_top');
  const other = f.s.shown().find((x) => x.key === `picks ${file}:${JSON.stringify(['item'])}`);
  other.props.onPointerDown();
  f.input().props.onBlur();
  await settle();
  nodes(other.props.children)
    .find((x) => words(x) === 'i_top')
    .props.onPress();
  await settle();
  assert.deepEqual(sent(), [
    ['corpse', 'i_top'],
    ['item', 'i_top'],
  ]);
  const free = await compiled([{ ref: 'r1', kind: 'room' }], file, 'corpse');
  await free.typed('anything');
  assert.deepEqual(sent(), [['corpse', 'anything']]);
});

// break: focus leaves the sheet half height or the field unscrolled, matches or +N more show before a
// keystroke or +0 more shows, the held key is not marked, the typed key is sent before the pressed one
// in a click's or a tap's event order, a non-key leaves the field, the refusal is read per keystroke
// (also after a refused leave) or at the sheet's top, +N more is off, or a press on the held key or an
// emptied field's blur leaves the typed text showing
/** A press on field `g`'s match `k`, its events in `steps` order; any polite line after each step. */
async function picked(g: Awaited<ReturnType<typeof compiled>>, k: string, steps: string) {
  const row = g.s.shown().find((x) => String(x.key).startsWith('picks '));
  const press = g.s.find(k);
  const on: Record<string, () => void> = {
    down: () => row.props.onPointerDown(),
    in: () => press.props.onPressIn(),
    out: () => press.props.onPressOut?.(),
    blur: () => g.input().props.onBlur(),
    press: () => press.props.onPress(),
  };
  const told: string[] = [];
  for (const step of steps.split(' '))
    (on[step](), told.push(...g.said().flatMap(([w, l]) => (l ? [w] : []))));
  await settle();
  return told;
}
const CLICK = 'down blur in out press'; // a browser click: the blur on mousedown, RN-web's press-in 50 ms later
const TAP = 'down in out blur press'; // a touch tap: pointerup and touchend before the compat mousedown's blur

test('a cartridge entry with 11 rooms: room_1 then a press on room_12 writes only room_12; zz refuses at the field', async (t) => {
  const cart = structuredClone(files.get('cartridge.json'));
  t.after(() => ((storyNodes = [{ ref: 'r1', kind: 'room' }]), files.set('cartridge.json', cart)));
  const rooms = ['r1', ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map((i) => `room_${i}`)];
  const g = await compiled(
    rooms.map((ref) => ({ ref, kind: 'room' })),
    'cartridge.json',
    'entry',
  );
  const shown = () => g.picks(['entry']);
  const more = () => g.s.shown().filter((x) => /^\+\d+ more$/.test(words(x))).length;
  assert.deepEqual([shown(), more()], [[], 0]); // no picks before a keystroke
  let raised = 0;
  const scrolled: unknown[] = [];
  raise.full = () => raised++;
  g.input().props.onFocus({ target: { scrollIntoView: (o: unknown) => scrolled.push(o) } });
  assert.deepEqual(
    [raised, scrolled],
    [1, [{ block: 'start' }]],
    'focus raises the sheet, the field to its top',
  );
  sent();
  await g.typed('room_1', false);
  assert.deepEqual([shown(), more()], [['room_1', 'room_12'], 0]);
  await picked(g, 'room_12', CLICK); // the typed key is not sent before the press's
  assert.deepEqual(sent(), [['entry', 'room_12']]);
  assert.deepEqual(shown(), []);
  await g.typed('zz', false);
  assert.deepEqual(g.said(), [['no room zz', undefined]]); // shown while typing, not read
  assert.deepEqual(shown(), []);
  g.input().props.onBlur();
  await settle();
  assert.deepEqual(sent(), []);
  assert.deepEqual(g.said(), [['no room zz', 'polite']]); // read once it leaves the field
  assert.equal(refused(), '');
  await g.typed('zzz', false);
  assert.deepEqual(g.said(), [['no room zzz', undefined]]); // typing again: shown, not read per keystroke
  await g.typed('room_1', false);
  const held = (k: string) => g.s.find(k).props.accessibilityState?.selected;
  assert.deepEqual([held('room_1'), held('room_12')], [false, true]);
  await picked(g, 'room_12', TAP); // the key it already holds: the typed room_1 is not sent either
  assert.deepEqual([sent(), g.input().props.value], [[], 'room_12']);
  await g.typed('', false);
  g.input().props.onBlur(); // emptied, then left: the key shows again, nothing told or sent
  await settle();
  assert.deepEqual([sent(), g.input().props.value, g.said()], [[], 'room_12', []]);
  await g.typed('room', false);
  assert.deepEqual(shown(), ['room_1', 'room_2', 'room_3', 'room_4', 'room_5', 'room_6']);
  assert.ok(g.s.shown().some((x) => words(x) === WORLD.more(4)));
  await g.typed('room_3');
  assert.deepEqual(sent(), [['entry', 'room_3']]);
});

// break: a field of exactly six keys hides them until a keystroke, a click on one after zz reads the
// refusal as the blur comes first, or one match past six shows no +1 more
test('a cartridge entry with 6 rooms offers all six; with 7, r shows six and +1 more', async (t) => {
  t.after(() => (storyNodes = [{ ref: 'r1', kind: 'room' }]));
  const rooms = (n: number) =>
    ['r1', ...Array.from({ length: n - 1 }, (_, i) => `room_${i + 1}`)].map((ref) => ({
      ref,
      kind: 'room',
    }));
  const six = await compiled(rooms(6), 'cartridge.json', 'entry');
  assert.equal(six.picks(['entry']).length, 6);
  sent();
  await six.typed('zz', false);
  assert.deepEqual(
    await picked(six, 'room_1', CLICK),
    [],
    'zz is not read as the press takes the focus',
  );
  assert.deepEqual(sent(), [['entry', 'room_1']]);
  const seven = await compiled(rooms(7), 'cartridge.json', 'entry');
  await seven.typed('r', false);
  assert.equal(seven.picks(['entry']).length, 6);
  assert.ok(seven.s.shown().some((x) => words(x) === WORLD.more(1)));
});

// Breaks (loka-x1frg): a room key typed and left while another gesture writes is forgotten, so
// leaving the field again writes nothing.
test('a room key left while another gesture writes stays typed; leaving it again writes it', async (t) => {
  const cart = structuredClone(files.get('cartridge.json'));
  t.after(() => ((storyNodes = [{ ref: 'r1', kind: 'room' }]), files.set('cartridge.json', cart)));
  const rooms = ['r1', 'room_2'].map((ref) => ({ ref, kind: 'room' }));
  const g = await compiled(rooms, 'cartridge.json', 'entry');
  sent();
  let release = () => {};
  void run(() => new Promise<void>((r) => (release = r)));
  g.input().props.onFocus({ target: null });
  await g.typed('room_2');
  assert.deepEqual(sent(), [], 'written mid-gesture');
  assert.deepEqual([refused(), g.input().props.value], [BUSY, 'room_2'], 'not kept and said');
  release();
  await settle();
  g.input().props.onBlur();
  await settle();
  assert.deepEqual(sent(), [['entry', 'room_2']], 'the typed key was forgotten');
});
