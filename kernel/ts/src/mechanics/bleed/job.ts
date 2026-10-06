import type { Command, DeltaOp, JobId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { same } from '../../foundation/compose.ts';
import { accepted, refString, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { prefix } from '../combat/round_attack.ts';
import { closeEncounter } from '../combat/shared.ts';
import { deathSequence } from '../death/sequence.ts';
import { adjust, level, resourceRef } from '../resource.ts';
import { currentBleed } from './shared.ts';

/** A current body bleed delivery; an obsolete occurrence completes harmlessly. */
export function runBleed(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
) {
  const body = job.bleed_body_id!;
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  const row = currentBleed(world, body);
  if (
    !row ||
    row.job_id !== job_id ||
    row.generation !== job.bleed_generation ||
    !same(row.effect, job.job)
  )
    return accepted<never>(world, 'job_ran', [done], []);
  const now = job.due_time;
  const spec = world.cartridge.bleeds?.[refString(row.effect!)];
  if (!spec) return { kind: 'fault', code: 'precondition_failed' } as const;
  const visit = { ...world, state: { ...world.state, clock: now } };
  const hp = resourceRef(visit, 'hp');
  const current = level(visit, body, hp);
  const expired = now >= row.ends_at!;
  const tick = !expired && now >= row.next_tick_at! && current !== undefined && current > 0;
  const loss = tick ? Math.min(current!, spec.hp_loss) : 0;
  const ops: DeltaOp[] = [done];
  if (loss) ops.push({ ...adjust(visit, body, hp, -loss, {}).op, at: now });
  if (expired || current === 0 || loss === current) {
    if (loss === current) ops.push(...closeEncounter(visit, body));
    ops.push({
      op: 'bleed.transition',
      writer_group: 0,
      body_id: body,
      expected: row,
      value: { active: false, generation: row.generation },
    });
    if (loss === current && loss) {
      const died = deathSequence(
        prefix(visit, ops, now),
        command,
        {
          loss: ops[1] as Extract<DeltaOp, { op: 'resource.adjust' }>,
          owner_id: world.character,
          killer_id: row.source_id!,
          credited_character_id: null,
        },
        mint,
      );
      ops.push(...died.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: now } : op)));
      return accepted(world, 'job_ran', ops, died.events);
    }
    return accepted<never>(world, 'job_ran', ops, []);
  }
  const next_tick_at = tick ? add(row.next_tick_at!, spec.tick_every) : row.next_tick_at!;
  const due_time = Math.min(next_tick_at, row.ends_at!);
  const successor = mint() as JobId;
  ops.push({
    op: 'bleed.transition',
    writer_group: 0,
    body_id: body,
    expected: row,
    value: { ...row, next_tick_at, job_id: successor },
  });
  ops.push({
    op: 'job.schedule',
    writer_group: 0,
    job_id: successor,
    job: row.effect!,
    bleed_body_id: body,
    bleed_generation: row.generation,
    due_time,
  });
  return accepted<never>(world, 'job_ran', ops, []);
}
