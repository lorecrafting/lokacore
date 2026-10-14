// schedule@1 (capability_registry.json): wait advances the logical clock to `until` as one
// explicit advance (04 §5.4; command.schema.json wait): a time.advance from now, no event. An
// `until` not later than now is invalid_state and changes nothing. The host runs the advance's
// due jobs in the same proposal (runtime/proposal.ts propose), each a run_job decided here.
//
// run_job is authority-internal (04 §1): only the host's drain builds it, never a client
// invocation. It runs one pending job of an NPC's daily schedule (mechanics/schedule/behavior.ts), reading the
// time from the job's due time: the NPC moves to the room listed for that hour (or its first holding
// case, toolbox row W10: behavior.ts placeOf) unless it is
// there already, the job completes, and the next job is scheduled at the schedule's next listed
// hour, its id this run_job's first IdSource ordinal; a move reports the NPC's
// entity_entered_room (mechanics/schedule/behavior.ts entered), its id the second. A job that is not pending is
// invalid_state, except a crossed-hour sub-step (decideAt `at` later than its due time), which
// schedules no job when its next hour is crossed too (so its arrival takes the first ordinal).
// Daily schedules retain their DefinitionRef dispatch; bound encounter jobs use the current occurrence.
import { expiry } from '../water/expiry.ts';
import { expire } from '../quest/job.ts';
import { roundSequence } from '../combat/round.ts';
import {
  accepted,
  rejected,
  refString,
  type JobRow,
  type Rule,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import type { DeltaOp, JobId } from '../../contracts.gen.ts';
import {
  CLOCK_JOB,
  entered,
  happened,
  jobId,
  nextHour,
  placeOf,
  runClock,
  scheduleOf,
} from './behavior.ts';
import { relock, walkPath } from '../movement/shared.ts';
import { assigned, adjusted } from '../fact.ts';
import { runPopulation } from '../population/shared.ts';
import { runReplenish } from '../containment/job.ts';
import { runWage } from '../escort/job.ts';
import { binding as crowBinding, runCrow } from '../crow/behavior.ts';
import { runBleed } from '../bleed/job.ts';
import { runStatus } from '../status/job.ts';
import { moves } from '../status/shared.ts';

import { runSight } from '../population/behavior.ts';
import { runDelayed } from '../delayed.ts';

// `at`: the drain's hour for this run; a later listed hour the advance crosses is a sub-step of the
// row's one run_job, which its first hour completed (scheduledJob, loka-qi0r; runPopulation, loka-6ql4;
// runStatus, loka-6ztc).
// size: allow 42, one run_job dispatch over every job kind (row FD1 adds reaction)
export const decideAt = (
  world: World,
  command: Parameters<Rule<'schedule'>>[1],
  mint: Parameters<Rule<'schedule'>>[2],
  steps: Steps = { n: 0 },
  at?: number,
  tick?: number,
): ReturnType<Rule<'schedule'>> => {
  const { payload } = command;
  if (payload.type === 'run_job') {
    const row = world.state.jobs?.[payload.job_id];
    if (row?.status !== 'pending' && !(row && at !== undefined && at > row.due_time))
      return rejected('invalid_state');
    if (row.water_generation !== undefined)
      return expiry(world, command, payload.job_id, row, mint);
    if (row.encounter_id) return roundSequence(world, command, payload.job_id, row, mint, steps);
    if (row.bleed_body_id) return runBleed(world, command, payload.job_id, row, mint);
    if (row.job.kind === 'status')
      return runStatus(world, command, payload.job_id, row, mint, at, tick);
    if (row.quest_instance_id) {
      const d = world.cartridge.quests?.[refString(row.job)]?.deadline;
      return d && !d.fact
        ? expire(world, command, payload.job_id, row, mint)
        : deadlineJob(world, payload.job_id, row);
    }
    if (row.job.kind === 'population_bundle')
      return runCrow(world, command, payload.job_id, row, crowBinding(world, payload.job_id), mint);
    if (row.sight) return runSight(world, payload.job_id, row, steps);
    if (row.job.kind === CLOCK_JOB) return runClock(world, command, payload.job_id, row, mint);
    if (row.job.kind === 'population')
      return runPopulation(world, command, payload.job_id, row, mint, at);
    if (row.job.kind === 'replenish')
      return runReplenish(world, payload.job_id, row, mint, steps, at ?? row.due_time);
    if (row.job.kind === 'wage')
      return runWage(world, payload.job_id, row, mint, at ?? row.due_time);
    if (row.job.kind === 'order') return orderReady(world, payload.job_id, row);
    if (row.job.kind === 'reaction')
      return runDelayed(world, command, payload.job_id, row, mint, steps); // FD1
    return scheduledJob(world, command, payload.job_id, row, mint, steps, at ?? row.due_time);
  }
  return advance(world, payload);
};
export const decide: Rule<'schedule'> = decideAt;

type Advance = Exclude<Parameters<Rule<'schedule'>>[1]['payload'], { type: 'run_job' }>;
function advance(world: World, payload: Advance) {
  if (
    payload.type === 'elapsed' &&
    (world.cartridge.manifest.time_policy?.profile !== 'real_elapsed' ||
      payload.from !== world.state.clock)
  )
    return rejected('invalid_state');
  const from = world.state.clock;
  if (payload.until <= from) return rejected('invalid_state');
  return accepted<never>(
    world,
    payload.type === 'elapsed' ? 'elapsed' : 'waited',
    [{ op: 'time.advance', writer_group: 0, from, to: payload.until }],
    [],
  );
}

// size: allow 47, a walking step (row W26) commits its key passages, move and next hour together
function scheduledJob(
  world: World,
  command: Parameters<Rule<'schedule'>>[1],
  job_id: JobId,
  row: JobRow,
  mint: Parameters<Rule<'schedule'>>[2],
  steps: Steps,
  at: number,
) {
  const schedule = scheduleOf(world, row.job);
  const npc = world.entityIds[refString(row.job)];
  const { room, goal, walks } = placeOf(world, npc, at, steps);
  const from = world.state.containers[npc];
  // Toolbox row W26: a walking case moves only along a path, re-locking each key passage on it.
  const still = from === room || !moves(world, npc);
  const path = !still && walks ? walkPath(world, npc, from, room, steps) : [];
  // A goal (toolbox row W10) is narration only when the player sees the NPC leave.
  const stays = still || !path;
  const doors = stays ? [] : path.flatMap(relock);
  const seen = goal && !stays && world.state.containers[world.body] === from;
  const transfer = { op: 'entity.transfer', writer_group: 0, entity_id: npc } as const;
  const move: DeltaOp[] = stays ? [] : [{ ...transfer, source_id: from, destination_id: room }];
  const due_time = nextHour(world.cartridge, schedule, at);
  // A next hour the advance also crosses runs as its own drain step (`next`, runtime/proposal_hours.ts); only the
  // last step schedules the job after the target.
  const crossed = due_time <= world.state.clock;
  const done = { op: 'job.complete', writer_group: 0, job_id } as const;
  const next = { op: 'job.schedule', writer_group: 0, job: row.job, due_time } as const;
  const ran = accepted(
    world,
    'job_ran',
    [
      ...doors.map((d) => d.op),
      ...move,
      ...(row.status === 'pending' ? [done] : []),
      ...(crossed ? [] : [{ ...next, job_id: jobId(mint) }]),
    ],
    move.length
      ? [
          ...doors.map((d) => happened(world, command, mint, at, d.changed)),
          entered(world, command, mint, npc, room, at),
        ]
      : [],
    seen ? [{ key: goal }] : [],
  );
  return crossed ? { ...ran, next: due_time } : ran;
}

// Toolbox row 20b: a due order job completes and writes nothing else; the order is now ready.
const orderReady = (world: World, job_id: JobId, row: JobRow) =>
  accepted<never>(
    world,
    'job_ran',
    row.status === 'pending' ? [{ op: 'job.complete', writer_group: 0, job_id }] : [],
    [],
  );

// size: allow 50, one expiry checks its bound occurrence and commits status, trust and job together
function deadlineJob(world: World, jobId: JobId, row: JobRow) {
  const quest = world.state.quests?.[row.quest_instance_id!];
  const deadline = world.cartridge.quests?.[refString(row.job)]?.deadline;
  if (
    !quest ||
    !deadline ||
    quest.scope.kind !== 'player' ||
    quest.scope.character_id !== row.actor_id ||
    refString(quest.quest) !== refString(row.job) ||
    row.due_time !== deadline.at
  )
    return { kind: 'fault', code: 'precondition_failed' } as const;
  const done = { op: 'job.complete', writer_group: 0, job_id: jobId } as const;
  if (!['active', 'objectives_complete'].includes(quest.state))
    return accepted<never>(world, 'job_ran', [done], []);
  const status = assigned(
    world,
    row.actor_id!,
    { ops: [], position: 0, facts: {} },
    { fact: deadline.fact!, value: deadline.outcome },
  );
  const trust = adjusted(world, row.actor_id!, status, {
    fact: deadline.trust_fact!,
    amount: deadline.trust_amount!,
  });
  if (!trust) return { kind: 'fault', code: 'precondition_failed' } as const;
  return accepted<never>(
    world,
    'job_ran',
    [
      {
        op: 'quest.transition',
        writer_group: 0,
        instance_id: row.quest_instance_id!,
        from: quest.state,
        to: 'failed',
        outcome: deadline.outcome,
      },
      ...trust.ops,
      done,
    ],
    [],
  );
}
