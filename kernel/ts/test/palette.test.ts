import assert from 'node:assert/strict';
import { test } from 'node:test';
import { items, rank, words } from '../play/palette.ts';

const HUT = 'demo@1:room/hut';
const NODES = [HUT, 'demo@1:room/barn', 'demo@1:npc/hut_keeper'].map((ref) => ({
  ref,
  kind: ref.split(/[:/]/)[1],
}));

// Breaks: Cmd-K misses a definition key, a text key /find returns or a `~`, takes a definition
// file's line for a text key, ranks a mere detail match over a name, lists a `~` twice (once as
// text), `~` does not narrow to the unwritten, or the three tiers lose their order.
test('Cmd-K finds a key, a text key`s words and a `~`, and lists the commands', () => {
  const text = words([
    { at: 'text.json:2', text: '"room.hut.title": "A hut.",' },
    { at: 'text.json:3', text: '"room.barn.title": "~"' },
    { at: 'rooms/hut.json:2', text: '"name": "room.hut.title",' },
    { at: 'text.json:1', text: '{' },
  ]);
  assert.deepEqual(text, { 'room.hut.title': 'A hut.', 'room.barn.title': '~' });
  const all = items(NODES, text, { 'room.barn.title': 'a.loka:3' });
  assert.deepEqual(
    rank('hut', all).map((i) => [i.kind, i.id]),
    [
      ['key', HUT],
      ['key', 'demo@1:npc/hut_keeper'],
      ['text', 'room.hut.title'],
    ],
  );
  assert.deepEqual(
    rank('barn', all).map((i) => [i.kind, i.id]),
    [
      ['key', 'demo@1:room/barn'],
      ['todo', 'room.barn.title'],
    ],
  );
  assert.deepEqual(
    rank('~', all).map((i) => [i.kind, i.id, i.detail]),
    [['todo', 'room.barn.title', 'a.loka:3']],
  );
  assert.deepEqual(
    rank('go to', all).map((i) => [i.kind, i.id]),
    [['command', 'go']],
  );
  const row = (label: string, detail: string) => ({
    kind: 'key' as const,
    label,
    detail,
    id: label,
  });
  const tiers = [row('a', 'hut.loka'), row('the hut', ''), row('hut', ''), row('b', '')];
  assert.deepEqual(
    rank('hut', tiers).map((i) => i.id),
    ['hut', 'the hut', 'a'],
    'a name starting with it, then one holding it, then a detail; input order is the reverse',
  );
});
