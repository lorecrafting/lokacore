// The notebook's Story tab (author/build/story.tsx, slice 5.4b): the rows it shows, which press sends
// which outline.json write, what Trace lists and Go there starts in. The rules of each beat edit are
// outlineedit's (kernel/ts/test/author_mapedit.test.ts); the list's rows are storylist's.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';

const kept = new Map([[BUILD, '{"on":true}']]);
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener() {},
  removeEventListener() {},
});
const R = (kind: string, key: string) => `w@1:${kind}/${key}`;
const story = {
  hash: 'h',
  graph: {
    nodes: [
      { ref: R('dialogue', 'greet'), kind: 'dialogue' },
      { ref: R('dialogue', 'farewell'), kind: 'dialogue' },
      { ref: R('fact', 'met_nell'), kind: 'fact' },
      { ref: R('npc', 'nell'), kind: 'npc' },
      { ref: R('item', 'lamp'), kind: 'item' },
    ],
    edges: [
      // the reader first: Trace lists the setters before the readers whatever the edges' order
      { from: R('dialogue', 'farewell'), to: R('fact', 'met_nell'), path: '.when', op: 'fact_is' },
      {
        from: R('dialogue', 'greet'),
        to: R('fact', 'met_nell'),
        path: '.on',
        op: 'fact.set',
        set: true,
      },
      // not a placement: Go there on nell must skip it for her `.room`
      { from: R('npc', 'nell'), to: R('room', 'cellar'), path: '.flees_to' },
      { from: R('npc', 'nell'), to: R('room', 'hall'), path: '.room' },
      // a room places its items: Go there on the lamp follows the cellar's edge, not the hall's first one
      { from: R('room', 'hall'), to: R('item', 'cup'), path: '.items' },
      { from: R('room', 'cellar'), to: R('item', 'lamp'), path: '.items' },
    ],
  },
  report: {
    unreachable: { start: [R('dialogue', 'farewell')] },
    behind_lock: { rooms: [] },
    orphan_facts: { unused: [], write_only: [], read_only: [] },
  },
  outline: {
    parts: ['Arrival', null],
    beats: [
      {
        part: 0,
        n: 1,
        title: 'Meet Nell',
        status: 'built',
        nodes: [R('dialogue', 'greet'), R('fact', 'met_nell'), R('npc', 'nell'), R('item', 'lamp')],
      },
      { part: 1, n: 2, status: '~', nodes: [R('dialogue', 'farewell')] },
    ],
    unpaid: [],
    unseeded: [],
  },
  facts: [],
  todo: {
    [R('dialogue', 'farewell')]: [
      { file: 'dialogues/farewell.json', words: 0, placeholders: ['~', '~'] },
    ],
  },
  diagnostics: { [R('dialogue', 'greet')]: [{ code: 'no_line' }] },
  files: {
    [R('dialogue', 'greet')]: 'dialogues/greet.json',
    [R('dialogue', 'farewell')]: 'dialogues/farewell.json',
    [R('npc', 'nell')]: 'npcs/nell.json',
  },
  bundled: { [R('item', 'lamp')]: 'areas/castle.json' },
  map: [
    {
      ref: R('room', 'hall'),
      key: 'hall',
      area: null,
      title: 'Hall',
      exits: [],
      file: 'areas/castle.json', // a bundle member: not in files
    },
    { ref: R('room', 'cellar'), key: 'cellar', area: null, title: 'Cellar', exits: [] },
  ],
  words: { [R('dialogue', 'greet')]: 120 },
  names: {},
  choices: {},
  hidden: [],
  unlinkable: {},
  shorts: ['dialogues/greet', 'facts/met_nell', 'npcs/nell', 'dialogues/farewell'],
  triggers: {},
};
const outline = {
  parts: [
    {
      beats: [
        {
          n: 1,
          title: 'Meet Nell',
          nodes: ['dialogues/greet', 'facts/met_nell', 'npcs/nell', 'items/lamp'],
        },
      ],
    },
    { beats: [{ n: 2, nodes: ['dialogues/farewell'] }] },
  ],
};
let posts: [string, any][] = [];
let id = 0;
const api = async (path: string, sent?: object): Promise<[number, any]> => {
  if (sent) return (posts.push([path, sent]), [200, { id: ++id }]);
  if (path === '/story') return [200, story];
  return path === '/source?file=outline.json'
    ? [200, { bytes: JSON.stringify(outline), sha256: 'S' }]
    : [404, null];
};
const started: string[] = [];
const build = await import('./build/Build.tsx');
const { known } = await import('./build/room.tsx');
const story_ = await import('./build/story.tsx');
const roomedit = await import('./build/roomedit.tsx');
build.place({
  place: () => ({ steps: [] }),
  here: () => 'hall',
  startIn: (r: string) => void started.push(r),
} as never);
build.install({ seen: new Map(), said: new Map(), redraw() {}, api } as never);
const settle = () => new Promise((r) => setTimeout(r));
await settle(); // /story

