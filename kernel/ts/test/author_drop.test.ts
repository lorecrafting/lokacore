// Delete's route sequence (kernel/ts/play/drop.ts) over a scripted Io: what it posts and what it
// returns. The /delete route itself is write.ts's, tested in author_write.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drop } from '../play/drop.ts';

/** An Io answering each post from `answers` in turn; `posts` records what was sent. */
function scripted(...answers: { ok: boolean; told: unknown }[]) {
  const posts: [string, object][] = [];
  const io = {
    post: async (route: string, sent: object) => (posts.push([route, sent]), answers.shift()!),
    source: async () => ({ bytes: '{}', sha256: 'S' }),
  };
  return { io, posts };
}

test("a root file's row is deleted by key, an area file by its path alone", async () => {
  // Breaks: the key sent for an own-file delete (write.ts then takes it as a row) or left off a row's.
  const root = scripted({ ok: true, told: {} });
  assert.equal(await drop(root.io, 'rat', 'npcs.json', () => true), '');
  const own = scripted({ ok: true, told: {} });
  await drop(own.io, 'hall', 'rooms/hall.json', () => true);
  assert.deepEqual(
    [...root.posts, ...own.posts],
    [
      ['delete', { file: 'npcs.json', was: 'S', key: 'rat' }],
      ['delete', { file: 'rooms/hall.json', was: 'S' }],
    ],
  );
});

test('the other files a delete takes are asked about once, then sent with their shas', async () => {
  // Breaks: a second try without `also`, one sent when declined, or a refusal shown as done.
  const set = { set: [{ file: 'rooms/b.json', sha256: 'B' }] };
  const asked: string[][] = [];
  const yes = scripted({ ok: false, told: set }, { ok: false, told: 'b still names it' });
  const why = await drop(yes.io, 'a', 'rooms/a.json', (files) => (asked.push(files), true));
  assert.deepEqual(asked, [['rooms/b.json']]);
  assert.deepEqual(yes.posts[1], [
    'delete',
    { file: 'rooms/a.json', was: 'S', also: { 'rooms/b.json': 'B' } },
  ]);
  assert.equal(why, 'b still names it');
  const no = scripted({ ok: false, told: set });
  assert.equal(await drop(no.io, 'a', 'rooms/a.json', () => false), '');
  assert.equal(no.posts.length, 1);
});
