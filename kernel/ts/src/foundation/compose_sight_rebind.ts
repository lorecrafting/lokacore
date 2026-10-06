import type { DeltaOp } from '../contracts.gen.ts';
import { encode, type Json } from './canonical.ts';
import { jobCommandId } from './id_source.ts';
import type { State } from './compose.ts';

type Slot = Extract<DeltaOp, { op: 'population.slot' }>;
type Obj = Record<string, any>;
const same = (a: unknown, b: unknown) => encode(a as Json) === encode(b as Json);

/** Permit only the current sight clear followed by its equal-due population arrival. */
export function sightRebindValid(
  state: State,
  ops: readonly DeltaOp[],
  index: number,
  group: number,
) {
  const prior = priorSight(state, ops, index, group);
  return !!prior && arrivalValid(state, ops, prior.bind, prior.old, prior.sight);
}

function priorSight(state: State, ops: readonly DeltaOp[], index: number, group: number) {
  const bind = ops[index];
  if (bind?.op !== 'population.slot' || !bind.value?.sight_job_id) return;
  const prior = ops
    .slice(0, index)
    .filter((o) => o.op === 'population.slot' && same(o.plan, bind.plan) && o.slot === bind.slot);
  if (prior.length !== 1) return;
  const clear = prior[0];
  if (clear?.op !== 'population.slot' || clear.writer_group !== group) return;
  const oldId = clear.expected?.sight_job_id;
  const old = oldId && (state.jobs as Obj | undefined)?.[oldId];
  const sight = old?.sight;
  if (
    !old ||
    old.status !== 'pending' ||
    !sight ||
    !same(old.job, bind.plan) ||
    sight.slot !== bind.slot ||
    sight.member_id !== clear.expected?.member_id ||
    sight.generation !== clear.expected?.generation ||
    !same(clear.value, bind.expected) ||
    clear.value.sight_job_id !== null ||
    bind.value.member_id !== sight.member_id ||
    bind.value.generation !== sight.generation ||
    bind.value.replacement_due !== null ||
    !ops.some((o) => o.op === 'job.complete' && o.writer_group === group && o.job_id === oldId) ||
    ops.some(
      (o) =>
        o.op === 'entity.transfer' && o.writer_group === group && o.entity_id === sight.member_id,
    )
  )
    return;
  return { bind, old, sight };
}

function arrivalValid(state: State, ops: readonly DeltaOp[], bind: Slot, old: Obj, sight: Obj) {
  const population = ops.find(
    (o) =>
      o.op === 'job.complete' &&
      o.writer_group === bind.writer_group &&
      (state.jobs as Obj | undefined)?.[o.job_id]?.due_time === old.due_time &&
      same((state.jobs as Obj)[o.job_id]?.job, bind.plan),
  );
  const scheduled = ops.find(
    (o) =>
      o.op === 'job.schedule' &&
      o.writer_group === bind.writer_group &&
      o.job_id === bind.value.sight_job_id &&
      same(o.job, bind.plan),
  );
  const fresh = scheduled?.op === 'job.schedule' && scheduled.sight;
  return (
    population?.op === 'job.complete' &&
    !!fresh &&
    fresh.cause_kind === 'population_transfer' &&
    fresh.cause_id === jobCommandId(population.job_id, old.due_time) &&
    fresh.player_id === sight.player_id &&
    fresh.member_id === sight.member_id &&
    fresh.slot === bind.slot &&
    fresh.generation === sight.generation &&
    fresh.seen_at === old.due_time &&
    ops.some(
      (o) =>
        o.op === 'entity.transfer' &&
        o.writer_group === bind.writer_group &&
        o.entity_id === sight.member_id &&
        o.source_id === fresh.source_id &&
        o.destination_id === fresh.destination_id,
    )
  );
}
