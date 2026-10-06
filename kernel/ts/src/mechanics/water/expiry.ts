import type { Command, JobId, WaterOccupancy } from '../../contracts.gen.ts';
import { accepted, type JobRow, type Mint, type World, bodyOf } from '../../runtime/decision.ts';
import { apply } from '../../runtime/apply.ts';
import { adjust, level, resourceRef } from '../resource.ts';
import { deathSequence } from '../death/sequence.ts';
import { KernelError } from '../../foundation/error.ts';

export function expiry(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
) {
  const actor = job.actor_id!,
    current = world.state.water?.[actor];
  const done = { op: 'job.complete', writer_group: 0, job_id } as const;
  if (!current || !matches(world, job_id, job, current))
    return accepted<never>(world, 'job_ran', [done], []);
  const at = { ...world, state: { ...world.state, clock: job.due_time } };
  const hp = resourceRef(at, 'hp'),
    value = level(at, current.body_id, hp)!;
  if (!(value > 0)) throw new KernelError('precondition_failed');
  const loss = { ...adjust(at, current.body_id, hp, -value, {}).op, at: job.due_time };
  const applied = apply(at, [done, loss]);
  if ('fault' in applied) throw new KernelError('precondition_failed');
  const death = deathSequence(
    applied.world,
    command,
    { loss, owner_id: actor, killer_id: null, credited_character_id: null, cause: 'drowning' },
    mint,
  );
  return accepted(
    world,
    'job_ran',
    [
      done,
      loss,
      ...death.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: job.due_time } : op)),
    ],
    death.events,
    [{ key: world.cartridge.world!.water!.drowned }],
  );
}

function matches(world: World, job_id: JobId, job: JobRow, current: WaterOccupancy) {
  return (
    current.job_id === job_id &&
    current.generation === job.water_generation &&
    current.body_id === job.water_body_id &&
    current.deadline === job.due_time &&
    bodyOf(world, job.actor_id!) === current.body_id &&
    world.state.containers[current.body_id] === current.room_id
  );
}
