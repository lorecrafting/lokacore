// Corpse decay and victim words (owner decision 2026-11-02; mechanics.md death@1 decay).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fragment } from './fragment.ts';
import { fatal } from './death_fixture.ts';
import { elapsed } from './c5_bleed_fixture.ts';
import { compose } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { gameView } from '../src/view/view.ts';
import type { World } from '../src/runtime/decision.ts';
import type { EntityId, JobId } from '../src/contracts.gen.ts';

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
  return { world: after, ops: sequence.ops, ear, goblin, room, corpse };
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
  const { world, corpse } = died();
  const op = {
    op: 'job.schedule',
    writer_group: 0,
    job_id: '00000000-0000-4000-8000-0000000000ab' as JobId,
    job: { ...jobOf(world, corpse)!.job },
    due_time: 50000,
    corpse_id: corpse as EntityId,
  } as const;
  const faulted = (o: object) =>
    'fault' in (compose(world.state as never, { ops: [o as never] }) as object);
  assert.equal(faulted(op), false);
  assert.equal(faulted({ ...op, actor_id: world.character }), true);
  const { corpse_id: _, ...unbound } = op;
  assert.equal(faulted(unbound), true);
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
