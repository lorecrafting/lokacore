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

const bundle = read('protocol/fixtures/missing_child_v015_hash.json');
const ids = read('protocol/fixtures/missing_child_v015_ids.json');
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
    [
      ['silence_bell', false],
      ['ring_bell', true],
    ],
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

function completedSilence(path: string, branch: string, perform = true) {
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

// Breaks: a lawful fox terminal loses its scene across reopen or a stale Ring reverses it.
test('both completed returns keep Silence and its two scene lines through cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-silence-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const branch of ['stays', 'rescued']) {
    const path = join(dir, `${branch}.db`);
    let a = completedSilence(path, branch);
    for (const index of [1, 2]) {
      a.sql.close();
      a = setup(path);
      assert.equal(a.view().scene?.index, index);
      assert.deepEqual(
        a.rows('quests').find((q) => q.value.quest.key === 'bell_of_ashmere')?.value.outcome,
        'fox',
      );
      assert.equal(
        a.rows('facts').find((r) => JSON.parse(r.key).fact?.key === 'chapel_bell_rung')?.value,
        undefined,
      );
      const stale = a.game.invoke({
        action_key: 'ring_bell',
        target_ids: [ids['detail/bell']],
        input: {},
      } as never);
      assert.equal(stale.kind, 'saved');
      if (stale.kind === 'saved') assert.equal(stale.decision.kind, 'rejected');
      a.ok('continue');
    }
    a.sql.close();
    a = setup(path);
    assert.equal(a.view().scene, undefined);
    assert.equal(
      a.rows('facts').find((r) => JSON.parse(r.key).fact?.key === 'scene_bell_silenced')?.value,
      -1,
    );
    a.sql.close();
  }
});

// Breaks: a forged fox terminal is trusted after its committed Silence receipt disappears.
test('fox terminal requires its own committed Silence receipt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-silence-receipt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = completedSilence(join(dir, 'story.db'), 'stays');
  a.sql
    .prepare("DELETE FROM receipt WHERE json_extract(command,'$.payload.action')='silence_bell'")
    .run();
  const before = a.sql
    .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
    .all();
  assert.equal(
    openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
    'save_corrupt',
  );
  assert.deepEqual(
    a.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
    before,
  );
  a.sql.close();
});

// Breaks: a valid other actor is substituted into a linked allegiance or scene fact event.
test('Silence receipt rejects foreign actors on linked fact events', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-silence-actor-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const fact of ['chapel_allegiance', 'scene_bell_silenced']) {
    const a = completedSilence(join(dir, `${fact}.db`), 'stays');
    const row = a.sql
      .prepare(
        "SELECT scope,command_id,response FROM receipt WHERE json_extract(command,'$.payload.action')='silence_bell'",
      )
      .get()! as Record<string, string>;
    const response = JSON.parse(row.response);
    response.events.find(
      (e: any) => e.payload.type === 'fact_changed' && e.payload.fact.key === fact,
    ).actor_id = '00000000-0000-4000-8000-000000000099';
    a.sql
      .prepare('UPDATE receipt SET response=? WHERE scope=? AND command_id=?')
      .run(JSON.stringify(response), row.scope, row.command_id);
    const before = a.sql
      .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
      .all();
    assert.equal(
      openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
      'save_corrupt',
      fact,
    );
    assert.deepEqual(
      a.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
      before,
      fact,
    );
    a.sql.close();
  }
});

