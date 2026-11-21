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
};
const settle = () => new Promise((r) => setTimeout(r));

/** A builder api: /story's map, each file's source, `answer` for the posts; `posts` as sent. */
async function opened(answer: (path: string) => [number, unknown] = () => [200, { id: 1 }]) {
  const posts: [string, any][] = [];
  const api = async (path: string, sent?: object): Promise<[number, any]> => {
    if (sent) return (posts.push([path, sent]), answer(path));
    if (path === '/story')
      return [
        200,
        {
          map: [hall, loft],
          graph: {
            nodes: [
              { kind: 'room', ref: 'rooms/room_1' },
              { kind: 'room', ref: 's:room/loft' },
              { kind: 'npc', ref: 's:npc/hen' },
            ],
          },
          files: { 's:npc/hen': 'npcs/hen.json' },
        },
      ];
    if (path === '/templates') return [200, [{ dir: 'npcs', key: 'goose' }]];
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

// Breaks: Add here making the person outside this room (no `room`, another room, no area) or under
// a key the graph holds, or not opening the new person's sheet.
test('Add here makes a person in this room under a free key and opens its sheet', async () => {
  const s = await opened(made);
  await s.press('Person');
  assert.deepEqual(s.posts[0], ['/new', { kind: 'npcs', name: 'npc_1', area: 'yard' }]);
  assert.equal(s.posts[1][0], '/change');
  assert.equal(s.posts[1][1].file, 'npcs/npc_1.json');
  assert.deepEqual(s.posts[1][1].ops, [{ path: ['room'], value: 'hall' }]);
  assert.deepEqual(s.opens, ['npc:npc_1']);
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

// Breaks: Move writing a holder no compiled node holds, or a person's move writing anything but
// its `room`.
test("a person's sheet refuses a room no node holds without writing, and moves to one that is", async () => {
  const s = await opened();
  s.on(() => sheets.npc.body('hen'));
  s.shown(); // reads its source
  await settle();
  const field = () => s.shown().find((n) => n.props?.accessibilityLabel === 'Room');
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
});

// Breaks: the pencil after a person's name opening another sheet, or one after a room's own title
// bound key (the Room pencil's) opening a person's.
test("the pencil after a person's name opens that person's sheet; no other key gets one", () => {
  const opened: string[] = [];
  const pen = thingPen('npc.hen.name', (id) => opened.push(id)) as any;
  pen.props.onPress({ stopPropagation() {} });
  assert.deepEqual(opened, ['npc:hen']);
  assert.equal(
    thingPen('room.hall.title', () => {}),
    undefined,
  );
});

// Breaks: Contents' New making a named kind under a free key, or a new person not opening its sheet.
test("Contents' New makes a person under a free key and opens it; a named kind needs its name", async () => {
  const s = await opened(made);
  s.on(() => sheets.contents.body(''));
  await s.press('New text');
  await s.press('New npcs');
  const [[path, sent], ...more] = s.posts; // New text, unnamed, sent nothing
  assert.deepEqual([path, sent.kind, more], ['/new', 'npcs', []]);
  assert.match(sent.name, /^npc_\d+$/); // free: the key Add here made before is taken
  assert.deepEqual(s.opens, [`npc:${sent.name}`]);
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
  const bare = nodes(foot({ ...hall, file: undefined })).find(
    (n) => n.props?.accessibilityRole === 'button' && words(n) === 'Delete hall',
  );
  bare!.props.onPress();
  await settle();
  assert.equal(words(alert()), 'hall: no source file');
});

// Breaks: a Delete question left unanswered locking every later press (the code-review lock), the
// press that answers it Keep being spent, a deleted room's sheet left open (or another closed),
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
  assert.deepEqual(s.closed, ['room:hall']);
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
