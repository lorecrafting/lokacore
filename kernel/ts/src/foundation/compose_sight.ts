import type { DeltaOp } from '../contracts.gen.ts';
import { encode, type Json } from './canonical.ts';
import type { State } from './compose.ts';

type Obj = Record<string, any>;
const key = (value: Json): string => encode(value);
const section = (state: State, name: string): Obj => (state[name] ?? {}) as Obj;

/** Only a surviving equal-time deer round may lend its group to sight closure. */
export function sightHandoffValid(state: State, ops: readonly DeltaOp[]): boolean {
  if (!ops.some((op) => op.op === 'job.complete' && section(state, 'jobs')[op.job_id]?.sight))
    return true;
  let highest = -1;
  const back: { op: DeltaOp; at: number }[] = [];
  for (const [at, op] of ops.entries()) {
    if (op.writer_group < highest) back.push({ op, at });
    highest = Math.max(highest, op.writer_group);
  }
  if (!back.length) return true;
  if (back.length !== 2) return false;
  const [{ op: close, at: closeAt }, { op: cancel, at: cancelAt }] = back;
  if (!handoffPair(close, cancel, closeAt, cancelAt)) return false;
  if (close.op !== 'encounter.close') return false;
  const advanceAt = ops.findIndex(
    (o) =>
      o.op === 'encounter.advance' &&
      o.writer_group === close.writer_group &&
      o.encounter_id === close.encounter_id &&
      o.next_job_id === close.job_id,
  );
  if (advanceAt < 0 || advanceAt >= closeAt) return false;
  const advance = ops[advanceAt];
  if (advance.op !== 'encounter.advance') return false;
  const old = section(state, 'jobs')[advance.job_id];
  const initial = section(state, 'encounters')[close.encounter_id];
  if (!roundValid(state, ops, close, advance, old, initial)) return false;
  if (!sightClosureValid(state, ops, close, old, initial)) return false;
  return !ops
    .slice(advanceAt + 1, closeAt)
    .some(
      (o) =>
        o.writer_group !== close.writer_group &&
        (('encounter_id' in o && o.encounter_id === close.encounter_id) ||
          ('job_id' in o && o.job_id === close.job_id)),
    );
}

function handoffPair(close: DeltaOp, cancel: DeltaOp, closeAt: number, cancelAt: number): boolean {
  return (
    close.op === 'encounter.close' &&
    cancel.op === 'job.cancel' &&
    cancelAt === closeAt + 1 &&
    close.writer_group === cancel.writer_group &&
    close.encounter_id === cancel.encounter_id &&
    close.job_id === cancel.job_id
  );
}

function roundValid(
  state: State,
  ops: readonly DeltaOp[],
  close: Extract<DeltaOp, { op: 'encounter.close' }>,
  advance: Extract<DeltaOp, { op: 'encounter.advance' }>,
  old: Obj,
  initial: Obj,
): boolean {
  const scheduled = ops.find(
    (o) =>
      o.op === 'job.schedule' &&
      o.writer_group === close.writer_group &&
      o.job_id === close.job_id &&
      o.encounter_id === close.encounter_id,
  );
  const completed = ops.find(
    (o) =>
      o.op === 'job.complete' &&
      o.writer_group === close.writer_group &&
      o.job_id === advance.job_id,
  );
  return (
    !!initial &&
    initial.status === 'open' &&
    initial.job_id === advance.job_id &&
    !!old &&
    old.status === 'pending' &&
    old.encounter_id === close.encounter_id &&
    !!scheduled &&
    !!completed
  );
}

function sightClosureValid(
  state: State,
  ops: readonly DeltaOp[],
  close: Extract<DeltaOp, { op: 'encounter.close' }>,
  old: Obj,
  initial: Obj,
): boolean {
  const sightDone = sightCompletion(state, ops, close.writer_group, initial.npc_id);
  if (sightDone?.op !== 'job.complete') return false;
  const sightJob = section(state, 'jobs')[sightDone.job_id];
  const sight = sightJob.sight;
  const slot = section(state, 'population_slots')[
    encode({ kind: 'population_slot', plan: sightJob.job, slot: sight.slot } as Json)
  ];
  const flight = ops.find(
    (o) =>
      o.op === 'entity.transfer' &&
      o.writer_group === sightDone.writer_group &&
      o.entity_id === sight.member_id,
  );
  const slotWrite = ops.find(
    (o) =>
      o.op === 'population.slot' &&
      o.writer_group === sightDone.writer_group &&
      o.slot === sight.slot &&
      encode(o.plan as Json) === encode(sightJob.job),
  );
  return closureRowsMatch(
    state,
    old,
    initial,
    sightDone.job_id,
    sightJob,
    sight,
    slot,
    flight,
    slotWrite,
  );
}

