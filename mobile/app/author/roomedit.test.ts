// The Room sheet's edits (author/build/roomedit.tsx; design §7, slice 2.1): which press sends which
// write-route calls over the builder's api. The gestures' own rules are mapedit's
// (kernel/ts/test/author_mapedit.test.ts) and drop's (author_drop.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');
const { foot, io, wire } = await import('./build/roomedit.tsx');
const { thingPen } = await import('./build/thing.tsx');
await import('./build/contents.tsx');
const { storySheet } = await import('./build/story.tsx');

const room = (key: string, exits: { dir: string; to: string }[], area: string | null = 'yard') => ({
  ref: key,
  key,
  file: `rooms/${key}.json`,
  area,
  title: key,
  exits,
});
const hall = room('hall', [{ dir: 'north', to: 'loft' }]);
const loft = room('loft', [{ dir: 'south', to: 'hall' }]);
const doc = {
  'rooms/hall.json': { exits: { north: { to: 'loft' } } },
  'rooms/loft.json': { exits: { south: { to: 'hall' } } },
  'npcs/hen.json': { room: 'hall' },
  'npcs/npc_1.json': {},
  'items/cup.json': { location: { in: 'room', room: 'hall' } },
};
const settle = () => new Promise((r) => setTimeout(r));

/** A builder api: /story's map, each file's source, `answer` for the posts; `posts` as sent. */
async function opened(
  answer: (path: string, sent: any) => [number, unknown] = () => [200, { id: 1 }],
) {
  const posts: [string, any][] = [];
  const api = async (path: string, sent?: object): Promise<[number, any]> => {
    if (sent) return (posts.push([path, sent]), answer(path, sent));
    if (path === '/story')
      return [
        200,
        {
          map: [hall, loft],
          graph: {
            nodes: [
              { kind: 'room', ref: 'rooms/room_1' },
              { kind: 'room', ref: 's:room/loft' },
              { kind: 'npc', ref: 's:npc/cat' }, // no file: a sheet must find hen's own node
              { kind: 'npc', ref: 's:npc/hen' },
              { kind: 'item', ref: 's:item/cup' },
            ],
          },
          files: {
            's:room/hall': 'rooms/hall.json',
            's:npc/hen': 'npcs/hen.json',
            's:item/cup': 'items/cup.json',
            's:npc/goat': 'areas/yard/npcs/goat.json',
            's:dialogue/hen': 'dialogues/hen.scene',
          },
        },
      ];
    if (path === '/find?q=hen')
      // two definitions name the person hen, one an item hen; hen's own ref and the layout row leave nothing dangling
      return [
        200,
        {
          refs: [
            { kind: 'npc' },
            { kind: 'item' },
            { kind: 'npc' },
            { kind: 'npc', by: 'npcs/hen' },
            { kind: 'npc', by: 'layout' },
          ],
        },
      ];
    if (path === '/templates')
      return [
        200,
        [
          { dir: 'npcs', key: 'goose' },
          { dir: 'items', key: 'item_1' }, // an item template's key: a new item is item_2
        ],
      ];
    const file = decodeURIComponent(path.split('file=')[1]) as keyof typeof doc;
    return doc[file] ? [200, { bytes: JSON.stringify(doc[file]), sha256: 'S' }] : [404, null];
  };
  const closed: string[] = [];
  const opens: string[] = [];
  story(
    api,
    () => {},
    (id) => closed.push(id),
    (id) => opens.push(id),
  );
  await settle();
  let sheet = () => sheets.room.body('hall');
  const shown = () => nodes(sheet());
  const on = (next: () => unknown) => void (sheet = next as typeof sheet);
  const press = async (label: string) => {
    shown()
      .find((n) => n.props?.accessibilityRole === 'button' && words(n) === label)!
      .props.onPress();
    await settle();
  };
  return { posts, shown, press, closed, opens, on };
}

