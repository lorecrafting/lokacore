import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';

const bundle = read('protocol/fixtures/missing_child_v013_hash.json');
const ids = read('protocol/fixtures/missing_child_v013_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);

function setup(path: string) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
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

// Breaks: a lawful lost outcome or any bell-scene intermediate state cannot cold reopen.
test('bell-first loss survives real rollback-journal SQLite reopen after every scene line', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'story.db');
  let a = setup(path);
  a.search();
  a.belfry();
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().journal.find((q) => q.quest.key === 'bell_of_ashmere')?.state, 'active');
  const bellNotice = a.view().notices?.find((n) => n.id === ids['detail/bell']);
  assert.deepEqual(
    bellNotice?.actions?.map((x) => [x.action_key, x.available]),
    [['ring_bell', true]],
  );
  const wrong = a.game.invoke({
    action_key: 'ring_bell',
    target_ids: [ids['detail/notice']],
    input: {},
  } as never);
  assert.equal(wrong.kind, 'saved');
  if (wrong.kind === 'saved') assert.equal(wrong.decision.kind, 'rejected');
  a.ok('ring_bell', [ids['detail/bell']]);
  for (const expected of [1, 2, 3]) {
    a.sql.close();
    a = setup(path);
    assert.equal(a.view().scene?.index, expected);
    assert.deepEqual(
      a
        .rows('quests')
        .map((q) => [q.value.quest.key, q.value.state, q.value.outcome])
        .sort(),
      [
        ['bell_of_ashmere', 'resolved', 'prior'],
        ['first_lead', 'resolved', 'report'],
        ['missing_child', 'failed', 'lost'],
      ],
    );
    a.ok('continue');
  }
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().scene, undefined);
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'missing_child')?.journal,
    'quest.missing_child.lost',
  );
  a.sql.close();
});

// Breaks: a forged terminal row can claim Wren was lost with no committed Ring evidence.
test('forged lost quest without Ring receipt gives typed save corruption', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-forged-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'story.db');
  const a = setup(path);
  a.search();
  const q = a.rows('quests').find((r) => r.value.quest.key === 'missing_child')!;
  a.sql
    .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
    .run(JSON.stringify({ ...q.value, state: 'failed', outcome: 'lost' }), 'quests', q.key);
  assert.equal(
    openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
    'save_corrupt',
  );
  a.sql.close();
});

// Breaks: a Ring after meeting falsely marks Q2 lost or a later message/escort return cannot reopen.
test('late Ring keeps both Q2 returns playable through cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-late-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const branch of ['stays', 'rescued']) {
    const path = join(dir, `${branch}.db`);
    let a = setup(path);
    a.search();
    a.move('south', 'south');
    a.ok('a_vesper_meeting', [ids['npc/vesper']]);
    a.choose('meet_wren');
    a.move('north', 'north');
    a.belfry();
    a.ok('ring_bell', [ids['detail/bell']]);
    for (let i = 0; i < 3; i++) a.ok('continue');
    a.sql.close();
    a = setup(path);
    assert.equal(a.view().journal.find((q) => q.quest.key === 'missing_child')?.state, 'active');
    a.move(
      'down',
      'down',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
    );
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
    a.sql.close();
    a = setup(path);
    assert.equal(a.view().journal.find((q) => q.quest.key === 'missing_child')?.state, 'resolved');
    assert.equal(
      a.rows('quests').find((q) => q.value.quest.key === 'missing_child')?.value.outcome,
      branch,
    );
    a.sql.close();
  }
});

// Breaks: malformed quest rows, an allegiance without its bell, or a scene without a resolved Q3 silently hydrate.
test('bell save contradictions offer typed recovery without changing saved rows', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const damage of [
    'q1_null',
    'q2_null',
    'q3_null',
    'q3_scope',
    'prior_without_bell',
    'scene_without_resolution',
    'ring_receipt_missing',
  ]) {
    const path = join(dir, `${damage}.db`);
    const a = setup(path);
    a.search();
    a.belfry();
    a.ok('ring_bell', [ids['detail/bell']]);
    const quests = a.rows('quests');
    const q1 = quests.find((r) => r.value.quest.key === 'first_lead')!;
    const q2 = quests.find((r) => r.value.quest.key === 'missing_child')!;
    const q3 = quests.find((r) => r.value.quest.key === 'bell_of_ashmere')!;
    const change = (section: string, key: string, next: unknown) =>
      a.sql
        .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
        .run(JSON.stringify(next), section, key);
    const fact = (name: string) =>
      a.rows('facts').find((r) => JSON.parse(r.key).fact?.key === name)!;
    if (damage === 'q1_null') change('quests', q1.key, null);
    if (damage === 'q2_null') change('quests', q2.key, null);
    if (damage === 'q3_null') change('quests', q3.key, null);
    if (damage === 'q3_scope')
      change('quests', q3.key, {
        ...q3.value,
        scope: { kind: 'instance', world_context_id: fresh.context },
      });
    if (damage === 'prior_without_bell') change('facts', fact('chapel_bell_rung').key, false);
    if (damage === 'scene_without_resolution')
      change('quests', q3.key, { ...q3.value, state: 'active', outcome: undefined });
    if (damage === 'ring_receipt_missing')
      a.sql
        .prepare("DELETE FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'")
        .run();
    const before = a.sql
      .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
      .all();
    assert.equal(
      openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
      'save_corrupt',
      damage,
    );
    assert.deepEqual(
      a.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
      before,
      damage,
    );
    a.sql.close();
  }
});