// Breaks: an unrelated receipt claims the fox scene without the exact action and causal chain.
test('Silence receipt binds its action, actor and scene cause', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-silence-links-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const damage of [
    'action',
    'actor',
    'detail',
    'quest_cause',
    'scene_cause',
    'bell_write',
    'bell_event',
    'duplicate_scene',
  ]) {
    const a = completedSilence(join(dir, `${damage}.db`), 'stays');
    const row = a.sql
      .prepare(
        "SELECT scope,command_id,actor_id,command,response FROM receipt WHERE json_extract(command,'$.payload.action')='silence_bell'",
      )
      .get()! as Record<string, string>;
    const command = JSON.parse(row.command);
    const response = JSON.parse(row.response);
    if (damage === 'action') command.payload.action = 'ring_bell';
    if (damage === 'actor') command.payload.actor_id = '00000000-0000-4000-8000-000000000099';
    if (damage === 'detail') command.payload.target_id = ids['detail/notice'];
    if (damage === 'quest_cause')
      response.events.find((e: any) => e.payload.type === 'quest_resolved').causation_id =
        command.id;
    if (damage === 'scene_cause')
      response.events.find(
        (e: any) =>
          e.payload.type === 'fact_changed' && e.payload.fact.key === 'scene_bell_silenced',
      ).causation_id = command.id;
    if (damage === 'bell_write') {
      const allegiance = response.delta.ops.find(
        (o: any) => o.op === 'fact.assign' && o.fact.key === 'chapel_allegiance',
      );
      response.delta.ops.push({
        ...allegiance,
        fact: { ...allegiance.fact, key: 'chapel_bell_rung' },
        expected: false,
        value: true,
      });
    }
    if (damage === 'bell_event') {
      const allegiance = response.events.find(
        (e: any) => e.payload.type === 'fact_changed' && e.payload.fact.key === 'chapel_allegiance',
      );
      response.events.push({
        ...allegiance,
        payload: {
          ...allegiance.payload,
          fact: { ...allegiance.payload.fact, key: 'chapel_bell_rung' },
          old: false,
          new: true,
        },
      });
    }
    if (damage === 'duplicate_scene') {
      const scene = response.delta.ops.find(
        (o: any) => o.op === 'fact.assign' && o.fact.key === 'scene_bell_silenced',
      );
      response.delta.ops.push({ ...scene });
    }
    a.sql
      .prepare('UPDATE receipt SET command=?,response=? WHERE scope=? AND command_id=?')
      .run(JSON.stringify(command), JSON.stringify(response), row.scope, row.command_id);
    assert.equal(
      openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
      'save_corrupt',
      damage,
    );
    a.sql.close();
  }
});

