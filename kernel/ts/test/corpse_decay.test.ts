// Corpse decay and victim words (owner decision 2026-11-02; mechanics.md death@1 decay).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fragment } from './fragment.ts';
import { fatal } from './death_fixture.ts';
import { command, elapsed } from './c5_bleed_fixture.ts';
import { compose, type State } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { check } from '../src/runtime/invariants.ts';
import { base } from '../src/runtime/apply.ts';
import { gameView } from '../src/view/view.ts';
import type { World } from '../src/runtime/decision.ts';
import { runDecay } from '../src/mechanics/death/job.ts';
import type { DeltaOp, EntityId, JobId } from '../src/contracts.gen.ts';

const showcase = fragment('protocol/fixtures/toolbox_showcase_hash.json');

// A cellar goblin carrying its spawned ear dies at genesis (clock 25200).
function died(change?: (c: any) => void) {
  const world = showcase.genesis(change);
  const [ear] = Object.entries(world.state.created!).find(
    ([, e]) => e.origin.kind === 'spawned' && e.origin.role === 'loot',
  )!;
  const goblin = world.state.containers[ear] as EntityId;
  const room = world.state.containers[goblin]!;
  (world.state.containers as Record<string, string>)[world.body] = room; // the player watches, so the view shows the corpse
  const { next, sequence } = fatal(world, goblin);
  const after = (next as unknown as { world: World }).world;
  const [corpse] = Object.entries(after.state.created!).find(
    ([, e]) => e.origin.kind === 'death' && e.origin.victim_id === goblin,
  )!;
  return { before: world, world: after, ops: sequence.ops, ear, goblin, room, corpse };
}

const jobOf = (world: World, corpse: string) =>
  Object.values(world.state.jobs ?? {}).find((j) => j.corpse_id === corpse);

// Breaks: a death that schedules no decay, the wrong delay, or a spill that loses an item,
// leaves the corpse in play, or fires early.
test('an NPC corpse decays at 15000: its items fall to the room and the corpse leaves play', () => {
  const { world, ear, room, corpse } = died();
  assert.equal(world.state.containers[ear], corpse);
  assert.equal(jobOf(world, corpse)?.due_time, 25200 + 15000);

  const early = elapsed(world, 25200 + 14999, 2).world;
  assert.equal(early.state.containers[corpse], room);
  assert.equal(early.state.containers[ear], corpse);

  const late = elapsed(early, 25200 + 15000, 3).world;
  assert.equal(late.state.containers[ear], room);
  assert.equal(late.state.containers[corpse], world.consumed);
  assert.equal(jobOf(late, corpse)?.status, 'completed');
});

// Breaks: decay scheduled when the world sets none (the no-setting worlds keep their bytes).
test('no npc_corpse_decay schedules no job', () => {
  const { ops } = died((c) => delete c.world.death.npc_corpse_decay);
  assert.deepEqual(
    ops.filter((o) => o.op === 'job.schedule'),
    [],
  );
});

// Breaks: a player corpse that takes the NPC delay, or an owned corpse whose spill faults.
test('an owned player corpse decays at 90000 and spills its items', () => {
  const world = showcase.genesis();
  const [ear] = Object.entries(world.state.created!).find(
    ([, e]) => e.origin.kind === 'spawned' && e.origin.role === 'loot',
  )!;
  // fatal() names the cellar sampler's rat as the player's killer; the showcase's goblin stands in.
  (world.entityIds as Record<string, string>)['cellar_sampler@0.0.8:npc/cellar_rat_1'] =
    world.state.containers[ear]!;
  (world.state.containers as Record<string, string>)[ear] = world.body;
  const room = world.state.containers[world.body]!;
  const after = (fatal(world).next as unknown as { world: World }).world;
  const [corpse] = Object.entries(after.state.created!).find(
    ([, e]) => e.origin.kind === 'death' && e.origin.victim_id === world.body,
  )!;
  assert.equal(after.state.containers[ear], corpse);
  assert.equal(jobOf(after, corpse)?.due_time, 25200 + 90000);
  const late = elapsed(after, 25200 + 90000, 2).world;
  assert.equal(late.state.containers[ear], room);
  assert.equal(late.state.containers[corpse], world.consumed);
});

