// Toolbox row 37a (phased world events; docs/system/mechanics.md): a reaction's population.spawn
// births one bundle of the plan into its home, in the highest slot up to cap with no living member
// (or a dead one whose replacement is due) that no earlier step of the delivery took, through the
// plan job's own birth, in the delivery's writer group. No free slot: nothing. No RNG draw (chance
// and targets govern the plan's job only, which fills from slot 1). The member's own id is its
// occurrence id: the plan's wander tells it from the job's births and leaves it home (`held`).
import type { CommandId, DeltaOp, ReactionRule } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import type { Mint, World } from '../../runtime/decision.ts';
import { birthSlot, eligible } from './settle.ts';
import { slotRows } from './shared.ts';

export function spawn(
  world: World,
  step: Extract<ReactionRule['apply'][number], { op: 'population.spawn' }>,
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
  const free = slotRows(world, step.plan, spec.plan.cap)
    .reverse()
    .find(({ slot, row }) => eligible(slot, row, spec.plan.cap, world.state.clock) && !taken(slot));
  if (!free) return [];
  const job = { job: step.plan, due_time: world.state.clock };
  const member = mint(); // birth's first mint is the member's id
  let first = true;
  const own = () => (first ? ((first = false), member) : mint());
  const { ops } = birthSlot(world, member as CommandId, job, free.slot, free.row, own);
  return ops.map((op) => ({ ...op, writer_group: group }));
}
