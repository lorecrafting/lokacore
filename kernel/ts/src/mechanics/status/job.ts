import type { Command, DeltaOp, JobId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { accepted, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { prefix } from '../combat/round_attack.ts';
import { closeEncounter } from '../combat/shared.ts';
import { deathSequence } from '../death/sequence.ts';
import { adjust, level, resourceSpec } from '../resource.ts';
import { currentStatus, endStatus, specOf } from './shared.ts';

/** A due status tick or expiry on the player's body; an obsolete job completes harmlessly. */
export function runStatus(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
) {
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  const body = world.body;
  const status = job.job;
  const row = currentStatus(world, body, status);
  if (!row || row.job_id !== job_id) return accepted<never>(world, 'job_ran', [done], []);
  const spec = specOf(world, status);
  if (!spec) return { kind: 'fault', code: 'precondition_failed' } as const;
  const now = job.due_time;
  const visit = { ...world, state: { ...world.state, clock: now } };
  const current = level(visit, body, spec.resource);
  const pool = resourceSpec(visit, body, spec.resource);
  const expired = now >= row.ends_at;
  const tick = !expired && now >= row.next_tick_at && current !== undefined && pool !== undefined;
  // Saturate at the pool bounds; the op itself stays exact.
  const by = tick
    ? Math.max(pool.minimum - current, Math.min(pool.maximum - current, spec.per_tick))
    : 0;
  const ops: DeltaOp[] = [done];
  if (by) ops.push({ ...adjust(visit, body, spec.resource, by, {}).op, at: now });
  const fatal = by < 0 && spec.resource.key === 'hp' && current! + by === 0;
  if (fatal) ops.push(...closeEncounter(visit, body));
  if (expired || fatal) ops.push(endStatus(body, status, row, 0));
  if (fatal) {
    const died = deathSequence(
      prefix(visit, ops, now),
      command,
      {
        loss: ops[1] as Extract<DeltaOp, { op: 'resource.adjust' }>,
        owner_id: world.character,
        killer_id: null,
        credited_character_id: null,
      },
      mint,
    );
    ops.push(...died.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: now } : op)));
    return accepted(world, 'job_ran', ops, died.events, [{ key: spec.narration.tick }]);
  }
  if (expired) return accepted<never>(world, 'job_ran', ops, [], [{ key: spec.narration.expired }]);
  const next_tick_at = tick ? add(row.next_tick_at, spec.tick_every) : row.next_tick_at;
  const successor = mint() as JobId;
  ops.push({
    op: 'status.transition',
    writer_group: 0,
    body_id: body,
    status,
    expected: row,
    value: { ...row, next_tick_at, job_id: successor },
  });
  ops.push({
    op: 'job.schedule',
    writer_group: 0,
    job_id: successor,
    job: status,
    due_time: Math.min(next_tick_at, row.ends_at),
  });
  return accepted<never>(world, 'job_ran', ops, [], by ? [{ key: spec.narration.tick }] : []);
}
