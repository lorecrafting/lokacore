import { encode } from '../foundation/canonical.ts';
import { same } from '../foundation/compose.ts';
import type { DeltaOp, JobId } from '../contracts.gen.ts';
import type { World } from './decision.ts';

type Close = Extract<DeltaOp, { op: 'encounter.close' }>;
type Sight = NonNullable<NonNullable<World['state']['jobs']>[string]['sight']>;

/** The only permitted reuse of a preceding due job's writer group. */
export function sightHandoff(
  prior: World,
  composed: readonly DeltaOp[],
  at: World,
  sight_id: JobId,
  due_time: number,
  ops: readonly DeltaOp[],
) {
  const pair = sightPair(at, sight_id, ops);
  if (!pair) return;
  const { sight, close } = pair;
  const advanceAt = composed.findIndex(
    (o) =>
      o.op === 'encounter.advance' &&
      o.encounter_id === close.encounter_id &&
      o.next_job_id === close.job_id,
  );
  if (advanceAt < 0) return;
  const advance = composed[advanceAt];
  if (advance.op !== 'encounter.advance') return;
  if (!priorRound(prior, composed, at, advance, close, due_time, advanceAt)) return;
  return {
    group: advance.writer_group,
    encounter_id: close.encounter_id,
    successor_id: close.job_id,
  };
}

function sightPair(at: World, sight_id: JobId, ops: readonly DeltaOp[]) {
  const sight = at.state.jobs?.[sight_id]?.sight;
  if (!sight) return;
  const flight = ops.find(
    (o): o is Extract<DeltaOp, { op: 'entity.transfer' }> =>
      o.op === 'entity.transfer' && o.entity_id === sight.member_id,
  );
  const close = ops.find((o): o is Close => o.op === 'encounter.close');
  const cancel = ops.find((o) => o.op === 'job.cancel' && o.encounter_id === close?.encounter_id);
  if (
    !flight ||
    !close ||
    cancel?.op !== 'job.cancel' ||
    close.job_id !== cancel.job_id ||
    sight.player_id !== at.character ||
    at.state.containers[at.body] !== flight.source_id ||
    at.state.containers[sight.member_id] !== flight.source_id ||
    !sightBinding(at, sight_id, sight, close)
  )
    return;
  return { sight, close };
}

function sightBinding(at: World, sight_id: JobId, sight: Sight, close: Close): boolean {
  const row = at.state.encounters?.[close.encounter_id];
  if (
    !row ||
    row.status !== 'open' ||
    row.npc_id !== sight.member_id ||
    row.job_id !== close.job_id
  )
    return false;
  const binding =
    at.state.population_slots?.[
      encode({
        kind: 'population_slot',
        plan: at.state.jobs![sight_id]!.job,
        slot: sight.slot,
      } as never)
    ];
  return (
    !!binding &&
    binding.member_id === sight.member_id &&
    binding.generation === sight.generation &&
    binding.sight_job_id === sight_id &&
    binding.replacement_due === null
  );
}

function priorRound(
  prior: World,
  composed: readonly DeltaOp[],
  at: World,
  advance: Extract<DeltaOp, { op: 'encounter.advance' }>,
  close: Close,
  due_time: number,
  advanceAt: number,
): boolean {
  const old = prior.state.jobs?.[advance.job_id];
  const successor = at.state.jobs?.[close.job_id];
  return (
    !!old &&
    old.due_time === due_time &&
    old.encounter_id === close.encounter_id &&
    !!successor &&
    successor.status === 'pending' &&
    successor.encounter_id === close.encounter_id &&
    same(successor.job, old.job) &&
    composed.some(
      (o) =>
        o.op === 'job.complete' &&
        o.writer_group === advance.writer_group &&
        o.job_id === advance.job_id,
    ) &&
    composed.some(
      (o) =>
        o.op === 'job.schedule' &&
        o.writer_group === advance.writer_group &&
        o.job_id === close.job_id &&
        o.encounter_id === close.encounter_id,
    ) &&
    noInterference(composed, advance, close, advanceAt)
  );
}

function noInterference(
  composed: readonly DeltaOp[],
  advance: Extract<DeltaOp, { op: 'encounter.advance' }>,
  close: Close,
  advanceAt: number,
): boolean {
  return !composed
    .slice(advanceAt + 1)
    .some(
      (o) =>
        o.writer_group !== advance.writer_group &&
        ((o.op.startsWith('encounter.') &&
          'encounter_id' in o &&
          o.encounter_id === close.encounter_id) ||
          ('job_id' in o && o.job_id === close.job_id)),
    );
}

export function handoffGroup(
  op: DeltaOp,
  handoff: ReturnType<typeof sightHandoff>,
  next: number,
): number {
  return handoff &&
    ((op.op === 'encounter.close' &&
      op.encounter_id === handoff.encounter_id &&
      op.job_id === handoff.successor_id) ||
      (op.op === 'job.cancel' &&
        op.job_id === handoff.successor_id &&
        op.encounter_id === handoff.encounter_id))
    ? handoff.group
    : next;
}
