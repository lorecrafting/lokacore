import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bundle,
  entity,
  genesis,
  prefix,
  ref,
  room,
} from '../../../kernel/ts/test/transport_fixture.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

function source(change: (c: any) => void = () => {}) {
  const configure = (c: any) => {
    c.entry = ref('room', 'chapel_nave');
    c.calendar.start = 64800;
    change(c);
  };
  return { bundle: bundle(configure), fresh: genesis(configure) };
}

function studySource() {
  return source((c) => {
    c.entry = ref('room', 'prior_study');
    c.items[`${prefix}:item/brass_key`].location = { in: 'room', room: ref('room', 'prior_study') };
    // Controlled authored combat produces the Study corpse through accepted receipts.
    c.npcs[`${prefix}:npc/study_test_rat`] = {
      ...structuredClone(c.npcs[`${prefix}:npc/cellar_rat_1`]),
      key: 'study_test_rat',
      room: ref('room', 'prior_study'),
      attack: { chance: 100, damage_min: 100, damage_max: 100 },
    };
    c.world.combat.player_attack.chance = 0;
  });
}

function setup(path: string, release = source(), ancestry = 'fey_touched') {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, release.bundle);
  const host = { kernel_version: p.host.kernel_version, newId: p.host.newId };
  const story = openStory(
    p.db,
    [{ fresh: release.fresh, content_hash: release.bundle.sha256 }],
    host,
  );
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('save did not open');
  const selected = story.invoke({
    invocation_id: 'cccccccc-0000-4000-8000-000000000001',
    actor_id: story.world().character,
    action_key: 'choose_ancestry',
    target_ids: [],
    input: { ancestry },
  } as never);
  assert.equal(
    selected.kind === 'saved' && (selected.decision as { kind: string }).kind,
    'accepted',
  );
  return { ...p, story, release, host };
}

function staysToBelfry(p: ReturnType<typeof setup>, elapsed = 0) {
  let n = 1;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    if (elapsed) {
      const from = p.story.world().state.clock;
      const tick = p.story.elapsed({
        expected_run_id: p.story.runId(),
        from,
        until: from + elapsed,
      });
      assert.equal(tick.kind, 'saved');
    }
    const result = p.story.invoke({
      invocation_id: `bbbbbbbb-0000-4000-8000-${String(n++).padStart(12, '0')}`,
      actor_id: p.story.world().character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(result.kind, 'saved');
    if (result.kind === 'saved')
      assert.equal((result.decision as { kind: string }).kind, 'accepted');
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string, extra: object = {}) =>
    ok('choose', [], {
      continuation_id: gameView(p.story.world()).choice!.continuation_id,
      choice_id,
      ...extra,
    });
  const talk = (action: string, npc: string) => ok(action, [entity(p.story.world(), 'npc', npc)]);
  move('south', 'south', 'south', 'south', 'south');
  talk('elspeth', 'elspeth');
  choose('accept');
  ok('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
  move('north', 'north');
  ok('take', [entity(p.story.world(), 'item', 'fox_drawing')]);
  move('south', 'south');
  talk('a_elspeth_report', 'elspeth');
  choose('report');
  move('south', 'south');
  ok('study_tracks');
  move('south', 'south');
  talk('a_vesper_meeting', 'vesper');
  choose('meet_wren');
  talk('b_vesper_riddle', 'vesper');
  choose('answer', { answer: 'LANTERN' });
  talk('c_vesper_answered', 'vesper');
  choose('carry_message');
  move('north', 'north', 'north', 'north');
  talk('a_elspeth_return', 'elspeth');
  choose('stays');
  move('north', 'north', 'north', 'north', 'north');
  talk('a_aldric_offer', 'aldric');
  choose('accept');
  move('up', 'up');
}

// Breaks: a confirmed bell cue is lost on cold reopen or replay emits another cue.
test('real SQLite cold reopen retains one cause-bound bell cue', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const p = setup(join(dir, 'save.db'));
  staysToBelfry(p);
  const invocation = {
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000101',
    actor_id: p.story.world().character,
    action_key: 'ring_bell',
    target_ids: [],
    input: {},
  };
  const reply = p.story.invoke(invocation);
  assert.equal(reply.kind, 'saved');
  if (reply.kind !== 'saved') return;
  assert.equal((reply.decision as { kind: string }).kind, 'accepted');
  const first = p.story.narration(reply.command_id);
  assert.equal(first?.cue?.key, 'narration.bell_cue');
  assert.equal(first?.cue?.room_id, room(p.story.world(), 'belfry'));
  const reopened = openStory(
    p.db,
    [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }],
    p.host,
  );
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.deepEqual(reopened.narration(reply.command_id), first);
  const replay = reopened.invoke(invocation);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.deepEqual(reopened.narration(reply.command_id), first);
});