// Breaks: a `＋` on a side that has an exit, a new room taking a key the graph holds or outside this
// room's area, a second press while one runs sending a second room, or One-way and Delete swapped.
test('＋ grows a new room on a free side only; One-way and Delete reach their own legs', async () => {
  const s = await opened();
  const plus = s
    .shown()
    .filter((n) => n.props?.accessibilityRole === 'button' && words(n).startsWith('＋'));
  assert.deepEqual(plus.map(words), ['＋ south', '＋ east', '＋ west', '＋ up', '＋ down']);
  void s.press('＋ east');
  await s.press('＋ east');
  const from = { room: 'hall', direction: 'east' };
  assert.deepEqual(s.posts, [['/new', { kind: 'rooms', name: 'room_2', from, area: 'yard' }]]);
  const changed = () => s.posts.splice(0).map(([path, sent]) => `${path} ${sent.file}`);
  changed();
  await s.press('One-way');
  assert.deepEqual(changed(), ['/change rooms/loft.json']);
  await s.press('Delete');
  assert.deepEqual(changed(), ['/change rooms/hall.json', '/change rooms/loft.json']);
});

// Breaks: Door or Lock naming the barrier on one face only, Lock leaving the barrier closed, or either
// offered on an exit with no way back (mapedit `barrier` refuses it).
test('Door and Lock name a new barrier on both faces; Lock starts it locked; one-way greys both', async () => {
  const made = (path: string, b: any): [number, unknown] =>
    path === '/new' ? [200, { files: [`areas/yard/barriers/${b.name}.json`] }] : [200, { id: 1 }];
  const s = await opened(made);
  const sent = () => s.posts.splice(0).map(([path, b]) => [path, b.file ?? b.name, b.ops]);
  await s.press('Door');
  const faces = [
    ['/change', 'rooms/hall.json', [{ path: ['exits', 'north', 'barrier'], value: 'barrier_1' }]],
    ['/change', 'rooms/loft.json', [{ path: ['exits', 'south', 'barrier'], value: 'barrier_1' }]],
  ];
  assert.deepEqual(sent(), [['/new', 'barrier_1', undefined], ...faces]);
  (doc as Record<string, object>)['areas/yard/barriers/barrier_2.json'] = {}; // the new barrier's source
  await s.press('Lock');
  const locked = [{ path: ['initial'], value: 'locked' }];
  const two = (o: unknown) => (o as object[]).map((x) => ({ ...x, value: 'barrier_2' }));
  assert.deepEqual(sent(), [
    ['/new', 'barrier_2', undefined],
    ['/change', 'areas/yard/barriers/barrier_2.json', locked],
    ...faces.map(([p, f, o]) => [p, f, two(o)]),
  ]);
  hall.exits[0].to = 'nowhere'; // no way back
  try {
    const door = s
      .shown()
      .find((n) => n.props?.accessibilityRole === 'button' && words(n).startsWith('Door'));
    assert.equal(door.props.accessibilityState?.disabled, true);
  } finally {
    hall.exits[0].to = 'loft';
  }
});

// Breaks: the header dropping dark, counting a variant that is absent, or a dark word that opens no Fields.
test('the header reads dark · 1 exit for a dark one-exit room; dark opens its Fields', async () => {
  const was = doc['rooms/hall.json'];
  (doc as Record<string, object>)['rooms/hall.json'] = { ...was, dark: true };
  try {
    const s = await opened();
    s.shown(); // the first draw reads the source
    await settle();
    const head = s.shown().find((n) => n.key === 'summary');
    assert.equal(words(head), 'dark · 1 exit');
    await s.press('dark');
    await s.press('Fields');
    assert.deepEqual(s.opens, ['def:rooms/hall.json', 'def:rooms/hall.json']);
  } finally {
    doc['rooms/hall.json'] = was;
  }
});

// Breaks: a placed room offering `＋` toward a cell another placed room holds (the server would set
// the new room elsewhere on the level, not that way).
test('a placed room offers no ＋ toward a held cell', async () => {
  Object.assign(hall, { at: { x: 0, y: 0, z: 0 } });
  Object.assign(loft, { at: { x: 1, y: 0, z: 0 } }); // east of hall
  const s = await opened();
  const plus = s
    .shown()
    .filter((n) => n.props?.accessibilityRole === 'button' && words(n).startsWith('＋'));
  delete (hall as { at?: unknown }).at;
  delete (loft as { at?: unknown }).at;
  assert.deepEqual(plus.map(words), ['＋ south', '＋ west', '＋ up', '＋ down']);
});

