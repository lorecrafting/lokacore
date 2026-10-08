import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStory } from './authority.ts';
import { bundle, completedSilence, fresh, ids, setup } from './__tests__/bell-setup.test.ts';

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
