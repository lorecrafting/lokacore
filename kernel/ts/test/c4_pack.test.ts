import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { admission } from '../src/mechanics/combat/behavior.ts';
import { validate } from '../src/foundation/validate.ts';
import { refString, type World } from '../src/runtime/decision.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import {
  run,
  h1,
  h2,
  home,
  nest,
  shrine,
  fixture,
  wounded,
  begun,
  due,
  spawned,
} from './c4_pack_fixture.ts';

// Breaks: admission scans only the day target or cap minus one and silently omits a sixth live helper.
test('night admission visits each of six fixed slots once', () => {
  const w = fixture(72000);
  const steps = { n: 0 };
  const members = admission(w, h2, steps)!;
  assert.equal(members.length, 6);
  assert.deepEqual(members, [...members].sort());
  assert.equal(steps.n, 6);
});

// Breaks: pack admission selects only the attacked goblin or substitutes the first template member.
test('attack H2 admits both exact co-present goblins with H2 as primary', () => {
  const w = fixture();
  const begun = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  );
  assert.equal(begun.decision.kind, 'accepted', JSON.stringify(begun.decision));
  const row = Object.values(begun.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h1, h2].sort());
  assert.equal(row.npc_id, h2);
  assert.equal(row.next_opponent_id, h2);
  assert.equal(begun.world.state.jobs![row.job_id].due_time, 64805);
  assert.deepEqual(
    gameView(begun.world).combat?.active_opponents?.map((member) => member.id),
    [h1, h2].sort(),
  );
});

// Breaks: attacking the only co-present goblin commits narration [] (decision.schema.json minItems 1),
// a receipt the phone's cold reopen then refuses as save_corrupt (loka-kgd.187).
test('attack on the only co-present goblin opens a valid one-member encounter', () => {
  const w = fixture();
  const alone = { ...w, state: { ...w.state, containers: { ...w.state.containers, [h1]: nest } } };
  const { decision, world } = step(
    alone,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  );
  assert.equal(decision.kind, 'accepted', JSON.stringify(decision));
  assert.deepEqual(Object.values(world.state.encounters ?? {})[0]!.active_ids, [h2]);
  assert.deepEqual(validate('DecisionResult', decision), []);
});

// Breaks: a pack member's band is missing, copied from the primary, or read from the wrong goblin
// (hp 0..8: h2 at 4 is the exact hurt cut, 400 >= 50*8; h1 untouched reads ready).
test('each pack member shows its own hp band', () => {
  const view = gameView(wounded(begun(fixture()), 4));
  assert.deepEqual(validate('GameView', view), []);
  assert.equal(view.combat?.band, 'hurt');
  assert.deepEqual(
    view.combat?.active_opponents?.map(({ id, band }) => [id, band]),
    [
      [h1, 'ready'],
      [h2, 'hurt'],
    ].sort(),
  );
});

// Breaks: a member's band is gated on the primary's visibility (a hidden helper beside a seen
// primary leaks its band), or on its own visibility only (a member a spell or status killed, still
// on the roster until the round-end prune, shows the bottom row, dying).
test('a hidden or dead pack member shows no band while the seen primary keeps its own', () => {
  const w = begun(fixture());
  const { id, version } = w.cartridge.manifest;
  const hidden: DefinitionRef = {
    cartridge_id: id,
    cartridge_version: version,
    kind: 'status',
    key: 'hidden',
  };
  const concealed = {
    ...w,
    cartridge: {
      ...w.cartridge,
      statuses: { [refString(hidden)]: { key: 'hidden', concealment: 'hidden' } },
    },
    state: {
      ...w.state,
      statuses: { [statusKey(h1, hidden)]: { generation: 1, active: true } },
    },
  } as World;
  const bands = (world: World) => {
    const view = gameView(world);
    assert.deepEqual(validate('GameView', view), []);
    return [view.combat?.band, view.combat?.active_opponents?.map((m) => [m.id, m.band])];
  };
  const of = (a: unknown, b: unknown) =>
    [
      [h1, a],
      [h2, b],
    ].sort();
  assert.deepEqual(bands(concealed), ['ready', of(undefined, 'ready')]);
  const dead = wounded(w, 0);
  assert.equal(Object.values(dead.state.encounters!)[0]!.active_ids?.includes(h2), true);
  assert.deepEqual(bands(dead), [undefined, of('ready', undefined)]);
});

// Breaks: a goblin already bound to another encounter is pulled into a second pack.
test('admission omits an already engaged helper while retaining the free target', () => {
  const w = fixture();
  const occupied = {
    ...w,
    state: {
      ...w.state,
      encounters: {
        'dddddddd-0000-4000-8000-000000000001': {
          character_id: 'dddddddd-0000-4000-8000-000000000002',
          body_id: 'dddddddd-0000-4000-8000-000000000003',
          npc_id: h1,
          room_id: home,
          job_id: 'dddddddd-0000-4000-8000-000000000004',
          status: 'open',
          round: 1,
          active_ids: [h1],
          next_opponent_id: h1,
        },
      },
    },
  } as never;
  assert.deepEqual(admission(occupied, h2, { n: 0 }), [h2]);
});

