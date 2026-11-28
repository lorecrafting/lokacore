// The notebook's Find, Recent and Worlds (author/build/find.tsx, recent.tsx, worlds.tsx; slice 6.3b):
// which press asks which route over the builder's api, and what the answer shows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { known } = await import('./build/room.tsx');
const { ink } = await import('./build/build.ts');
const { findRows, referredBy } = await import('./build/find.tsx');
const { recentRows } = await import('./build/recent.tsx');
const { worldRows } = await import('./build/worlds.tsx');

const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const removed: string[] = [];
let reloads = 0;
Object.assign(globalThis, {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: (k: string) => removed.push(k),
  },
  location: { reload: () => void reloads++ },
});

/** A builder api answering `routes` (GET by path, POST by path); `posts` as sent, `opens` as opened. */
async function opened(routes: Record<string, (sent?: any) => [number, unknown]>) {
  const posts: [string, any][] = [];
  const opens: string[] = [];
  const api = async (path: string, sent?: object): Promise<[number, any]> => {
    if (sent) posts.push([path, sent]);
    if (path === '/story') return [200, { map: [], graph: { nodes: [] }, files: {} }];
    return routes[path]?.(sent) ?? [404, null];
  };
  story(
    api,
    () => {},
    () => {},
    (id) => opens.push(id),
  );
  await settle();
  const press = async (rows: () => unknown[], label: string, ms = 0) => {
    nodes(rows())
      .find((n) => n.props?.accessibilityRole === 'button' && words(n) === label)!
      .props.onPress();
    await settle(ms);
  };
  return { posts, opens, press };
}

// Breaks: the refusal naming the entry's first file (rooms/hall.json) rather than the one the 409
// says changed, or the put-back sending no id or another entry's.
test('a put-back of a changed file shows `<file> changed since; not put back.`', async () => {
  const s = await opened({
    '/journal': () => [
      200,
      [{ id: 7, at: 0, by: 'editor', files: ['rooms/hall.json', 'rooms/loft.json'] }],
    ],
    '/undo': () => [409, { file: 'rooms/loft.json', bytes: '{}', sha256: 'S' }],
  });
  recentRows();
  await settle();
  await s.press(recentRows, 'Put back');
  assert.deepEqual(s.posts, [['/undo', { id: 7 }]]);
  const said = nodes(recentRows()).map(words);
  assert.ok(said.includes('rooms/loft.json changed since; not put back.'), said.join('|'));
});

// Breaks: Find asking for other words than typed, dropping a referrer, or a referrer not opening its
// definition's sheet (a .loka one through POST /open at its key).
test('Find `cellar` lists the two referrers; each opens its sheet', async () => {
  const s = await opened({
    '/find?q=cellar': () => [
      200,
      {
        hits: [{ at: 'rooms/cellar.json:1', text: '"key": "cellar"' }],
        total: 1,
        refs: [
          { kind: 'room', by: 'hall', at: 'rooms/hall.json:4' },
          { kind: 'npc', by: 'rat', at: 'areas/cellar/rat.loka:2' },
        ],
      },
    ],
  });
  const field = nodes(findRows()).find((n) => n.props?.accessibilityLabel === 'key or words')!;
  field.props.onChangeText('cellar');
  await s.press(findRows, 'Find');
  await s.press(findRows, 'hall (room)');
  await s.press(findRows, 'rat (npc)');
  assert.ok(nodes(findRows()).map(words).includes('Lines: 1'));
  assert.deepEqual(s.opens, ['def:rooms/hall.json']);
  assert.deepEqual(s.posts, [['/open', { file: 'areas/cellar/rat.loka', key: 'rat' }]]);
});