// Breaks: a failed or acknowledged-lost bell COMMIT leaves a partial suppression or mints it twice.
test('real SQLite uncertain bell COMMIT reconciles one suppression and one resume job', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-fault-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const [kind, suffix] of [
    ['failed', '201'],
    ['lost', '201'],
    ['failed', '203'],
    ['lost', '203'],
  ] as const) {
    const p = setup(join(dir, `${kind}-${suffix}.db`));
    staysToBelfry(p);
    const invocation = {
      invocation_id: `aaaaaaaa-0000-4000-8000-000000000${suffix}`,
      actor_id: p.story.world().character,
      action_key: 'ring_bell',
      target_ids: [],
      input: {},
    };
    if (kind === 'failed')
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    p.fault.kind = kind;
    p.fault.armed = true;
    assert.equal(p.story.invoke(invocation).kind, 'pending', kind);
    assert.equal(
      p.story.world().state.population_plans![key(ref('population', 'fen_hounds'))].suppression,
      undefined,
      kind,
    );
    p.fault.reads = false;
    const settled = p.story.invoke(invocation);
    assert.equal(settled.kind, 'saved', kind);
    if (settled.kind !== 'saved') continue;
    assert.equal(settled.replay, kind === 'lost', kind);
    assert.equal((settled.decision as { kind: string }).kind, 'accepted', kind);
    const control = p.story.world().state.population_plans![key(ref('population', 'fen_hounds'))];
    assert.deepEqual(
      [control.suppression?.generation, control.suppression?.ends_at],
      [1, 237600],
      kind,
    );
    assert.equal(
      Object.values(p.story.world().state.jobs ?? {}).filter(
        (j) => j.status === 'pending' && j.due_time === 237600,
      ).length,
      1,
      kind,
    );
    assert.equal(
      p.sql
        .prepare(
          "SELECT count(*) AS n FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'",
        )
        .get()!.n,
      1,
      kind,
    );
    assert.equal(
      openStory(p.db, [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }], p.host)
        .kind,
      'open',
      kind,
    );
    while (p.story.world().state.clock < 237599) {
      const from = p.story.world().state.clock;
      const until = Math.min(
        237599,
        ...Object.values(p.story.world().state.jobs ?? {})
          .filter((j) => j.status === 'pending')
          .map((j) => j.due_time),
      );
      const tick = p.story.elapsed({ expected_run_id: p.story.runId(), from, until });
      assert.equal(tick.kind, 'saved');
      if (tick.kind === 'saved') assert.equal((tick.decision as { kind: string }).kind, 'accepted');
    }
    assert.equal(
      openStory(p.db, [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }], p.host)
        .kind,
      'open',
    );
    p.fault.inserted = false;
    p.fault.kind = kind;
    p.fault.armed = true;
    const resume = { expected_run_id: p.story.runId(), from: 237599, until: 237600 };
    assert.equal(p.story.elapsed(resume).kind, 'pending');
    assert.equal(p.story.world().state.clock, 237599);
    p.fault.reads = false;
    const settledResume = p.story.elapsed(resume);
    assert.equal(settledResume.kind, 'saved');
    if (settledResume.kind === 'saved') assert.equal(settledResume.replay, kind === 'lost');
    const replayedResume = p.story.elapsed(resume);
    assert.equal(replayedResume.kind, 'saved');
    if (replayedResume.kind === 'saved') assert.equal(replayedResume.replay, true);
    assert.equal(
      p.story.world().state.population_plans![key(ref('population', 'fen_hounds'))].suppression
        ?.ends_at,
      null,
    );
    assert.equal(
      openStory(p.db, [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }], p.host)
        .kind,
      'open',
    );
  }
});

