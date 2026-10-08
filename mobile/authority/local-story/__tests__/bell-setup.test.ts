// The bell tests' shared real-SQLite story: the v015 chapter, its ids and the Q2/Q3 routes.
import assert from 'node:assert/strict';
import { read } from '../../../../kernel/ts/test/read.ts';
import { elapsedHost } from './elapsed-host.test.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../../kernel/ts/src/index.ts';

export const bundle = read('protocol/fixtures/missing_child_v015_hash.json');
export const ids = read('protocol/fixtures/missing_child_v015_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok);
export const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);

export function setup(path: string) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    if (action_key === 'continue')
      input = { scene: view().scene!.scene, line: view().scene!.index };
    const r = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
    return r;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string) =>
    ok('choose', [], { continuation_id: view().choice!.continuation_id, choice_id });
  const search = () => {
    ok('elspeth', [ids['npc/elspeth']]);
    choose('accept');
    move('north', 'north');
    ok('take', [ids['item/fox_drawing']]);
    move('south', 'south');
    ok('a_elspeth_report', [ids['npc/elspeth']]);
    choose('report');
    move('south', 'south');
    ok('study_tracks');
  };
  const belfry = () => {
    move('north', 'north', 'north', 'north', 'north', 'north', 'north');
    ok('a_aldric_offer', [ids['npc/aldric']]);
    choose('accept');
    move('up', 'up');
  };
  const row = (section: string, key: string) =>
    a.sql.prepare('SELECT value FROM state_row WHERE section=? AND key=?').get(section, key);
  const rows = (section: string) =>
    a.sql
      .prepare('SELECT key,value FROM state_row WHERE section=?')
      .all(section)
      .map((r) => ({ key: r.key as string, value: JSON.parse(r.value as string) }));
  return { ...a, view, ok, move, choose, search, belfry, row, rows };
}

export function completedSilence(path: string, branch: string, perform = true) {
  const a = setup(path);
  a.search();
  a.move('south', 'south');
  a.ok('a_vesper_meeting', [ids['npc/vesper']]);
  a.choose('meet_wren');
  a.ok('b_vesper_riddle', [ids['npc/vesper']]);
  a.ok('choose', [], {
    continuation_id: a.view().choice!.continuation_id,
    choice_id: 'answer',
    answer: 'LANTERN',
  });
  if (branch === 'stays') {
    a.ok('c_vesper_answered', [ids['npc/vesper']]);
    a.choose('carry_message');
  } else {
    a.ok('a_wren_escort', [ids['npc/wren']]);
    a.choose('rescue');
  }
  a.move('north', 'north', 'north', 'north');
  a.ok(branch === 'stays' ? 'a_elspeth_return' : 'a_elspeth_rescue', [ids['npc/elspeth']]);
  a.choose(branch);
  a.move('north', 'north', 'north', 'north', 'north');
  a.ok('a_aldric_offer', [ids['npc/aldric']]);
  a.choose('accept');
  a.move('up', 'up');
  assert.deepEqual(
    a
      .view()
      .notices?.find((n) => n.id === ids['detail/bell'])
      ?.actions?.map((x) => [x.action_key, x.available]),
    [
      ['silence_bell', true],
      ['ring_bell', true],
    ],
  );
  if (perform) a.ok('silence_bell', [ids['detail/bell']]);
  return a;
}