// Breaks: a fox outcome hydrates beside a rung bell, lost child or opposing scene.
test('fox terminal rejects contradictory saved rows without repairing them', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-silence-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const damage of ['bell', 'lost', 'ring_scene', 'silent_scene_out_of_range']) {
    const a = completedSilence(join(dir, `${damage}.db`), 'stays');
    const fact = (name: string) =>
      a.rows('facts').find((r) => JSON.parse(r.key).fact?.key === name);
    const change = (section: string, key: string, next: unknown) =>
      a.sql
        .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
        .run(JSON.stringify(next), section, key);
    if (damage === 'bell') {
      const row = fact('chapel_allegiance')!;
      const key = JSON.parse(row.key);
      key.fact.key = 'chapel_bell_rung';
      a.sql
        .prepare('INSERT INTO state_row (section,key,value) VALUES (?,?,?)')
        .run('facts', JSON.stringify(key), 'true');
    }
    if (damage === 'lost') {
      const q2 = a.rows('quests').find((q) => q.value.quest.key === 'missing_child')!;
      change('quests', q2.key, { ...q2.value, state: 'failed', outcome: 'lost' });
    }
    if (damage === 'ring_scene') {
      const row = fact('scene_bell_silenced')!;
      const key = JSON.parse(row.key);
      key.fact.key = 'scene_bell_rung';
      a.sql
        .prepare('INSERT INTO state_row (section,key,value) VALUES (?,?,?)')
        .run('facts', JSON.stringify(key), '1');
    }
    if (damage === 'silent_scene_out_of_range') {
      const row = fact('scene_bell_silenced')!;
      change('facts', row.key, 3);
    }
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

// Breaks: a failed or uncertain COMMIT can announce fox without saving it, or replay starts a second scene.
test('Silence COMMIT uncertainty settles once and its exact receipt replays unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-silence-commit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const kind of ['failed', 'lost'] as const) {
    const path = join(dir, `${kind}.db`);
    const a = completedSilence(path, 'stays', false);
    if (kind === 'failed')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    const intent = { action_key: 'silence_bell', target_ids: [ids['detail/bell']], input: {} };
    a.fault.kind = kind;
    a.fault.armed = true;
    assert.equal(a.game.invoke(intent as never).kind, 'pending', kind);
    assert.equal(a.view().journal.find((q) => q.quest.key === 'bell_of_ashmere')?.state, 'active');
    a.fault.reads = false;
    const settled = a.game.invoke(intent as never);
    assert.equal(settled.kind, 'saved', kind);
    if (settled.kind === 'saved')
      assert.equal('replay' in settled && settled.replay, kind === 'lost');
    assert.equal(a.view().scene?.index, 1);
    assert.equal(
      a.sql
        .prepare(
          "SELECT count(*) AS n FROM receipt WHERE json_extract(command,'$.payload.action')='silence_bell'",
        )
        .get()!.n,
      1,
    );
    a.sql.close();
    const reopened = setup(path);
    const receipt = reopened.sql
      .prepare(
        "SELECT invocation_id FROM receipt WHERE json_extract(command,'$.payload.action')='silence_bell'",
      )
      .get()!;
    const story = openStory(reopened.db, [{ content_hash: bundle.sha256, fresh }], reopened.host);
    assert.equal(story.kind, 'open');
    if (story.kind === 'open') {
      const before = reopened.sql
        .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
        .all();
      const replay = story.invoke({
        ...intent,
        actor_id: fresh.character,
        invocation_id: receipt.invocation_id,
      });
      assert.equal(replay.kind, 'saved');
      if (replay.kind === 'saved') assert.equal(replay.replay, true);
      assert.deepEqual(
        reopened.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
        before,
      );
      assert.equal(reopened.view().scene?.index, 1);
    }
    reopened.sql.close();
  }
});

// Breaks: a late Ring receipt with an added Q2 loss transition reopens an active Q2.
test('late Ring rejects a receipt with an extra Q2 loss transition', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-late-forged-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(join(dir, 'story.db'));
  a.search();
  a.move('south', 'south');
  a.ok('a_vesper_meeting', [ids['npc/vesper']]);
  a.choose('meet_wren');
  a.move('north', 'north');
  a.belfry();
  a.ok('ring_bell', [ids['detail/bell']]);
  const q2 = a.rows('quests').find((r) => r.value.quest.key === 'missing_child')!;
  assert.equal(q2.value.state, 'active');
  const receipt = a.sql
    .prepare(
      "SELECT scope,command_id,response FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'",
    )
    .get()! as Record<string, string>;
  const response = JSON.parse(receipt.response);
  const q3Transition = response.delta.ops.find(
    (op: any) => op.op === 'quest.transition' && op.to === 'resolved',
  )!;
  response.delta.ops.push({
    ...q3Transition,
    instance_id: q2.key,
    from: 'active',
    to: 'failed',
    outcome: 'lost',
  });
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE scope=? AND command_id=?')
    .run(JSON.stringify(response), receipt.scope, receipt.command_id);
  const before = a.sql
    .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
    .all();
  assert.equal(
    openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
    'save_corrupt',
  );
  assert.deepEqual(
    a.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
    before,
  );
  a.sql.close();
});