// Breaks: a decay binding that admits another job's keys, or a decay kind with no corpse.
test('a decay job binds its corpse and nothing else', () => {
  const { world, corpse, room } = died();
  const op = {
    op: 'job.schedule',
    writer_group: 0,
    job_id: '00000000-0000-4000-8000-0000000000ab' as JobId,
    job: { ...jobOf(world, corpse)!.job },
    due_time: 50000,
    corpse_id: corpse as EntityId,
  } as const;
  // The invariant restates compose independently, so each verdict must agree with it.
  const faulted = (o: object, state = base(world) as unknown as State) => {
    const result = compose(state, { ops: [o as DeltaOp] }) as object;
    assert.ok(check('delta_preconditions_hold', { state, delta: { ops: [o] }, result }));
    return 'fault' in result;
  };
  assert.equal(faulted(op), false);
  assert.equal(faulted({ ...op, actor_id: world.character }), true);
  const { corpse_id: _, ...unbound } = op;
  assert.equal(faulted(unbound), true);
  // A compose that accepted the unbound job: the invariant alone must refuse it.
  const state = base(world) as unknown as State;
  const fake = compose(state, { ops: [op] }) as { changes: { value: object }[] };
  const { corpse_id: _c, ...row } = fake.changes[0]!.value as { corpse_id: string };
  fake.changes[0]!.value = row;
  assert.equal(
    check('delta_preconditions_hold', { state, delta: { ops: [unbound] }, result: fake }),
    false,
  );
  // The same for a null corpse: compose and the invariant both refuse it.
  const nulled = { ...op, corpse_id: null };
  assert.equal(faulted(nulled), true);
  const nullRow = compose(state, { ops: [op] }) as { changes: { value: object }[] };
  nullRow.changes[0]!.value = { ...nullRow.changes[0]!.value, corpse_id: null };
  assert.equal(
    check('delta_preconditions_hold', { state, delta: { ops: [nulled] }, result: nullRow }),
    false,
  );
  const rot = { op: 'entity.transfer', writer_group: 0, entity_id: corpse, source_id: room };
  const gone = { ...rot, destination_id: world.consumed };
  assert.equal(faulted(gone), false);
  assert.equal(faulted({ ...gone, entity_id: world.body }), true); // not death-created
  assert.equal(faulted({ ...gone, consumption: 'eaten' }), true); // a decay is no meal
  const carried = {
    ...base(world),
    containers: { ...world.state.containers, [corpse]: world.body },
  };
  assert.equal(faulted({ ...gone, source_id: world.body }, carried as unknown as State), true);
});

// Breaks: a spill in insertion order or reversed instead of EntityId order (mechanics.md death@1).
test('a decay spills the corpse contents in EntityId order', () => {
  const { world, corpse, ear, room } = died();
  const id = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;
  // Inserted b, c, a: neither insertion order nor its reverse is sorted.
  const containers = {
    ...world.state.containers,
    [ear]: room,
    [id('0b')]: corpse,
    [id('0c')]: corpse,
    [id('0a')]: corpse,
  };
  const decided = runDecay(
    { ...world, state: { ...world.state, containers } } as World,
    id('ff') as JobId,
    jobOf(world, corpse)!,
  ) as unknown as { delta: { ops: { op: string; entity_id?: string }[] } };
  const moved = decided.delta.ops.filter((o) => o.op === 'entity.transfer').map((o) => o.entity_id);
  assert.deepEqual(moved, [id('0a'), id('0b'), id('0c'), corpse]);
});

// Breaks: a corpse view without its victim, or a victim field the GameView schema refuses.
test('the corpse view names its victim as the player sees the goblin', () => {
  const { world, goblin, corpse } = died();
  const view = gameView(world);
  const shown = view.entities.find((e) => e.id === corpse);
  const victim = view.entities.find((e) => e.id === goblin);
  assert.ok(shown);
  assert.equal(victim, undefined);
  assert.equal(shown.victim, 'npc.goblin.short');
  assert.deepEqual(validate('GameView', view), []);
});

// Breaks: a decay that reads only the saved corpse rows, so a corpse created earlier in the same
// advance faults its own decay and the whole span is lost (review of PR #593).
test('a goblin that dies and decays inside one elapsed span leaves play', () => {
  const world = showcase.genesis((c) => {
    c.entry.key = 'sapper_cellar';
    c.world.combat.player_attack = { chance: 100, damage_min: 100, damage_max: 100 };
    for (const [k, npc] of Object.entries(c.npcs) as [string, any][])
      if (k.endsWith('goblin')) npc.attack = { ...npc.attack, chance: 0 };
  });
  const [ear] = Object.entries(world.state.created!).find(
    ([, e]) => e.origin.kind === 'spawned' && e.origin.role === 'loot',
  )!;
  const attack = command(world, 1, { type: 'attack', target_id: world.state.containers[ear] }, 1);
  assert.equal(attack.decision.kind, 'accepted', JSON.stringify(attack.decision));
  const span = elapsed(attack.world, 45200, 2);
  assert.equal(span.decision.kind, 'accepted', JSON.stringify(span.decision));
  const corpses = Object.entries(span.world.state.created!).filter(
    ([, e]) => e.origin.kind === 'death',
  );
  // The first corpse falls at 25200, the second in the 25350 round; both are due by 40350.
  assert.equal(corpses.length, 2);
  for (const [corpse] of corpses) {
    assert.equal(span.world.state.containers[corpse], world.consumed);
  }
  assert.deepEqual(
    corpses.map(([corpse]) => jobOf(span.world, corpse)?.due_time).sort(),
    [40200, 40350],
  );
});

// Breaks: an independent guard that reads only saved corpse rows, so it refuses (or a composer
// faults) a corpse's decay in the proposal that creates it.
test('the guard admits a corpse created and decayed in one proposal', () => {
  const { before, ops, corpse, room, world } = died();
  const group = ops.find((o) => o.op === 'entity.create')!.writer_group;
  const rot = {
    op: 'entity.transfer',
    writer_group: group,
    entity_id: corpse,
    source_id: room,
    destination_id: world.consumed,
  } as DeltaOp;
  const state = base(before) as unknown as State;
  const delta = { ops: [...ops, rot] };
  const result = compose(state, delta) as object;
  assert.equal('fault' in result, false, JSON.stringify(result));
  assert.ok(check('delta_preconditions_hold', { state, delta, result }));
});
