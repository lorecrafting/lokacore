// Replenish (toolbox row 19b; docs/system/mechanics.md Replenish): a due job moves authored,
// conserved items from a reserve holder to a target holder up to a cap. Nothing is minted.
import {
  LIMITS,
  type DefinitionRef,
  type DeltaOp,
  type EntityId,
  type ItemLocation,
  type JobId,
} from '../../contracts.gen.ts';
import {
  accepted,
  entries,
  refString,
  type Cartridge,
  type JobRow,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';
import { selected } from './stock.ts';

/** A fresh world's replenish jobs, in DefinitionRefString order, each first due at clock + every. */
export function firstReplenish(cartridge: Cartridge, clock: number, mint: Mint) {
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  const jobs: Record<string, JobRow> = {};
  for (const [, r] of entries(cartridge.replenish ?? {}).sort(([a], [b]) => cmp(a, b))) {
    const job = { cartridge_id, cartridge_version, kind: 'replenish', key: r.key };
    jobs[mint()] = { job, due_time: clock + r.every, status: 'pending' };
  }
  return jobs;
}

// The loader refuses a template location, so `at` names a room, an NPC or an item.
const holder = (world: World, at: ItemLocation): EntityId =>
  at.in === 'room'
    ? world.roomIds[refString(at.room)]
    : world.entityIds[refString(at.in === 'npc' ? at.npc : (at as { item: DefinitionRef }).item)];

// The target's free room: its declared capacity less everything directly in it, whatever the
// item (as commerce/shared.ts), so a move never exceeds it; unbounded without a capacity.
function free(world: World, to: EntityId, steps: Steps): number | 'budget_exceeded' {
  let left = world.capacities[to] ?? Infinity;
  if (left !== Infinity)
    for (const c of Object.values(world.state.containers)) {
      if (++steps.n > LIMITS.query_steps) return 'budget_exceeded';
      if (c === to) left--;
    }
  return left;
}

/**
 * One run at `at` (the due time, or a crossed step's): move up to `count` of the entry's items
 * from `from` to `to` until `to` holds `cap`, complete the job and schedule the next at
 * `at + every`; a next time the advance also crosses is returned as `next`, its own drain step.
 */
export function runReplenish(
  world: World,
  job_id: JobId,
  row: JobRow,
  mint: Mint,
  steps: Steps,
  at: number,
) {
  const r = world.cartridge.replenish![refString(row.job)];
  const [from, to] = [holder(world, r.from), holder(world, r.to)];
  const held = selected(world, r.items, to, Infinity, steps);
  if (typeof held === 'string') return { kind: 'fault', code: held } as const;
  const space = free(world, to, steps);
  if (typeof space === 'string') return { kind: 'fault', code: space } as const;
  const room = Math.max(0, Math.min(r.cap - held.length, space));
  const moved = selected(world, r.items, from, Math.min(r.count, room), steps);
  if (typeof moved === 'string') return { kind: 'fault', code: moved } as const;
  const ops: DeltaOp[] = moved.map((entity_id) => ({
    op: 'entity.transfer',
    writer_group: 0,
    entity_id,
    source_id: from,
    destination_id: to,
  }));
  if (row.status === 'pending') ops.push({ op: 'job.complete', writer_group: 0, job_id });
  const due_time = at + r.every;
  const crossed = due_time <= world.state.clock;
  if (!crossed)
    ops.push({
      op: 'job.schedule',
      writer_group: 0,
      job: row.job,
      due_time,
      job_id: mint() as JobId,
    });
  const ran = accepted<never>(world, 'job_ran', ops, []);
  return crossed ? { ...ran, next: due_time } : ran;
}