// Breaks: malformed rows, including a resurrected Q2 against a retained loss receipt, silently hydrate.
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
    'q2_absent_before_ring',
    'scene_four',
    'scene_below_end',
    'scene_string',
    'scene_fraction',
    'loss_receipt_resurrected_q2',
  ]) {
    const path = join(dir, `${damage}.db`);
    const a = setup(path);
    a.search();
    a.belfry();
    if (damage !== 'q2_absent_before_ring') a.ok('ring_bell', [ids['detail/bell']]);
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
    if (damage === 'q2_absent_before_ring')
      a.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?').run('quests', q2.key);
    if (damage === 'q3_null') change('quests', q3.key, null);
    if (damage === 'q3_scope')
      change('quests', q3.key, {
        ...q3.value,
        scope: { kind: 'instance', world_context_id: fresh.context },
      });
    if (damage === 'prior_without_bell') change('facts', fact('chapel_bell_rung').key, false);
    if (damage === 'scene_without_resolution')
      change('quests', q3.key, { ...q3.value, state: 'active', outcome: undefined });
    if (damage === 'scene_four') change('facts', fact('scene_bell_rung').key, 4);
    if (damage === 'scene_below_end') change('facts', fact('scene_bell_rung').key, -2);
    if (damage === 'scene_string') change('facts', fact('scene_bell_rung').key, 'bad');
    if (damage === 'scene_fraction') change('facts', fact('scene_bell_rung').key, 1.5);
    if (damage === 'loss_receipt_resurrected_q2') {
      change('quests', q2.key, { ...q2.value, state: 'active', outcome: undefined });
      change('facts', fact('village_child_status').key, 'missing');
      const meetingKey = JSON.parse(fact('chapel_bell_rung').key);
      meetingKey.fact.key = 'fen_wren_met';
      a.sql
        .prepare('INSERT INTO state_row (section,key,value) VALUES (?,?,?)')
        .run('facts', JSON.stringify(meetingKey), 'true');
    }
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

// Breaks: a retained Ring with mismatched command, operation or causal event fields is trusted.
test('linked Ring receipt fields reject controlled forgeries without repairing rows', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-links-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const other = '00000000-0000-4000-8000-000000000099';
  type Receipt = { command_id: string; actor_id: string; command: any; response: any };
  const op = (r: Receipt, key: string) =>
    r.response.delta.ops.find((x: any) => x.op === 'fact.assign' && x.fact.key === key)!;
  const event = (r: Receipt, type: string, key?: string) =>
    r.response.events.find(
      (x: any) => x.payload.type === type && (!key || x.payload.fact?.key === key),
    )!;
  const edits: [string, (r: Receipt) => void][] = [
    ['stored_command_id', (r) => (r.command_id = other)],
    ['stored_actor_id', (r) => (r.actor_id = other)],
    ['command_id', (r) => (r.command.id = other)],
    ['command_target', (r) => (r.command.payload.target_id = other)],
    ['bell_fact_version', (r) => (op(r, 'chapel_bell_rung').fact.cartridge_version = '0.0.12')],
    ['bell_fact_scope', (r) => (op(r, 'chapel_bell_rung').scope.character_id = other)],
    ['prior_fact_kind', (r) => (op(r, 'chapel_allegiance').fact.kind = 'quest')],
    ['scene_fact_scope', (r) => (op(r, 'scene_bell_rung').scope.character_id = other)],
    ['child_fact_scope', (r) => (op(r, 'village_child_status').scope.world_context_id = other)],
    [
      'q3_transition',
      (r) =>
        (r.response.delta.ops.find(
          (x: any) => x.op === 'quest.transition' && x.to === 'resolved',
        )!.outcome = 'lost'),
    ],
    [
      'q2_transition',
      (r) =>
        (r.response.delta.ops.find(
          (x: any) => x.op === 'quest.transition' && x.to === 'failed',
        )!.instance_id = other),
    ],
    [
      'bell_event_scope',
      (r) => (event(r, 'fact_changed', 'chapel_bell_rung').scope.character_id = other),
    ],
    ['bell_event_actor', (r) => (event(r, 'fact_changed', 'chapel_bell_rung').actor_id = other)],
    [
      'prior_event_cause',
      (r) => (event(r, 'fact_changed', 'chapel_allegiance').causation_id = other),
    ],
    [
      'child_event_scope',
      (r) => (event(r, 'fact_changed', 'village_child_status').scope.world_context_id = other),
    ],
    ['q3_event_quest', (r) => (event(r, 'quest_resolved').payload.quest.key = 'missing_child')],
    ['q3_event_actor', (r) => (event(r, 'quest_resolved').actor_id = other)],
    ['q3_event_scope', (r) => (event(r, 'quest_resolved').scope.character_id = other)],
    ['q3_event_context', (r) => (event(r, 'quest_resolved').world_context_id = other)],
    ['q3_event_cause', (r) => (event(r, 'quest_resolved').causation_id = r.command.id)],
    ['q3_event_correlation', (r) => (event(r, 'quest_resolved').correlation_id = other)],
    [
      'scene_event_cause',
      (r) => (event(r, 'fact_changed', 'scene_bell_rung').causation_id = other),
    ],
  ];
  for (const [name, edit] of edits) {
    const path = join(dir, `${name}.db`);
    const a = setup(path);
    a.search();
    a.belfry();
    a.ok('ring_bell', [ids['detail/bell']]);
    const stored = a.sql
      .prepare(
        "SELECT scope,command_id,actor_id,command,response FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'",
      )
      .get()! as Record<string, string>;
    const r: Receipt = {
      command_id: stored.command_id,
      actor_id: stored.actor_id,
      command: JSON.parse(stored.command),
      response: JSON.parse(stored.response),
    };
    edit(r);
    a.sql
      .prepare(
        'UPDATE receipt SET command_id=?,actor_id=?,command=?,response=? WHERE scope=? AND command_id=?',
      )
      .run(
        r.command_id,
        r.actor_id,
        JSON.stringify(r.command),
        JSON.stringify(r.response),
        stored.scope,
        stored.command_id,
      );
    const before = a.sql
      .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
      .all();
    assert.equal(
      openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
      'save_corrupt',
      name,
    );
    assert.deepEqual(
      a.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
      before,
      name,
    );
    a.sql.close();
  }
});

