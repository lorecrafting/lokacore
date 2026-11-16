// The panel's New glue (tools/author-panel/src/mapwire.ts): which key and kind it asks /__author
// to make, and which card it selects. The network is stubbed: it records each POST and says yes (a
// map edit's own writes are kernel/ts/test/author_mapedit.test.ts's).
import assert from 'node:assert/strict';
import { test } from 'node:test';
// A non-literal path: this node-typed project would otherwise type-check the browser modules.
const wire: string = '../src/mapwire.ts';
const { created, mapCommand, shown } = await import(wire);

let posts: object[] = [];
const picks: object[] = [];
const g = globalThis as Record<string, unknown>;
const alerts: string[] = [];
g.alert = (m: string) => void alerts.push(m);
let answer: string | null = null;
g.prompt = () => answer;
g.fetch = async (url: string, init?: { body?: string }) => {
  if (init?.body) posts.push(JSON.parse(init.body));
  const again = init?.body?.includes('"layout"'); // its file is there: the starter reruns, writing nothing
  const made = { id: 1, files: again ? [] : ['npcs/npc_3.json'], bytes: '{}', sha256: '' };
  const held = [
    { dir: 'npcs', key: 'npc_1' },
    { dir: 'items', key: 'item_1' },
  ];
  return new Response(JSON.stringify(url.endsWith('/templates') ? held : made));
};
shown.pick = (p: object) => void picks.push(p);
shown.nodes = [{ kind: 'scene', ref: 'scene/cutscene_1' }];

// Breaks: a palette kind keyed against its own name instead of its graph kind (a cutscene is a
// `scene` node, so cutscene_1 is reused), templates not skipped for items, an outline or layout renamed,
// a text key generated (it would merge into a held one) or selected (no node holds it), a cancelled
// prompt still sent, or a rerun on an existing file taken for a new card.
test('palette New picks the graph kind, skips templates, keeps fixed names and asks for a text key', async () => {
  await created('cutscene');
  await created('npcs');
  await created('items');
  await created('outline');
  await created('layout');
  await created('behaviours'); // the prompt cancelled
  answer = 'hello';
  await created('text');
  answer = null;
  assert.deepEqual(posts, [
    { kind: 'cutscene', name: 'cutscene_2' },
    { kind: 'npcs', name: 'npc_2' },
    { kind: 'items', name: 'item_2' },
    { kind: 'outline', name: 'outline' },
    { kind: 'layout', name: 'layout' },
    { kind: 'text', name: 'hello' },
  ]);
  assert.deepEqual(picks, [
    { kind: 'scene', key: 'cutscene_2' },
    { kind: 'npc', key: 'npc_2' },
    { kind: 'item', key: 'item_2' },
  ]);
  assert.deepEqual(alerts, ['layout already exists']);
});

const first = async (id: string, dir?: string) => {
  posts = [];
  picks.length = 0;
  assert.equal(await new Promise((told) => ((shown.tell = told), mapCommand(id, 'r', dir))), '');
  return [posts[0], picks];
};

// Breaks: New NPC here asks for an item (or the reverse); either leaves its card unselected; New
// room from here falls to the barrier path (its prompt answers nothing, so the test times out).
test(
  'New NPC here makes and selects npc_3 (past template npc_1, minted npc_2), New room from here selects room_1',
  { timeout: 5000 },
  async () => {
    shown.rooms = [{ ref: 'r', key: 'r', file: 'rooms/r.json', area: null, title: 'r', exits: [] }];
    assert.deepEqual(await first('map-npc'), [
      { kind: 'npcs', name: 'npc_3' },
      [{ kind: 'npc', key: 'npc_3' }],
    ]);
    assert.deepEqual(await first('map-grow', 'east'), [
      { kind: 'rooms', name: 'room_1', from: { room: 'r', direction: 'east' } },
      [{ kind: 'room', key: 'room_1' }],
    ]);
  },
);
