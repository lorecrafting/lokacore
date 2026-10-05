// schedule@1 (capability_registry.json): wait advances the logical clock to `until` as one
// explicit advance (04 §5.4; command.schema.json wait): a time.advance from now, no event. An
// `until` not later than now is invalid_state and changes nothing. The host runs the advance's
// due jobs in the same proposal (runtime/proposal.ts propose), each a run_job decided here.
//
// run_job is authority-internal (04 §1): only the host's drain builds it, never a client
// invocation. It runs one pending job of an NPC's daily schedule (mechanics/schedule/behavior.ts), reading the
// time from the job's due time: the NPC moves to the room listed for that hour unless it is
// there already, the job completes, and the next job is scheduled at the schedule's next listed
// hour, its id this run_job's first IdSource ordinal; a move reports the NPC's
// entity_entered_room (mechanics/schedule/behavior.ts entered), its id the second. A job that is not pending is
// invalid_state.
// Daily schedules retain their DefinitionRef dispatch; bound encounter jobs use the current occurrence.
import { roundSequence } from '../combat/round.ts';
import { accepted, rejected, refString, type Rule } from '../../runtime/decision.ts';
import type { DeltaOp } from '../../contracts.gen.ts';
import { entered, hourOf, jobId, next, scheduleOf } from './behavior.ts';

export const decide: Rule<'schedule'> = (world, command, mint) => {
  const { payload } = command;
  if (payload.type === 'run_job') {
    const row = world.state.jobs?.[payload.job_id];
    if (row?.status !== 'pending') return rejected('invalid_state');
    if (row.encounter_id) return roundSequence(world, command, payload.job_id, row, mint);
    const schedule = scheduleOf(world, row.job);
    const npc = world.entityIds[refString(row.job)];
    const room = world.roomIds[refString(schedule[hourOf(row.due_time)])];
    const from = world.state.containers[npc];
    const transfer = { op: 'entity.transfer', writer_group: 0, entity_id: npc } as const;
    const move: DeltaOp[] =
      from === room ? [] : [{ ...transfer, source_id: from, destination_id: room }];
    const due_time = next(schedule, row.due_time);
    return accepted(
      world,
      'job_ran',
      [
        ...move,
        { op: 'job.complete', writer_group: 0, job_id: payload.job_id },
        { op: 'job.schedule', writer_group: 0, job_id: jobId(mint), job: row.job, due_time },
      ],
      move.length ? [entered(world, command, mint, npc, room, row.due_time)] : [],
    );
  }
  if (
    payload.type === 'elapsed' &&
    (world.cartridge.manifest.time_policy?.profile !== 'real_elapsed' ||
      payload.from !== world.state.clock)
  )
    return rejected('invalid_state');
  const from = world.state.clock;
  if (payload.until <= from) return rejected('invalid_state');
  return accepted(
    world,
    payload.type === 'elapsed' ? 'elapsed' : 'waited',
    [{ op: 'time.advance', writer_group: 0, from, to: payload.until }],
    [],
  );
};