function sightCompletion(state: State, ops: readonly DeltaOp[], group: number, member: string) {
  return ops.find(
    (o) =>
      o.op === 'job.complete' &&
      o.writer_group > group &&
      section(state, 'jobs')[o.job_id]?.sight?.member_id === member,
  );
}

function closureRowsMatch(
  state: State,
  old: Obj,
  initial: Obj,
  doneId: string,
  sightJob: Obj,
  sight: Obj,
  slot: Obj,
  flight: DeltaOp | undefined,
  slotWrite: DeltaOp | undefined,
): boolean {
  return (
    sightJob.status === 'pending' &&
    old.due_time === sightJob.due_time &&
    initial.npc_id === sight.member_id &&
    !!slot &&
    slot.member_id === sight.member_id &&
    slot.generation === sight.generation &&
    slot.sight_job_id === doneId &&
    flight?.op === 'entity.transfer' &&
    flight.source_id === section(state, 'containers')[sight.member_id] &&
    slotWrite?.op === 'population.slot' &&
    slotWrite.value.member_id === sight.member_id &&
    slotWrite.value.sight_job_id == null &&
    slotWrite.value.last_flight_at === sightJob.due_time
  );
}

export function sightSlot(
  s: Extract<DeltaOp, { op: 'population.slot' }>,
  ops: readonly DeltaOp[],
  state: State,
) {
  const prior = s.expected;
  const id = s.value.member_id;
  if (
    !prior ||
    !id ||
    prior.member_id !== id ||
    prior.generation !== s.value.generation ||
    s.value.replacement_due !== null ||
    s.value.last_flight_at !== prior.last_flight_at ||
    s.value.sight_job_id === prior.sight_job_id
  )
    return false;
  const scheduled = ops.find(
    (op) =>
      op.op === 'job.schedule' &&
      op.writer_group === s.writer_group &&
      op.job_id === s.value.sight_job_id,
  );
  const completed = ops.find(
    (op) =>
      op.op === 'job.complete' &&
      op.writer_group === s.writer_group &&
      op.job_id === prior?.sight_job_id,
  );
  if (scheduled?.op === 'job.schedule') return sightScheduleValid(s, ops, state, scheduled);
  return (
    s.value.sight_job_id == null &&
    completed?.op === 'job.complete' &&
    ((state.jobs ?? {}) as Record<string, Obj>)[completed.job_id]?.sight !== undefined
  );
}

function sightScheduleValid(
  s: Extract<DeltaOp, { op: 'population.slot' }>,
  ops: readonly DeltaOp[],
  state: State,
  scheduled: Extract<DeltaOp, { op: 'job.schedule' }>,
): boolean {
  const prior = s.expected!;
  const id = s.value.member_id;
  const sight = scheduled.sight;
  const plan = ((state.population_specs ?? {}) as Record<string, Obj>)[key(s.plan as Json)]
    ?.plan as Obj | undefined;
  const entered = ops.some(
    (op) =>
      op.op === 'entity.transfer' &&
      op.writer_group === s.writer_group &&
      op.source_id === sight?.source_id &&
      op.destination_id === sight?.destination_id &&
      (op.entity_id === id ||
        ((state.known_entities ?? {}) as Record<string, Obj>)[op.entity_id]?.kind === 'body'),
  );
  const old = prior.sight_job_id;
  return (
    !!plan?.sight &&
    !!sight &&
    key(scheduled.job) === key(s.plan as Json) &&
    sight.member_id === id &&
    sight.slot === s.slot &&
    sight.generation === s.value.generation &&
    (old == null ||
      ops.some(
        (op) =>
          op.op === 'job.cancel' &&
          op.writer_group === s.writer_group &&
          op.job_id === old &&
          op.sight_member_id === id,
      )) &&
    entered
  );
}