// Breaks: Move sending the root when the field is left as shown, the typed area ignored, or a
// redrawn field showing the room's area while Move sends the old draft.
test('Move to area sends the area as shown, or the typed one; an empty field is the root', async () => {
  const s = await opened();
  await s.press('Move to area');
  const field = () => s.shown().find((n) => n.props?.accessibilityLabel === 'Area');
  field().props.onChangeText(' cellar ');
  assert.equal(field().props.defaultValue, ' cellar '); // the sheet drawn again shows what Move sends
  await s.press('Move to area');
  field().props.onChangeText('');
  await s.press('Move to area');
  assert.deepEqual(
    s.posts.map(([, sent]) => sent.area),
    ['yard', 'cellar', null],
  );
});

const made = (path: string): [number, unknown] =>
  path === '/new' ? [200, { files: ['npcs/npc_1.json'] }] : [200, { id: 1 }];

// Breaks: Add here making the person outside this room (no `room`, another room, no area), under
// a key the graph holds or an item under an item template's key, or not opening the sheet.
test('Add here makes a person in this room under a free key and opens its sheet', async () => {
  const s = await opened(made);
  await s.press('Person');
  assert.deepEqual(s.posts[0], ['/new', { kind: 'npcs', name: 'npc_1', area: 'yard' }]);
  assert.equal(s.posts[1][0], '/change');
  assert.equal(s.posts[1][1].file, 'npcs/npc_1.json');
  assert.deepEqual(s.posts[1][1].ops, [{ path: ['room'], value: 'hall' }]);
  assert.deepEqual(s.opens, ['npc:npc_1']);
  s.shown(); // asks /templates
  await settle();
  await s.press('Item');
  assert.equal(s.posts[2][1].name, 'item_2');
});

// Breaks: a template's act missing from Add here, or making a plain person instead of the
// template's child (no `extends`, a key not the template's).
test("Add here offers each template, whose act makes the template's child here", async () => {
  const s = await opened(made);
  s.shown(); // asks /templates
  await settle();
  await s.press('goose');
  assert.deepEqual(s.posts[0], [
    '/new',
    { kind: 'npcs', name: 'goose_1', area: 'yard', extends: 'goose' },
  ]);
});

// Breaks: Move writing a holder no compiled node holds (or an empty one), a person's move writing
// anything but its `room`, the sheet showing another person's node, an item's holder kinds, the
// field not holding today's room, or the sheet not reading the file again after the move.
test("a person's sheet refuses a room no node holds without writing, and moves to one that is", async () => {
  const hen = doc['npcs/hen.json'];
  const s = await opened(
    (path) => ((doc['npcs/hen.json'] = { room: 'loft' }), [200, { id: path }]),
  );
  s.on(() => sheets.npc.body('hen'));
  s.shown(); // reads its source
  await settle();
  const field = () => s.shown().find((n) => n.props?.accessibilityLabel === 'Room');
  assert.equal(field().props.defaultValue, 'hall');
  assert.ok(!s.shown().some((n) => words(n) === 'Person'), 'a person has no holder kinds');
  await s.press('Move'); // nothing typed
  assert.ok(!s.shown().some((n) => n.props?.accessibilityRole === 'alert'));
  field().props.onChangeText('attic');
  await s.press('Move');
  assert.deepEqual(s.posts, []);
  assert.ok(s.shown().some((n) => words(n).includes('no room attic')));
  field().props.onChangeText('loft');
  await s.press('Move');
  assert.deepEqual(
    s.posts.map(([path, sent]) => [path, sent.file, sent.ops]),
    [['/change', 'npcs/hen.json', [{ path: ['room'], value: 'loft' }]]],
  );
  s.shown(); // read again under the move's /story
  await settle();
  assert.ok(s.shown().some((n) => words(n) === 'Room · loft'));
  doc['npcs/hen.json'] = hen;
});

