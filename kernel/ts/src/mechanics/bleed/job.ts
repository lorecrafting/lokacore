import type { BleedRow, Command, DeltaOp, JobId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { same } from '../../foundation/compose.ts';
import { accepted, refString, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { prefix } from '../combat/round_attack.ts';
import { closeEncounter } from '../combat/shared.ts';
import { deathSequence } from '../death/sequence.ts';
import { adjust, level, resourceRef } from '../resource.ts';
import { currentBleed } from './shared.ts';

type Spec = NonNullable<World['cartridge']['bleeds']>[string];
type ActiveBleed = Extract<BleedRow, { active: true }>;

function fatalBleed(
  world: World,
  command: Pick<Command, 'id'>,
  visit: World,
  row: ActiveBleed,
  spec: Spec,
  now: number,
  ops: DeltaOp[],
  mint: Mint,
) {
  const died = deathSequence(
    prefix(visit, ops, now),
    command,
    {
      loss: ops[1] as Extract<DeltaOp, { op: 'resource.adjust' }>,
      owner_id: world.character,
      killer_id: row.source_id!,
      credited_character_id: null,
      cause: 'bleeding',
    },
    mint,
  );
  ops.push(...died.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: now } : op)));
  return accepted(world, 'job_ran', ops, died.events, [{ key: spec.narration.tick }]);
}

function finishBleed(
  world: World,
  command: Pick<Command, 'id'>,
  job: JobRow,
  row: ActiveBleed,
  spec: Spec,
  visit: World,
  current: number | undefined,
  loss: number,
  ops: DeltaOp[],
  mint: Mint,
) {
  const body = job.bleed_body_id!;
  const now = job.due_time;
  if (loss === current) ops.push(...closeEncounter(visit, body));
  ops.push({
    op: 'bleed.transition',
    writer_group: 0,
    body_id: body,
    expected: row,
    value: { active: false, generation: row.generation },
  });
  if (loss === current && loss) return fatalBleed(world, command, visit, row, spec, now, ops, mint);
  return accepted<never>(
    world,
    'job_ran',
    ops,
    [],
    now >= row.ends_at!
      ? [{ key: spec.narration.expired }]
      : loss
        ? [{ key: spec.narration.tick }]
        : [],
  );
}

function continueBleed(
  world: World,
  job: JobRow,
  row: ActiveBleed,
  spec: Spec,
  loss: number,
  tick: boolean,
  ops: DeltaOp[],
  mint: Mint,
) {
  const body = job.bleed_body_id!;
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
  return accepted<never>(world, 'job_ran', ops, [], loss ? [{ key: spec.narration.tick }] : []);
}

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
  if (expired || current === 0 || loss === current)
    return finishBleed(world, command, job, row, spec, visit, current, loss, ops, mint);
  return continueBleed(world, job, row, spec, loss, tick, ops, mint);
}
