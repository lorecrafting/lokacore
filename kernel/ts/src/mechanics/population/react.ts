// Toolbox row 37a (phased world events; docs/system/mechanics.md): a reaction's population.spawn
// births one bundle of the plan into its home, in the lowest slot up to cap with no living member
// that no earlier step of the delivery took, through the plan job's own birth, in the delivery's
// writer group. No free slot: nothing. No RNG draw (chance and targets govern the plan's job only).
import type { CommandId, DeltaOp, ReactionRule } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import type { Mint, World } from '../../runtime/decision.ts';
import { birthSlot, eligible } from './settle.ts';

export function spawn(
  world: World,
  step: Extract<ReactionRule['apply'][number], { op: 'population.spawn' }>,
  occurrence_id: CommandId,
  group: number,
  earlier: readonly DeltaOp[],
  mint: Mint,
): DeltaOp[] {
  const spec = world.populationSpecs[key(step.plan)];
  if (!spec) return [];
  const taken = (slot: number) =>
    earlier.some(
      (o) => o.op === 'population.slot' && o.slot === slot && key(o.plan) === key(step.plan),
    );
  for (let slot = 1; slot <= spec.plan.cap; slot++) {
    const row =
      world.state.population_slots?.[key({ kind: 'population_slot', plan: step.plan, slot })];
    if (!row || !eligible(slot, row, spec.plan.cap, Infinity) || taken(slot)) continue;
    const job = { job: step.plan, due_time: world.state.clock };
    const { ops } = birthSlot(world, occurrence_id, job, slot, row, mint);
    return ops.map((op) => ({ ...op, writer_group: group }));
  }
  return [];
}
