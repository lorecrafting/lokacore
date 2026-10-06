import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { value } from '../src/mechanics/fact.ts';
import { journey, patrol, npc, room, ref, fresh } from './patrol_fixture.ts';
import { hp } from './combat_fixture.ts';

// Breaks: leader departures earn player credit, connector repeats count twice, or success grants a skill/item/payment.
test('original leader earns zero until real player joins four unique checkpoints', () => {
  const a = journey();
  a.start();
  assert.equal(patrol(a.world).credit.length, 0);
  const inventory = gameView(a.world).inventory;
  const skills = gameView(a.world).skills;
  for (const [direction, credit] of [
    ['west', 1],
    ['south', 2],
    ['east', 3],
    ['west', 3],
    ['north', 3],
    ['east', 4],
  ] as const) {
    const before = a.world.state.containers[a.world.body];
    const n = patrol(a.world).credit.length;
    const depart = a.choice('continue');
    assert.equal(a.world.state.containers[a.world.body], before);
    assert.equal(patrol(a.world).credit.length, n);
    assert.ok(depart.decision.kind === 'accepted');
    assert.deepEqual(
      depart.decision.events
        .map((e) => e.payload)
        .filter((p) => p.type === 'entity_entered_room')
        .map((p) => p.entity_id),
      [npc(a.world)],
    );
    assert.equal(
      gameView(a.world).journal.find((q) => q.quest.key === 'watch_rounds')!.patrol!.direction,
      direction,
    );
    a.move(direction);
    assert.equal(patrol(a.world).credit.length, credit);
  }
  assert.equal(patrol(a.world).status, 'completed');
  assert.equal(
    Object.values(a.world.state.quests!).find((q) => q.quest.key === 'watch_rounds')!.outcome,
    'completed',
  );
  assert.equal(
    value(a.world, a.world.character, ref(a.world, 'fact', 'watch_gate_trusts_player')),
    true,
  );
  assert.deepEqual(gameView(a.world).inventory, inventory);
  assert.deepEqual(gameView(a.world).skills, skills);
  a.move('west');
  a.move('north');
  assert.equal(patrol(a.world).status, 'completed');
});