// Breaks: Delete placement deleting the wrong field (a person's `location`, an item's `room`) or
// still offered once nothing places it; Fields opening a file other than the sheet's own.
test("Delete placement drops a person's room and an item's location; Fields opens the sheet's file", async () => {
  const was = { ...doc };
  const s = await opened(
    (path, sent: any) => ((doc[sent.file as 'npcs/hen.json'] = {}), [200, { id: path }]),
  );
  const unput = () => s.shown().some((n) => words(n) === 'Delete placement');
  for (const [kind, key] of [
    ['npc', 'hen'],
    ['item', 'cup'],
  ] as const) {
    s.on(() => sheets[kind].body(key));
    s.shown();
    await settle();
    await s.press('Delete placement');
    await s.press('Fields');
    s.shown(); // read again under the delete's /story
    await settle();
    assert.ok(!unput(), `${key} placed nowhere offers no Delete placement`);
  }
  assert.deepEqual(
    s.posts.map(([path, sent]) => [path, sent.file, sent.ops]),
    [
      ['/change', 'npcs/hen.json', [{ path: ['room'], delete: true }]],
      ['/change', 'items/cup.json', [{ path: ['location'], delete: true }]],
    ],
  );
  assert.deepEqual(s.opens, ['def:npcs/hen.json', 'def:items/cup.json']);
  Object.assign(doc, was);
});

// Breaks: the count taking every ref to the key (another kind's, its own, the layout row's) or none, a failed /find
// showing a count, or a deleted person's sheet or its definition's left open.
test("a person's Delete names its referrers; with /find failing it shows no count", async () => {
  const s = await opened(() => [200, {}]);
  s.on(() => sheets.npc.body('hen'));
  s.shown();
  await settle();
  await s.press('Delete hen · 2 referrers');
  assert.deepEqual(
    s.posts.map(([path, sent]) => [path, sent.file]),
    [['/delete', 'npcs/hen.json']],
  );
  assert.deepEqual(s.closed, ['npc:hen', 'def:npcs/hen.json']);
  s.on(() => sheets.item.body('cup')); // /find answers 404 for cup
  s.shown();
  await settle();
  assert.ok(s.shown().some((n) => words(n) === 'Delete cup'));
});

// Breaks: the pencil after a person's or item's name opening another sheet, or one after a room's
// own title (the Room pencil's) or another field of the person opening a person's.
test("the pencil after a person's name opens that person's sheet; no other key gets one", () => {
  const opened: string[] = [];
  const pen = thingPen('npc.hen.name', (id) => opened.push(id)) as any;
  pen.props.onPress({ stopPropagation() {} });
  (thingPen('item.cup.name', (id) => opened.push(id)) as any).props.onPress({
    stopPropagation() {},
  });
  assert.deepEqual(opened, ['npc:hen', 'item:cup']);
  assert.equal(
    thingPen('room.hall.title', () => {}),
    undefined,
  );
  assert.equal(
    thingPen('npc.hen.description', () => {}),
    undefined,
    'only the name',
  );
});

// Breaks: Contents' New making a named kind under a free key or an item under an item template's
// key, a new person or item not opening its sheet, or a named kind's opening one.
test("Contents' New makes a person under a free key and opens it; a named kind needs its name", async () => {
  const s = await opened(made);
  s.on(() => sheets.contents.body(''));
  await s.press('New text');
  await s.press('New npcs');
  const [[path, sent], ...more] = s.posts; // New text, unnamed, sent nothing
  assert.deepEqual([path, sent.kind, more], ['/new', 'npcs', []]);
  assert.match(sent.name, /^npc_\d+$/); // free: the key Add here made before is taken
  s.shown()
    .find((n) => n.props?.accessibilityLabel === 'text')
    .props.onChangeText('intro');
  await s.press('New text'); // a named kind made: no sheet opens
  await s.press('New items');
  assert.deepEqual(
    s.posts.slice(1).map(([, sent]) => sent.name),
    ['intro', 'item_3'], // item_2 is Add here's
  );
  assert.deepEqual(s.opens, [`npc:${sent.name}`, 'item:item_3']);
});

// Breaks: Contents listing no file, a file under the wrong kind (an area's by `areas`), a `.scene`
// (no schema sheet), or a file row not opening its `def:<file>` sheet.
test("Contents lists each kind's JSON files after its New; a file opens its sheet", async () => {
  const s = await opened();
  s.on(() => sheets.contents.body(''));
  const labels = s
    .shown()
    .filter((n) => n.props?.accessibilityRole === 'button')
    .map(words);
  const after = (w: string) => labels[labels.indexOf(w) + 1];
  assert.deepEqual(
    [after('New npcs'), after('areas/yard/npcs/goat.json'), after('New dialogues')],
    ['areas/yard/npcs/goat.json', 'npcs/hen.json', 'New emotes'],
  );
  await s.press('npcs/hen.json');
  assert.deepEqual(s.opens.at(-1), 'def:npcs/hen.json');
});