const sheet = () => nodes(build.sheets.contents.body(''));
const label = (e: any) => e.props.accessibilityLabel ?? e.props.children?.props?.children;
const all = (name: string, n = sheet()) =>
  n.filter((e) => e.type === 'Pressable' && label(e) === name);
const press = async (name: string, i = 0, n = sheet()) => (
  all(name, n)[i].props.onPress(),
  settle()
);
const type = (field: string, v: string, i = 0) =>
  sheet()
    .filter((e) => e.type === 'TextInput' && e.props.accessibilityLabel === field)
    [i].props.onChangeText(v);
const top = () => JSON.parse(kept.get(BUILD)!).sheets.at(-1);
const texts = () =>
  sheet().flatMap((e) => (typeof e.props?.children === 'string' ? [e.props.children] : []));
const change = (ops: object[]) => ['/change', { file: 'outline.json', was: 'S', ops }];
await press('Story');

test('the Story tab marks a beat unwritten, a node with its refusals, unwritten count and unreached, and never shows ~', async () => {
  await press('1  Meet Nell');
  await press('2 · unwritten');
  for (const row of [
    'Part 1  Arrival',
    'Part 2',
    'greet · 1 refusal',
    'met_nell',
    'nell',
    'farewell · 2 unwritten · unreached',
  ])
    assert.equal(all(row).length, 1, row);
  const selected = (name: string) => all(name)[0].props.accessibilityState.selected;
  assert.deepEqual(
    [selected('Story'), selected('Contents'), selected('2 · unwritten')],
    [true, false, true],
  );
  assert.deepEqual(
    texts().filter((t) => t.includes('~')),
    [],
  );
});

test('Add beat 3 on the second part (part:1) writes beat 3 after beat 2 there', async () => {
  posts = [];
  type('number', '3', 1);
  await press('Add beat', 1);
  assert.deepEqual(posts, [
    change([
      {
        path: ['parts', 1, 'beats'],
        value: [{ n: 2, nodes: ['dialogues/farewell'] }, { n: 3 }],
      },
    ]),
  ]);
});

test("Retitle with the field emptied removes beat 1's title; one Undo puts back that gesture", async () => {
  await press('greet · 1 refusal'); // a node picked
  await press('1  Meet Nell'); // beat 1 open, now picked
  posts = [];
  type('title', '');
  await press('Retitle');
  assert.deepEqual(posts, [change([{ path: ['parts', 0, 'beats', 0, 'title'], delete: true }])]);
  const last = id;
  posts = [];
  await press('Undo', 0, nodes(build.Strip({ children: 'book' })));
  assert.deepEqual(posts, [['/undo', { id: last }]]);
});

test('Bind on beat 2 (part:1) adds the short ref pressed to its nodes', async () => {
  await press('2 · unwritten'); // beat 2 open, now picked
  await press('Bind…');
  posts = [];
  await press('Bind npcs/nell');
  assert.deepEqual(posts, [
    change([
      { path: ['parts', 1, 'beats', 0, 'nodes'], value: ['dialogues/farewell', 'npcs/nell'] },
    ]),
  ]);
});

test("Trace of met_nell lists its setter then its reader; a listed row opens that node's sheet", async () => {
  await press('1  Meet Nell'); // picked
  await press('met_nell');
  await press('Trace');
  assert.equal(top(), `trace:${R('fact', 'met_nell')}`);
  const listed = nodes(build.sheets.trace.body(R('fact', 'met_nell')));
  assert.deepEqual(listed.filter((e) => e.type === 'Pressable').map(label), [
    'set at greet (Beat 1)',
    'read at farewell (Beat 2)',
  ]);
  await press('set at greet (Beat 1)', 0, listed);
  assert.equal(top(), 'def:dialogues/greet.json');
});

// Break: Sheet on a person opening her fields instead of her own sheet, no Source beside it, or a
// Source on a dialogue, whose fields are its only sheet (the panel's click and Alt-click).
test("a person's row opens her own sheet and her source; a dialogue's, its fields only", async () => {
  await press('nell');
  await press('Sheet');
  assert.equal(top(), 'npc:nell');
  await press('Source');
  assert.equal(top(), 'def:npcs/nell.json');
  await press('greet · 1 refusal');
  assert.equal(all('Source').length, 0);
  await press('Sheet');
  assert.equal(top(), 'def:dialogues/greet.json');
});