// Breaks: fox Study custody loses the corpse on reopen, grants its item without Take, or stays open after retrieval.
test('real SQLite fox Study corpse permits pickup then closes ingress after cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-study-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const faultKind of ['failed', 'lost'] as const) {
    const p = setup(join(dir, `${faultKind}.db`), studySource());
    const item = entity(p.story.world(), 'item', 'brass_key');
    const request = (n: number, action_key: string, target_ids: string[], input: object) => ({
      invocation_id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
      actor_id: p.story.world().character,
      action_key,
      target_ids,
      input,
    });
    const invoke = (n: number, action_key: string, target_ids: string[], input: object) => {
      const result = p.story.invoke(request(n, action_key, target_ids, input));
      assert.equal(result.kind, 'saved');
      if (result.kind === 'saved')
        assert.equal((result.decision as { kind: string }).kind, 'accepted');
    };
    const reopen = () => {
      const opened = openStory(
        p.db,
        [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }],
        p.host,
      );
      assert.equal(opened.kind, 'open');
      if (opened.kind !== 'open') throw new Error('saved Study world did not reopen');
      p.story = opened;
    };
    let n = 1;
    const ok = (action: string, target_ids: string[] = [], input: object = {}) =>
      invoke(n++, action, target_ids, input);
    const move = (...directions: string[]) =>
      directions.forEach((direction) => ok('move', [], { direction }));
    ok('take', [item]);
    ok('attack', [entity(p.story.world(), 'npc', 'study_test_rat')]);
    const from = p.story.world().state.clock;
    const due = Object.values(p.story.world().state.jobs!).find(
      (job) => job.status === 'pending' && job.encounter_id,
    )!.due_time;
    const death = p.story.elapsed({ expected_run_id: p.story.runId(), from, until: due });
    assert.equal(death.kind === 'saved' && (death.decision as { kind: string }).kind, 'accepted');
    assert.equal(
      p.story.world().state.containers[p.story.world().body],
      room(p.story.world(), 'chapel_nave'),
    );
    reopen();
    staysToBelfry(p);
    ok('silence_bell', [
      Object.entries(p.story.world().details).find(([, d]) => d.key === 'bell')![0],
    ]);
    for (let line = 0; line < 2; line++) {
      const scene = gameView(p.story.world()).scene!;
      ok('continue', [], { scene: scene.scene, line: scene.index });
    }
    move('down', 'down');
    reopen();
    p.sql.exec(
      'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
    );
    const faulted = (invocation: ReturnType<typeof request>, unchanged: () => void) => {
      p.fault.inserted = false;
      p.fault.kind = faultKind;
      p.fault.armed = true;
      assert.equal(p.story.invoke(invocation).kind, 'pending');
      unchanged();
      p.fault.reads = false;
      const settled = p.story.invoke(invocation);
      assert.equal(settled.kind, 'saved');
      if (settled.kind === 'saved') {
        assert.equal(settled.replay, faultKind === 'lost');
        assert.equal((settled.decision as { kind: string }).kind, 'accepted');
      }
      const replayed = p.story.invoke(invocation);
      assert.equal(replayed.kind, 'saved');
      if (replayed.kind === 'saved') assert.equal(replayed.replay, true);
      reopen();
    };
    const chapel = room(p.story.world(), 'chapel_nave');
    const study = room(p.story.world(), 'prior_study');
    faulted(request(301, 'move', [], { direction: 'west' }), () =>
      assert.equal(p.story.world().state.containers[p.story.world().body], chapel),
    );
    assert.equal(p.story.world().state.containers[p.story.world().body], study);
    const corpse = p.story.world().state.containers[item];
    faulted(request(302, 'take', [item], {}), () =>
      assert.equal(p.story.world().state.containers[item], corpse),
    );
    assert.equal(p.story.world().state.containers[item], p.story.world().body);
    faulted(request(303, 'move', [], { direction: 'east' }), () =>
      assert.equal(p.story.world().state.containers[p.story.world().body], study),
    );
    assert.equal(p.story.world().state.containers[item], p.story.world().body);
    const refused = p.story.invoke({
      invocation_id: 'aaaaaaaa-0000-4000-8000-000000000304',
      actor_id: p.story.world().character,
      action_key: 'move',
      target_ids: [],
      input: { direction: 'west' },
    });
    assert.equal(refused.kind, 'saved');
    if (refused.kind === 'saved')
      assert.deepEqual(refused.decision, { kind: 'rejected', error: { code: 'exit_closed' } });
  }
});

