import type { DeltaOp } from '../contracts.gen.ts';
import { encode, type Json } from './canonical.ts';
import type { State } from './compose.ts';

type Obj = Record<string, any>;
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
  if (
    close.op !== 'encounter.close' ||
    cancel.op !== 'job.cancel' ||
    cancelAt !== closeAt + 1 ||
    close.writer_group !== cancel.writer_group ||
    close.encounter_id !== cancel.encounter_id ||
    close.job_id !== cancel.job_id
  )
    return false;
  const group = close.writer_group;
  const advanceAt = ops.findIndex(
    (o) =>
      o.op === 'encounter.advance' &&
      o.writer_group === group &&
      o.encounter_id === close.encounter_id &&
      o.next_job_id === close.job_id,
  );
  if (advanceAt < 0 || advanceAt >= closeAt) return false;
  const advance = ops[advanceAt];
  if (advance.op !== 'encounter.advance') return false;
  const initialEncounter = section(state, 'encounters')[close.encounter_id];
  const old = section(state, 'jobs')[advance.job_id];
  const scheduled = ops.find(
    (o) =>
      o.op === 'job.schedule' &&
      o.writer_group === group &&
      o.job_id === close.job_id &&
      o.encounter_id === close.encounter_id,
  );
  const completed = ops.find(
    (o) => o.op === 'job.complete' && o.writer_group === group && o.job_id === advance.job_id,
  );
  if (
    !initialEncounter ||
    initialEncounter.status !== 'open' ||
    initialEncounter.job_id !== advance.job_id ||
    !old ||
    old.status !== 'pending' ||
    old.encounter_id !== close.encounter_id ||
    !scheduled ||
    !completed ||
    scheduled.op !== 'job.schedule'
  )
    return false;
  const sightDone = ops.find(
    (o) =>
      o.op === 'job.complete' && o.writer_group > group && section(state, 'jobs')[o.job_id]?.sight,
  );
  if (sightDone?.op !== 'job.complete') return false;
  const sightJob = section(state, 'jobs')[sightDone.job_id];
  const sight = sightJob.sight;
  const plan = sightJob.job;
  const slot = section(state, 'population_slots')[
    encode({ kind: 'population_slot', plan, slot: sight.slot } as Json)
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
      encode(o.plan as Json) === encode(plan),
  );
  if (
    sightJob.status !== 'pending' ||
    old.due_time !== sightJob.due_time ||
    initialEncounter.npc_id !== sight.member_id ||
    !slot ||
    slot.member_id !== sight.member_id ||
    slot.generation !== sight.generation ||
    slot.sight_job_id !== sightDone.job_id ||
    flight?.op !== 'entity.transfer' ||
    flight.source_id !== section(state, 'containers')[sight.member_id] ||
    slotWrite?.op !== 'population.slot' ||
    slotWrite.value.member_id !== sight.member_id ||
    slotWrite.value.sight_job_id != null ||
    slotWrite.value.last_flight_at !== sightJob.due_time ||
    scheduled.encounter_id !== close.encounter_id
  )
    return false;
  return !ops
    .slice(advanceAt + 1, closeAt)
    .some(
      (o) =>
        o.writer_group !== group &&
        (('encounter_id' in o && o.encounter_id === close.encounter_id) ||
          ('job_id' in o && o.job_id === close.job_id)),
    );
}
