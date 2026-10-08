import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStory } from './authority.ts';
import { bundle, completedSilence, fresh, ids, setup } from './__tests__/bell-setup.test.ts';

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
