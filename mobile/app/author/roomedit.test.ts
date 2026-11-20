// The Room sheet's edits (author/build/roomedit.tsx; design §7, slice 2.1): which press sends which
// write-route calls over the builder's api. The gestures' own rules are mapedit's
// (kernel/ts/test/author_mapedit.test.ts) and drop's (author_drop.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');

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
        { map: [hall, loft], graph: { nodes: [{ kind: 'room', ref: 'rooms/room_1' }] } },
      ];
    const file = decodeURIComponent(path.split('file=')[1]) as keyof typeof doc;
    return doc[file] ? [200, { bytes: JSON.stringify(doc[file]), sha256: 'S' }] : [404, null];
  };
  story(api, () => {});
  await settle();
  const shown = () => nodes(sheets.room.body('hall'));
  const press = async (label: string) => {
    shown()
      .find((n) => n.props?.accessibilityRole === 'button' && words(n) === label)!
      .props.onPress();
    await settle();
  };
  return { posts, shown, press };
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

// Breaks: Move sending the root when the field is left as shown, or the typed area ignored.
test('Move to area sends the area as shown, or the typed one; an empty field is the root', async () => {
  const s = await opened();
  await s.press('Move to area');
  const field = () => s.shown().find((n) => n.props?.accessibilityLabel === 'Area');
  field().props.onChangeText(' cellar ');
  await s.press('Move to area');
  field().props.onChangeText('');
  await s.press('Move to area');
  assert.deepEqual(
    s.posts.map(([, sent]) => sent.area),
    ['yard', 'cellar', null],
  );
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
  await s.press('Keep');
  assert.equal(s.posts.length, 1);
  await s.press('Delete hall');
  await s.press('Delete all');
  assert.deepEqual(s.posts.at(-1)![1].also, { 'rooms/loft.json': 'L' });
  assert.equal(words(alert()), 'start still names hall');
  delete (doc as Record<string, unknown>)['rooms/hall.json'];
  await s.press('Delete hall');
  assert.equal(words(alert()), 'rooms/hall.json: not found');
});