// Break: a sheet's head losing its ref, counting another node's unwritten or diagnostics, marking a
// reached node unreached, or a World file (no ref) showing nothing; each sheet kind draws it.
test("each node sheet's head names its ref, unwritten and diagnostics counts, and unreached", (t) => {
  const head = (kind: string, arg: string) =>
    nodes(build.sheets[kind].body(arg))
      .filter((e) => e.type === 'Text' && typeof e.props.children === 'string')
      .map((e) => e.props.children)
      .slice(0, 3);
  assert.deepEqual(head('def', 'dialogues/farewell.json'), [
    R('dialogue', 'farewell'),
    '2 unwritten · 0 diagnostics',
    'unreached from the start',
  ]);
  assert.deepEqual(head('def', 'dialogues/greet.json').slice(0, 2), [
    R('dialogue', 'greet'),
    '0 unwritten · 1 diagnostics',
  ]);
  assert.notEqual(head('def', 'dialogues/greet.json')[2], 'unreached from the start');
  assert.deepEqual(head('def', 'cartridge.json')[0], 'cartridge.json');
  assert.equal(
    head('def', 'cartridge.json').join().includes('diagnostics'),
    false,
    'no ref, no counts',
  );
  assert.deepEqual(head('npc', 'nell').slice(0, 2), [
    R('npc', 'nell'),
    '0 unwritten · 0 diagnostics',
  ]);
  assert.deepEqual(head('npc', 'nobody'), [], "another person's head is not hers");
  assert.deepEqual(head('item', 'lamp')[0], R('item', 'lamp'), 'a bundle member: a ref, no file');
  assert.deepEqual(head('room', 'hall').slice(0, 2), [
    R('room', 'hall'),
    '0 unwritten · 0 diagnostics',
  ]);
  const s = known.story;
  t.after(() => (known.story = s)); // a failed assert would leave every later test with no /story
  known.story = undefined;
  assert.notEqual(
    head('def', 'dialogues/farewell.json')[0],
    R('dialogue', 'farewell'),
    'no /story, no head',
  );
});

test('Go there starts in the room a story edge joins the node to, either way: nell to the hall, the cellar to its lamp', async () => {
  await press('nell');
  await press('Go there');
  assert.deepEqual(started, ['hall']);
  await press('lamp');
  await press('Go there');
  assert.deepEqual(started, ['hall', 'cellar']);
});

// Breaks: Flow drawn on a row the walk has no node for, or opening a walk on another ref.
test('Flow on a node row opens its walk; a person, not a node of the walk, has none', async () => {
  await press('nell');
  assert.equal(all('Flow').length, 0);
  await press('farewell · 2 unwritten · unreached');
  await press('Flow');
  assert.equal(top(), `flow:${R('dialogue', 'farewell')}`);
});

const shown = (head: 'knowledge' | 'pacing', arg: string) =>
  nodes(build.sheets[head].body(arg)).flatMap((e) =>
    e.type === 'Text' || e.type === 'Pressable' ? [[e.type, label(e) ?? e.props.children]] : [],
  );
test('Knowledge at beat 2 lists met_nell, set at beat 1, as words: a fact has no sheet', () => {
  assert.deepEqual(shown('knowledge', '2'), [['Text', 'Knows met_nell']]);
});

test('Pacing lists the thin part (under half the median) first, numbered from 1, untitled parts bare', () => {
  assert.deepEqual(shown('pacing', ''), [
    ['Text', 'Part 2 · 0 words · thin'],
    ['Text', 'Part 1 · Arrival · 120 words'],
  ]);
});

const words = (n: any[]) => n.filter((e) => e.type === 'Text').map((e) => e.props.children);
test('one press on the picked beat shuts it and drops the pick; on an open, unpicked beat it only picks', async () => {
  await press('nell'); // a node under open beat 1 picked
  await press('1  Meet Nell');
  assert.deepEqual([all('met_nell').length, all('Retitle').length], [1, 1]);
  await press('1  Meet Nell');
  assert.deepEqual([all('met_nell').length, all('Retitle').length], [0, 0]);
});

test('Bind… folds the binds: shut, none; open, only the shorts beat 1 binds no node of', async () => {
  await press('1  Meet Nell'); // shut: opens and is picked
  const binds = () => sheet().filter((e) => e.type === 'Pressable' && /^Bind /.test(label(e)));
  assert.deepEqual(binds().map(label), []);
  await press('Bind…');
  assert.deepEqual(binds().map(label), ['Bind dialogues/farewell']);
});

test('a story with no outline shows the plain no-story line and no Add beat', () => {
  const s = known.story;
  known.story = { ...story, outline: null } as never;
  try {
    assert.deepEqual([texts().includes('No story yet.'), all('Add beat').length], [true, 0]);
  } finally {
    known.story = s;
  }
});

test('a sheet restored before /story arrives says Nothing here, the tab the refusal then the no-story line', async () => {
  const s = known.story;
  known.story = undefined;
  try {
    assert.deepEqual(words(nodes(story_.storyRows())), ['No story yet.']);
    roomedit.tell('refused: x');
    await settle();
    known.story = undefined; // the refusal's run fetched /story again
    assert.deepEqual(words(nodes(story_.storyRows())), ['refused: x', 'No story yet.']);
    for (const head of ['trace', 'consequences', 'knowledge', 'facts', 'pacing'] as const)
      assert.deepEqual(
        nodes(build.sheets[head].body('1'))
          .filter((e) => e.type === 'Text')
          .map((e) => e.props.children),
        ['Nothing here.'],
        head,
      );
  } finally {
    known.story = s;
  }
});