// Breaks: arrival automatically resumes/credits a paused attempt, or old cursor input advances a new leg.
test('ordinary detour requires explicit Rejoin and fresh drawn continuation state', () => {
  const a = journey();
  a.start();
  a.choice('continue');
  a.move('west');
  a.move('north');
  assert.equal(patrol(a.world).status, 'paused');
  a.move('south');
  assert.equal(patrol(a.world).status, 'paused');
  assert.equal(patrol(a.world).credit.length, 1);
  a.choice('rejoin');
  const old = {
    quest_instance_id: patrol(a.world).quest_instance_id,
    attempt_id: patrol(a.world).attempt_id,
    cursor: 1,
    status: 'together',
  };
  a.choice('continue');
  a.move('south');
  a.run({ type: 'talk', target_id: npc(a.world) });
  const continuation_id = Object.entries(a.world.state.choices!).find(
    ([, c]) => c.status === 'pending',
  )![0];
  const before = a.world;
  const stale = a.run(
    { type: 'choose', continuation_id, choice_id: 'continue', patrol: old },
    false,
  );
  assert.deepEqual(stale.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(stale.world, before);
  assert.equal(gameView(a.world).choice!.closable, true);
});

// Breaks: actual fatal combat retains attempt credit, or leader-ahead death faults before revival.
test('fatal combat invalidates together and awaiting attempts before immediate Restart', () => {
  for (const awaiting of [false, true]) {
    const a = journey(hp(fresh, fresh.body, 1));
    a.start();
    a.choice('continue');
    a.move('west');
    a.choice('continue');
    a.move('south');
    const attempt = patrol(a.world).attempt_id;
    if (awaiting) a.choice('continue');
    // Controlled real opponent placement; the installed combat producer remains authoritative.
    const w = a.world;
    const rat = npc(w, 'cellar_rat_1');
    const controlled = {
      ...w,
      state: { ...w.state, containers: { ...w.state.containers, [rat]: room(w, 'village_green') } },
    };
    const fight = journey(hp(controlled, controlled.body, 1));
    fight.run({ type: 'attack', target_id: rat });
    const b = fight.world;
    const run_id = 'abababab-1111-4222-8333-444444444444' as never;
    const until = b.state.clock + 150;
    const result = stepElapsed(
      b,
      {
        id: elapsedCommandId(run_id, b.context, b.state.clock, until) as never,
        world_context_id: b.context,
        payload: { type: 'elapsed', actor_id: b.character, run_id, from: b.state.clock, until },
      },
      90,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    assert.ok(
      result.decision.kind === 'accepted' &&
        result.decision.events.some(
          (e) => e.payload.type === 'entity_died' && e.payload.victim_id === b.body,
        ),
    );
    assert.equal(patrol(result.world).status, 'failed');
    assert.equal(patrol(result.world).credit.length, 0);
    assert.equal(patrol(result.world).attempt_id, attempt);
    assert.equal(result.world.state.containers[b.body], room(b, 'chapel_nave'));
  }
});

// Breaks: Continue steals Wren's following relation or produces a second player transfer.
test('original Wren follow composes independently with leader-only Continue and one joined Move', () => {
  const a = journey();
  const choose = (choice_id: string, answer?: string) => {
    const row = Object.entries(a.world.state.choices!).find(([, c]) => c.status === 'pending')!;
    a.run({ type: 'choose', continuation_id: row[0], choice_id, ...(answer && { answer }) });
  };
  a.run({ type: 'talk', target_id: npc(a.world, 'elspeth') });
  choose('accept');
  a.move('north');
  a.move('north');
  a.run({
    type: 'take',
    item_id:
      a.world.entityIds[
        `${a.world.cartridge.manifest.id}@${a.world.cartridge.manifest.version}:item/fox_drawing`
      ],
  });
  a.move('south');
  a.move('south');
  a.run({ type: 'talk', target_id: npc(a.world, 'elspeth') });
  choose('report');
  a.move('south');
  a.move('south');
  a.run({ type: 'perform', action: 'study_tracks' });
  a.move('south');
  a.move('south');
  a.run({ type: 'talk', target_id: npc(a.world, 'vesper') });
  choose('meet_wren');
  a.run({ type: 'talk', target_id: npc(a.world, 'vesper') });
  choose('answer', 'LANTERN');
  a.run({ type: 'talk', target_id: npc(a.world, 'wren') });
  choose('rescue');
  for (const direction of ['north', 'north', 'north', 'north', 'north', 'north', 'north', 'east'])
    a.move(direction);
  a.choice('start');
  const wren = npc(a.world, 'wren');
  const before = a.world.state.containers[wren];
  a.choice('continue');
  assert.equal(a.world.state.containers[wren], before);
  const joined = a.move('west');
  assert.ok(joined.decision.kind === 'accepted');
  assert.equal(
    joined.decision.delta.ops.filter((o) => o.op === 'entity.transfer' && o.entity_id === wren)
      .length,
    1,
  );
  assert.equal(
    joined.decision.delta.ops.filter(
      (o) => o.op === 'entity.transfer' && o.entity_id === a.world.body,
    ).length,
    1,
  );
  assert.equal(a.world.state.escorts![a.world.character].status, 'following');
  assert.equal(patrol(a.world).credit.length, 1);
});

// Breaks: an hour/equipment/trust gate strands an untrained actor, or elapsed reading moves the passive leader.
test('public watch rooms, readables and Start remain usable at dusk, late night and next morning', () => {
  for (const clock of [64800, 82800, 108000]) {
    const a = journey({ ...fresh, state: { ...fresh.state, clock } });
    a.start();
    a.move('east');
    a.move('west');
    a.move('up');
    a.move('down');
    const roster = Object.entries(a.world.details).find(([, d]) => d.key === 'duty_roster')![0];
    a.run({ type: 'read', target_id: roster });
    assert.equal(patrol(a.world).status, 'paused');
    a.choice('rejoin');
    const before = a.world,
      run_id = 'abababab-1111-4222-8333-444444444444' as never;
    const until = before.state.clock + 900;
    const elapsed = stepElapsed(
      before,
      {
        id: elapsedCommandId(run_id, before.context, before.state.clock, until) as never,
        world_context_id: before.context,
        payload: {
          type: 'elapsed',
          actor_id: before.character,
          run_id,
          from: before.state.clock,
          until,
        },
      },
      100,
    );
    assert.equal(elapsed.decision.kind, 'accepted');
    assert.deepEqual(patrol(elapsed.world), patrol(before));
    assert.equal(elapsed.world.state.containers[npc(before)], room(before, 'watch_post'));
    a.choice('continue');
    a.move('west');
    a.choice('continue');
    a.move('south');
    a.choice('continue');
    a.move('east');
    const sign = Object.entries(a.world.details).find(([, d]) => d.key === 'road_sign')![0];
    a.run({ type: 'read', target_id: sign });
    assert.equal(patrol(a.world).credit.length, 3);
    a.move('west');
    a.move('north');
    a.move('north');
    a.move('north');
    assert.equal(a.world.state.containers[a.world.body], room(a.world, 'chapel_nave'));
  }
});