// Breaks: the Book’s targetless recipe invocation commits Ring but its receipt cannot cold-open before Continue.
test('real SQLite stays/prior bell scene reopens before Continue', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-stays-bell-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const p = setup(join(dir, 'save.db'), source(), 'fen_born');
  staysToBelfry(p, 50);
  const reply = p.story.invoke({
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000999',
    actor_id: p.story.world().character,
    action_key: 'ring_bell',
    target_ids: [],
    input: {},
  });
  assert.equal(reply.kind, 'saved');
  if (reply.kind === 'saved') assert.equal((reply.decision as { kind: string }).kind, 'accepted');
  const reopened = openStory(
    p.db,
    [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }],
    p.host,
  );
  assert.equal(reopened.kind, 'open');
  if (reopened.kind === 'open') {
    gameView(reopened.world());
    assert.ok(reopened.narration()?.cue);
  }
});

// Breaks: earlier terminal flavor dialogue shadows the keyed public ledger or cellar service.
test('terminal profiles preserve bound ledger and cellar offers through SQLite reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-services-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const allegiance of ['prior', 'fox']) {
    const p = setup(join(dir, `${allegiance}.db`));
    let n = 1;
    const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) => {
      const reply = p.story.invoke({
        invocation_id: `eeeeeeee-0000-4000-8000-${String(n++).padStart(12, '0')}`,
        actor_id: p.story.world().character,
        action_key,
        target_ids,
        input,
      });
      assert.equal(reply.kind, 'saved');
      if (reply.kind === 'saved')
        assert.equal((reply.decision as { kind: string }).kind, 'accepted');
    };
    const move = (...directions: string[]) =>
      directions.forEach((direction) => invoke('move', [], { direction }));
    const choose = (choice_id: string) =>
      invoke('choose', [], {
        continuation_id: gameView(p.story.world()).choice!.continuation_id,
        choice_id,
      });
    const talk = (action: string, npc: string) =>
      invoke(action, [entity(p.story.world(), 'npc', npc)]);
    const reopen = () => {
      const opened = openStory(
        p.db,
        [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }],
        p.host,
      );
      assert.equal(opened.kind, 'open');
      if (opened.kind !== 'open') throw new Error('service save did not open');
      p.story = opened;
    };
    staysToBelfry(p);
    invoke(allegiance === 'prior' ? 'ring_bell' : 'silence_bell');
    while (gameView(p.story.world()).scene) {
      const scene = gameView(p.story.world()).scene!;
      invoke('continue', [], { scene: scene.scene, line: scene.index });
    }
    move('down', 'down', 'south', 'south', 'south', 'south', 'west');
    talk('a_peg_debt', 'peg');
    choose('accept_on_time');
    invoke('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
    reopen();
    const ledger = entity(p.story.world(), 'item', 'tithe_ledger');
    assert.equal(p.story.world().state.containers[ledger], p.story.world().body);
    move('east', 'north', 'north', 'north', 'north');
    talk('a_aldric_debt', 'aldric');
    assert.equal(gameView(p.story.world()).choice!.prompt.key, 'dialogue.aldric_debt.prompt');
    reopen();
    choose('on_time');
    reopen();
    assert.equal(
      p.story.world().state.containers[ledger],
      entity(p.story.world(), 'npc', 'aldric'),
    );
    move('south', 'south', 'south', 'south', 'east');
    talk('maud_offer', 'maud');
    assert.equal(gameView(p.story.world()).choice!.prompt.key, 'dialogue.maud_offer.prompt');
    choose('accept');
    reopen();
    talk('maud_turn_in', 'maud');
    assert.equal(gameView(p.story.world()).choice!.prompt.key, 'dialogue.maud_turn_in.prompt');
  }
});
