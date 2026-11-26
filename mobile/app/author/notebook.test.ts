// The notebook's Find, Recent and Worlds (author/build/find.tsx, recent.tsx, worlds.tsx; slice 6.3b):
// which press asks which route over the builder's api, and what the answer shows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { findRows } = await import('./build/find.tsx');
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
// definition's sheet.
test('Find `cellar` lists the two referrers; each opens its sheet', async () => {
  const s = await opened({
    '/find?q=cellar': () => [
      200,
      {
        hits: [{ at: 'rooms/cellar.json:1', text: '"key": "cellar"' }],
        total: 1,
        refs: [
          { kind: 'room', by: 'hall', at: 'rooms/hall.json:4' },
          { kind: 'npc', by: 'rat', at: 'npcs/rat.json:2' },
        ],
      },
    ],
  });
  const field = nodes(findRows()).find((n) => n.props?.accessibilityLabel === 'key or words')!;
  field.props.onChangeText('cellar');
  await s.press(findRows, 'Find');
  await s.press(findRows, 'hall (room)');
  await s.press(findRows, 'rat (npc)');
  assert.deepEqual(s.opens, ['def:rooms/hall.json', 'def:npcs/rat.json']);
});

// Breaks: a world press posting the current world's key or none, or the Book reloading before
// /world names the picked world, or keeping the world left's place.
test('switching worlds posts the picked key, then reloads once /world names it', async () => {
  let current = 'farm';
  const s = await opened({
    '/world': (sent) =>
      sent
        ? ((current = sent.name), [200, { ok: true }])
        : [
            200,
            {
              current,
              worlds: [
                { name: 'farm', title: 'Farm' },
                { name: 'mill', title: 'Mill' },
              ],
            },
          ],
  });
  worldRows();
  await settle();
  await s.press(worldRows, 'Mill');
  for (let i = 0; i < 50 && !reloads; i++) await settle(100); // go polls every 300 ms
  assert.deepEqual(s.posts, [['/world', { name: 'mill' }]]);
  assert.equal(reloads, 1);
  assert.ok(removed.includes('loka-place'));
});