// Breaks: a world press posting the current world's key or none, or the Book reloading before
// /world names the picked world, or keeping the world left's place, or a refused GET never asked again,
// or the keys cleared before the POST, or a switch polling with no line or swallowing a press, or a
// sampler among the real worlds or their copies, or the Samples fold open unasked or not toggling
// on a press (worlds.test.ts: open).
test('switching worlds posts the picked key, then reloads once /world names it', async () => {
  let current = 'farm';
  let gets = 0;
  const s = await opened({
    '/world': (sent) =>
      sent
        ? s.posts.length === 1
          ? [409, 'busy']
          : ((current = sent.name), [200, { ok: true }])
        : gets++ === 0
          ? [503, null] // a refusal is asked again on the next draw
          : [
              200,
              {
                current,
                worlds: [
                  { name: 'farm', title: 'Farm' },
                  { name: 'mill', title: 'Mill' },
                  { name: 'cellar_sampler', title: 'Cellar' },
                ],
              },
            ],
  });
  worldRows();
  await settle();
  worldRows();
  await settle();
  const marked = nodes(worldRows()).filter((n) => n.props?.accessibilityState?.selected);
  assert.deepEqual(marked.map(words), ['Farm']);
  const buttons = () =>
    nodes(worldRows())
      .filter((n) => n.props?.accessibilityRole === 'button')
      .map(words);
  const copies = ['New blank world', 'New copy of Farm', 'New copy of Mill'];
  assert.deepEqual(buttons(), ['Farm', 'Mill', 'Samples', ...copies]); // the sampler under the fold, closed
  await s.press(worldRows, 'Samples');
  assert.deepEqual(buttons(), [
    'Farm',
    'Mill',
    'Samples',
    'Cellar',
    ...copies,
    'New copy of Cellar',
  ]);
  await s.press(worldRows, 'Samples');
  assert.deepEqual(buttons(), ['Farm', 'Mill', 'Samples', ...copies]);
  await s.press(worldRows, 'Mill');
  assert.ok(nodes(worldRows()).map(words).includes('busy'));
  assert.equal(reloads, 0);
  assert.deepEqual(removed, []); // the world left's keys go only right before the reload
  await s.press(worldRows, 'Mill');
  assert.ok(nodes(worldRows()).map(words).includes('Opening mill…'));
  await s.press(worldRows, 'Mill'); // a press while it polls is told to wait, not sent
  assert.ok(
    nodes(worldRows()).map(words).includes('One world at a time: wait for this one to open'),
  );
  for (let i = 0; i < 50 && !reloads; i++) await settle(100); // go polls every 300 ms
  assert.deepEqual(s.posts, [
    ['/world', { name: 'mill' }],
    ['/world', { name: 'mill' }],
  ]);
  assert.equal(reloads, 1);
  assert.ok(removed.includes('loka-place'));
});

// Breaks: a put-back that worked still showing a refusal, the outside writer read as you, a Find
// refusal shown as nothing, or a sheet's referrers not asked, not listed, or kept past a new /story.
test("the edges: a clean put-back, an outside entry, a refused Find, a sheet's referrers", async () => {
  const s = await opened({
    '/journal': () => [
      200,
      [
        { id: 9, at: 0, by: 'outside', files: ['rooms/hall.json'] },
        { id: 8, at: 0, by: 'editor', files: ['rooms/hall.json'] },
      ],
    ],
    '/undo': () => [200, { file: 'rooms/hall.json' }],
    '/find?q=nope': () => [500, null],
    '/users?file=rooms%2Fhall.json': () => [200, [{ kind: 'room', by: 'loft' }]],
  });
  recentRows();
  await settle();
  await s.press(recentRows, 'Put back');
  const said = nodes(recentRows()).map(words);
  assert.ok(!said.some((w) => w.includes('not put back')), said.join('|'));
  const first = nodes(recentRows()).find((n) => n.type === 'Text' && words(n).includes(' · '))!;
  assert.match(words(first), / outside · rooms\/hall\.json$/); // entry 9, the outside one
  assert.equal(first.props.style.color, ink('warning'));

  nodes(findRows())
    .find((n) => n.props?.accessibilityLabel === 'key or words')!
    .props.onChangeText('nope');
  await s.press(findRows, 'Find');
  assert.ok(nodes(findRows()).map(words).includes('Find failed: 500'));

  const foot = () => referredBy('rooms/hall.json');
  await s.press(foot, 'Referred to by');
  assert.ok(nodes(foot()).map(words).includes('loft (room)'));
  known.files = {}; // a new /story: asked again
  assert.ok(nodes(foot()).map(words).includes('Referred to by'));
});

// Breaks: the Checks tab drawing another tab's rows (contents.tsx picking it by the wrong index).
test('the Checks tab shows the Checks sheet', async () => {
  const { sheets } = await import('./build/sheet.tsx');
  await import('./build/contents.tsx');
  let drawn = 0;
  sheets.checks = { title: () => '', body: () => void drawn++ };
  await opened({});
  nodes(sheets.contents.body(''))
    .find((n) => n.props?.accessibilityRole === 'button' && words(n) === 'Checks')!
    .props.onPress();
  sheets.contents.body('');
  assert.equal(drawn, 1);
});

// Breaks: the cutscene row listing no files (filesOf matching the kind name, not its `scenes/` directory).
test('the Contents tab lists a cutscene file under New cutscene', async () => {
  const { sheets } = await import('./build/sheet.tsx');
  await import('./build/contents.tsx');
  const { opens, press } = await opened({});
  await press(() => sheets.contents.body(''), 'Contents');
  known.files = { 'scene.x': 'scenes/x.json', 'room.y': 'rooms/y.json' };
  await press(() => sheets.contents.body(''), 'scenes/x.json');
  assert.deepEqual(opens, ['def:scenes/x.json']);
});

// Breaks: a definition sheet with no source footer.
test("a definition sheet's foot names its file", async () => {
  const { sheets } = await import('./build/sheet.tsx');
  await import('./build/generic.tsx');
  assert.equal(sheets.def.file?.('rooms/hall.json'), 'rooms/hall.json');
});