// Breaks: a helper's due round cannot be composed after exact pack admission.
test('one pack round rotates the cursor and keeps one current job', () => {
  const w = fixture();
  const begun = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  );
  const due = stepElapsed(
    begun.world,
    {
      id: elapsedCommandId(run, w.context, 64800, 64805) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64800, until: 64805 },
    },
    2,
  );
  assert.equal(due.decision.kind, 'accepted', JSON.stringify(due.decision));
  const row = Object.values(due.world.state.encounters ?? {})[0]!;
  assert.equal(row.round, 2);
  assert.equal(row.next_opponent_id, h1);
  assert.equal(due.world.state.jobs![row.job_id].due_time, 64810);
});

// Breaks: the cursor rotates but every opponent attack is silently substituted with the primary goblin.
test('two healthy rounds use the selected helper for its actual attack', () => {
  const w = fixture();
  const first = due(begun(w));
  assert.equal(first.decision.kind, 'accepted', JSON.stringify(first.decision));
  const second = stepElapsed(
    first.world,
    {
      id: elapsedCommandId(run, w.context, 64805, 64810) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64805, until: 64810 },
    },
    3,
  );
  assert.equal(second.decision.kind, 'accepted', JSON.stringify(second.decision));
  const attacks = (decision: typeof first.decision) =>
    decision.kind === 'accepted'
      ? decision.events.flatMap((event) =>
          event.payload.type === 'attack_result'
            ? [[event.payload.attacker_id, event.payload.target_id]]
            : [],
        )
      : [];
  assert.deepEqual(attacks(first.decision), [
    [w.body, h2],
    [h2, w.body],
  ]);
  assert.deepEqual(attacks(second.decision), [
    [h1, w.body],
    [w.body, h2],
  ]);
  assert.equal(level(second.world, w.body, resourceRef(w, 'hp')), 8);
  assert.equal(level(second.world, h2, resourceRef(w, 'hp')), 6);
  assert.equal(level(second.world, h1, resourceRef(w, 'hp')), 8);
});

// Breaks: a departed primary is still struck or keeps the attack cursor after due pruning.
test('due pruning repairs a departed primary before the player opportunity', () => {
  const w = fixture();
  const joined = begun(w);
  const departed = {
    ...joined,
    state: { ...joined.state, containers: { ...joined.state.containers, [h2]: nest } },
  };
  const result = due(departed);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.flatMap((event) =>
        event.payload.type === 'attack_result' ? [event.payload.target_id] : [],
      )[0],
    h1,
  );
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.equal(row.npc_id, h1);
  assert.deepEqual(row.active_ids, [h1]);
});

// Breaks: when every bound goblin has departed before its due round, closure loses withdrawal narration.
test('an empty due roster closes once and narrates pack withdrawal', () => {
  const joined = begun(fixture());
  const departed = {
    ...joined,
    state: { ...joined.state, containers: { ...joined.state.containers, [h1]: nest, [h2]: nest } },
  };
  const result = due(departed);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  assert.equal(Object.values(result.world.state.encounters ?? {})[0]!.status, 'closed');
  assert.deepEqual(
    result.decision.narration?.map((line) => line.key),
    ['combat.goblins_gone'],
  );
});

// Breaks: Flee closes only the primary while helpers keep a pending retaliatory job.
test('player Flee closes the whole roster and cancels its sole future round', () => {
  const w = begun(fixture());
  const before = Object.values(w.state.encounters ?? {})[0]!;
  const result = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000002' as never,
      world_context_id: w.context,
      payload: { type: 'flee', actor_id: w.character },
    },
    2,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.equal(row.status, 'closed');
  assert.deepEqual(row.active_ids, []);
  assert.equal(row.next_opponent_id, null);
  assert.equal(result.world.state.jobs![before.job_id].status, 'cancelled');
});

// Breaks: a killed selected primary gets a helper's strike in its lost opportunity or ends the pack.
test('player-first selected death skips retaliation and repairs to the surviving helper', () => {
  const w = fixture();
  const result = due(begun(wounded(w, 1)));
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(level(result.world, w.body, resourceRef(w, 'hp')), 10);
  assert.equal(level(result.world, h2, resourceRef(w, 'hp')), 0);
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h1]);
  assert.equal(row.npc_id, h1);
  const view = gameView(result.world);
  assert.deepEqual(validate('GameView', view), []);
  assert.deepEqual(view.combat?.active_opponents, [
    { id: h1, name: 'npc.goblin.short', band: 'ready' },
  ]);
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.filter((event) => event.payload.type === 'attack_result').length,
    1,
  );
  const corpse = result.world.state.containers[spawned(w, 2, 'pelt')];
  assert.equal(result.world.state.created?.[corpse]?.definition.key, 'npc_corpse');
});

// Breaks: a helper strikes the revived player after lethal selected-opponent damage.
test('even-round player death closes every pack member before shrine return', () => {
  const w = fixture();
  const first = due(begun(w));
  assert.equal(first.decision.kind, 'accepted');
  const bodyHp = key({ kind: 'resource', entity_id: w.body, resource: resourceRef(w, 'hp') });
  const controlled = {
    ...first.world,
    state: {
      ...first.world.state,
      resources: { ...first.world.state.resources, [bodyHp]: { value: 1, at: 64805 } },
    },
  };
  const result = stepElapsed(
    controlled,
    {
      id: elapsedCommandId(run, w.context, 64805, 64810) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64805, until: 64810 },
    },
    3,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  const closed = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.equal(closed.status, 'closed');
  assert.deepEqual(closed.active_ids, []);
  assert.equal(result.world.state.containers[w.body], shrine);
  assert.equal(level(result.world, w.body, resourceRef(w, 'hp')), 10);
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.filter((event) => event.payload.type === 'attack_result').length,
    1,
  );
});