// Breaks: a room file's Go to missing, naming a room the file does not define, or not starting there.
test("Contents' room file offers Go to each room it defines", async () => {
  const gone: string[] = [];
  storySheet((room) => void gone.push(room));
  const s = await opened();
  s.on(() => sheets.contents.body(''));
  const labels = s
    .shown()
    .filter((n) => n.props?.accessibilityRole === 'button')
    .map(words);
  assert.deepEqual(
    labels.filter((w) => w.startsWith('Go to ')),
    ['Go to hall'], // rooms/hall.json holds hall; loft's file is not a node's
  );
  await s.press('Go to hall');
  assert.deepEqual(gone, ['hall']);
});

// Breaks: the other files a delete takes sent without asking, a Keep still deleting, or a refusal
// (the route's, or a source that cannot be read) not shown in the sheet.
test('Delete room asks in the sheet about the files it also takes; refusals show', async () => {
  let n = 0;
  const set = { set: [{ file: 'rooms/loft.json', sha256: 'L' }] };
  const s = await opened(() => (++n === 3 ? [400, 'start still names hall'] : [409, set]));
  const alert = () => s.shown().find((n) => n.props?.accessibilityRole === 'alert');
  await s.press('Delete hall');
  assert.ok(words(s.shown()).includes('Also deletes rooms/loft.json'));
  assert.ok(!words(nodes(sheets.room.body('loft'))).includes('Also deletes')); // hall's question
  await s.press('Keep');
  assert.equal(s.posts.length, 1);
  await s.press('Delete hall');
  await s.press('Delete all');
  assert.deepEqual(s.posts.at(-1)![1].also, { 'rooms/loft.json': 'L' });
  assert.equal(words(alert()), 'start still names hall');
  delete (doc as Record<string, unknown>)['rooms/hall.json'];
  await s.press('Delete hall');
  assert.equal(words(alert()), 'rooms/hall.json: not found');
  const bare = nodes(foot('hall', undefined, 'room:hall')).find(
    (n) => n.props?.accessibilityRole === 'button' && words(n) === 'Delete hall',
  );
  bare!.props.onPress();
  await settle();
  assert.equal(words(alert()), 'hall: no source file');
});

// Breaks: a Delete question left unanswered locking every later press (the code-review lock), the
// press that answers it Keep being spent, a deleted room's sheet or its definition's left open (or another closed),
// or a Keep closing it.
test('a confirmed delete closes its own sheet; another press answers a pending question Keep and goes on', async () => {
  let deletes = 0;
  const set = { set: [{ file: 'rooms/loft.json', sha256: 'L' }] };
  const s = await opened((path) =>
    path !== '/delete' ? [200, { id: 1 }] : ++deletes === 3 ? [200, { id: 2 }] : [409, set],
  );
  (doc as Record<string, unknown>)['rooms/hall.json'] = { exits: { north: { to: 'loft' } } };
  await s.press('Delete hall');
  await s.press('One-way'); // answers Keep, then goes on
  assert.ok(!words(s.shown()).includes('Also deletes rooms/loft.json'));
  assert.deepEqual(
    s.posts.map(([path]) => path),
    ['/delete', '/change'],
  );
  assert.deepEqual(s.closed, []);
  await s.press('Delete hall');
  await s.press('Delete all');
  assert.deepEqual(s.closed, ['room:hall', 'def:rooms/hall.json']);
});

// Breaks: a /story that does not answer 200 (a compile error) leaving a refusal or a Delete
// question undrawn.
test('the sheet redraws when /story fails', async () => {
  let drew = 0;
  story(
    async () => [500, null],
    () => drew++,
    () => {},
  );
  await settle();
  assert.equal(drew, 1);
});

// Breaks: a 3xx answer (not a write) taken as a saved write.
test('io: only a 2xx answer is ok', async () => {
  const at = (status: number) => (
    wire(
      async () => [status, null],
      () => {},
      () => {},
    ),
    io.post('move', {})
  );
  assert.deepEqual(
    [(await at(299)).ok, (await at(300)).ok, (await at(200)).ok, (await at(199)).ok],
    [true, false, true, false],
  );
});
