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
  if (
    close.op !== 'encounter.close' ||
    cancel.op !== 'job.cancel' ||
    cancelling.at !== closing.at + 1 ||
    close.writer_group !== cancel.writer_group ||
    close.encounter_id !== cancel.encounter_id ||
    close.job_id !== cancel.job_id
  )
    return false;
  const group = close.writer_group;
  const prior = state.encounters?.[close.encounter_id];
  const advanceAt = ops.findIndex(
    (row) =>
      row.op === 'encounter.advance' &&
      row.writer_group === group &&
      row.encounter_id === close.encounter_id &&
      row.next_job_id === close.job_id,
  );
  if (!prior || prior.status !== 'open' || advanceAt < 0 || advanceAt >= closing.at) return false;
  const advance = ops[advanceAt],
    round = state.jobs?.[advance.job_id];
  const successor = ops.find(
    (row) =>
      row.op === 'job.schedule' &&
      row.writer_group === group &&
      row.job_id === close.job_id &&
      row.encounter_id === close.encounter_id,
  );
  if (
    prior.job_id !== advance.job_id ||
    round?.status !== 'pending' ||
    round.encounter_id !== close.encounter_id ||
    !successor ||
    !ops.some(
      (row) =>
        row.op === 'job.complete' && row.writer_group === group && row.job_id === advance.job_id,
    )
  )
    return false;
  const sightDone = ops.find(
    (row) =>
      row.op === 'job.complete' && row.writer_group > group && state.jobs?.[row.job_id]?.sight,
  );
  const sightJob = sightDone && state.jobs[sightDone.job_id];
  const sight = sightJob?.sight;
  const slot =
    sight &&
    state.population_slots?.[
      key({ kind: 'population_slot', plan: sightJob.job, slot: sight.slot })
    ];
  const flight =
    sight &&
    ops.find(
      (row) =>
        row.op === 'entity.transfer' &&
        row.writer_group === sightDone.writer_group &&
        row.entity_id === sight.member_id,
    );
  const bound =
    sight &&
    ops.find(
      (row) =>
        row.op === 'population.slot' &&
        row.writer_group === sightDone.writer_group &&
        row.slot === sight.slot &&
        same(row.plan, sightJob.job),
    );
  if (
    !sight ||
    sightJob.status !== 'pending' ||
    round.due_time !== sightJob.due_time ||
    prior.npc_id !== sight.member_id ||
    slot?.member_id !== sight.member_id ||
    slot.generation !== sight.generation ||
    slot.sight_job_id !== sightDone.job_id ||
    !flight ||
    flight.source_id !== state.containers?.[sight.member_id] ||
    !bound ||
    bound.value.member_id !== sight.member_id ||
    bound.value.sight_job_id != null ||
    bound.value.last_flight_at !== sightJob.due_time ||
    !result.changes.some(
      (c: Any) =>
        c.target.kind === 'encounter' &&
        c.target.encounter_id === close.encounter_id &&
        c.value?.status === 'closed',
    )
  )
    return false;
  return !ops
    .slice(advanceAt + 1, closing.at)
    .some(
      (row) =>
        row.writer_group !== group &&
        (row.encounter_id === close.encounter_id || row.job_id === close.job_id),
    );
}