// Breaks: a failed or unacknowledged Ring COMMIT exposes partial bell/lost rows or rings twice.
test('Ring COMMIT uncertainty settles to one complete outcome and one replayable receipt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-bell-commit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const kind of ['failed', 'lost'] as const) {
    const path = join(dir, `${kind}.db`);
    const a = setup(path);
    a.search();
    a.belfry();
    if (kind === 'failed')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    const intent = { action_key: 'ring_bell', target_ids: [ids['detail/bell']], input: {} };
    a.fault.kind = kind;
    a.fault.armed = true;
    assert.equal(a.game.invoke(intent as never).kind, 'pending', kind);
    assert.equal(a.view().journal.find((q) => q.quest.key === 'bell_of_ashmere')?.state, 'active');
    a.fault.reads = false;
    const settled = a.game.invoke(intent as never);
    assert.equal(settled.kind, 'saved', kind);
    if (settled.kind === 'saved')
      assert.equal('replay' in settled && settled.replay, kind === 'lost', kind);
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
      kind,
    );
    const ringRows = a.sql
      .prepare(
        "SELECT count(*) AS n FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'",
      )
      .get()!;
    assert.equal(ringRows.n, 1, kind);
    a.sql.close();
    const reopened = setup(path);
    assert.equal(reopened.view().scene?.index, 1, kind);
    const receipt = reopened.sql
      .prepare(
        "SELECT invocation_id FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'",
      )
      .get()!;
    const story = openStory(reopened.db, [{ content_hash: bundle.sha256, fresh }], reopened.host);
    assert.equal(story.kind, 'open', kind);
    if (story.kind === 'open') {
      const before = reopened.sql
        .prepare('SELECT section,key,value FROM state_row ORDER BY section,key')
        .all();
      const replay = story.invoke({
        ...intent,
        actor_id: fresh.character,
        invocation_id: receipt.invocation_id,
      });
      assert.equal(replay.kind, 'saved', kind);
      if (replay.kind === 'saved') assert.equal(replay.replay, true, kind);
      assert.deepEqual(
        reopened.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all(),
        before,
        kind,
      );
    }
    reopened.sql.close();
  }
});
