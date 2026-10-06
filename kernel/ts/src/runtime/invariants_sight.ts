import { key, same } from '../foundation/compose.ts';
type Any = any;

/** Independent prior/result check for the sole nonmonotonic writer-group continuation. */
export function sightHandoffHolds(state: Any, ops: Any[], result: Any): boolean {
  if (!ops.some((op) => op.op === 'job.complete' && state.jobs?.[op.job_id]?.sight)) return true;
  let high = -1;
  const reused: { row: Any; at: number }[] = [];
  ops.forEach((row, at) => {
    if (row.writer_group < high) reused.push({ row, at });
    high = Math.max(high, row.writer_group);
  });
  if (!reused.length) return true;
  if (reused.length !== 2) return false;
  const [closing, cancelling] = reused;
  const close = closing.row,
    cancel = cancelling.row;
  if (!handoffPair(close, cancel, closing.at, cancelling.at)) return false;
  const prior = state.encounters?.[close.encounter_id];
  const advanceAt = ops.findIndex(
    (row) =>
      row.op === 'encounter.advance' &&
      row.writer_group === close.writer_group &&
      row.encounter_id === close.encounter_id &&
      row.next_job_id === close.job_id,
  );
  if (!prior || prior.status !== 'open' || advanceAt < 0 || advanceAt >= closing.at) return false;
  const advance = ops[advanceAt],
    round = state.jobs?.[advance.job_id];
  if (!roundValid(ops, close, advance, round, prior)) return false;
  if (!sightClosureValid(state, ops, result, close, round, prior)) return false;
  return !ops
    .slice(advanceAt + 1, closing.at)
    .some(
      (row) =>
        row.writer_group !== close.writer_group &&
        (row.encounter_id === close.encounter_id || row.job_id === close.job_id),
    );
}

function handoffPair(close: Any, cancel: Any, closeAt: number, cancelAt: number): boolean {
  return (
    close.op === 'encounter.close' &&
    cancel.op === 'job.cancel' &&
    cancelAt === closeAt + 1 &&
    close.writer_group === cancel.writer_group &&
    close.encounter_id === cancel.encounter_id &&
    close.job_id === cancel.job_id
  );
}

function roundValid(ops: Any[], close: Any, advance: Any, round: Any, prior: Any): boolean {
  const successor = ops.find(
    (row) =>
      row.op === 'job.schedule' &&
      row.writer_group === close.writer_group &&
      row.job_id === close.job_id &&
      row.encounter_id === close.encounter_id,
  );
  return (
    prior.job_id === advance.job_id &&
    round?.status === 'pending' &&
    round.encounter_id === close.encounter_id &&
    !!successor &&
    ops.some(
      (row) =>
        row.op === 'job.complete' &&
        row.writer_group === close.writer_group &&
        row.job_id === advance.job_id,
    )
  );
}

function sightClosureValid(
  state: Any,
  ops: Any[],
  result: Any,
  close: Any,
  round: Any,
  prior: Any,
): boolean {
  const sightDone = sightCompletion(state, ops, close.writer_group, prior.npc_id);
  const sightJob = sightDone && state.jobs[sightDone.job_id];
  const sight = sightJob?.sight;
  if (!sight) return false;
  const slot =
    state.population_slots?.[
      key({ kind: 'population_slot', plan: sightJob.job, slot: sight.slot })
    ];
  const flight = ops.find(
    (row) =>
      row.op === 'entity.transfer' &&
      row.writer_group === sightDone.writer_group &&
      row.entity_id === sight.member_id,
  );
  const bound = boundSlot(ops, sightDone, sightJob, sight);
  return closureRowsMatch(
    state,
    result,
    close,
    round,
    prior,
    sightDone,
    sightJob,
    sight,
    slot,
    flight,
    bound,
  );
}

function boundSlot(ops: Any[], sightDone: Any, sightJob: Any, sight: Any) {
  return ops.find(
    (row) =>
      row.op === 'population.slot' &&
      row.writer_group === sightDone.writer_group &&
      row.slot === sight.slot &&
      same(row.plan, sightJob.job),
  );
}

function sightCompletion(state: Any, ops: Any[], group: number, member: string) {
  return ops.find(
    (row) =>
      row.op === 'job.complete' &&
      row.writer_group > group &&
      state.jobs?.[row.job_id]?.sight?.member_id === member,
  );
}

function closureRowsMatch(
  state: Any,
  result: Any,
  close: Any,
  round: Any,
  prior: Any,
  sightDone: Any,
  sightJob: Any,
  sight: Any,
  slot: Any,
  flight: Any,
  bound: Any,
): boolean {
  return (
    sightJob.status === 'pending' &&
    round.due_time === sightJob.due_time &&
    prior.npc_id === sight.member_id &&
    slot?.member_id === sight.member_id &&
    slot.generation === sight.generation &&
    slot.sight_job_id === sightDone.job_id &&
    !!flight &&
    flight.source_id === state.containers?.[sight.member_id] &&
    !!bound &&
    bound.value.member_id === sight.member_id &&
    bound.value.sight_job_id == null &&
    bound.value.last_flight_at === sightJob.due_time &&
    result.changes.some(
      (c: Any) =>
        c.target.kind === 'encounter' &&
        c.target.encounter_id === close.encounter_id &&
        c.value?.status === 'closed',
    )
  );
}

export function sightSlot(state: Any, ops: Any[], s: Any) {
  const prior = s.expected,
    id = s.value.member_id;
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
      op.job_id === prior.sight_job_id,
  );
  if (scheduled) return sightScheduleValid(state, ops, s, scheduled);
  return (
    s.value.sight_job_id == null && completed && state.jobs?.[completed.job_id]?.sight !== undefined
  );
}

function sightScheduleValid(state: Any, ops: Any[], s: Any, scheduled: Any): boolean {
  const prior = s.expected,
    id = s.value.member_id;
  const sight = scheduled.sight;
  const plan = state.population_specs?.[key(s.plan)]?.plan;
  const entered = ops.some(
    (op) =>
      op.op === 'entity.transfer' &&
      op.writer_group === s.writer_group &&
      op.source_id === sight?.source_id &&
      op.destination_id === sight?.destination_id &&
      (op.entity_id === id || state.known_entities?.[op.entity_id]?.kind === 'body'),
  );
  return (
    !!plan?.sight &&
    !!sight &&
    same(scheduled.job, s.plan) &&
    sight.member_id === id &&
    sight.slot === s.slot &&
    sight.generation === s.value.generation &&
    (prior.sight_job_id == null ||
      ops.some(
        (op) =>
          op.op === 'job.cancel' &&
          op.writer_group === s.writer_group &&
          op.job_id === prior.sight_job_id &&
          op.sight_member_id === id,
      )) &&
    entered
  );
}
