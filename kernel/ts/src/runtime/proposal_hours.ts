// A job's next step inside the advance as its own drain step (runtime/proposal.ts jobs; `next` is
// set by schedule/rule.ts scheduledJob, population/shared.ts runPopulation and status/job.ts runStatus).
import { over } from '../foundation/compose.ts';
import { cmp } from '../foundation/validate.ts';

// A drain entry; a crossed status sub-step carries its true next tick (status/job.ts runStatus).
export type Due = [string, { due_time: number; tick?: number }][];

/**
 * Queues a run's crossed next hour (its `next`) as a sub-step in the drain's (due_time, job_id)
 * order; the drain's steps past due_jobs_per_advance are that limit.
 * ponytail: `due.length` also counts due jobs the drain skips, so it can fault early; count run
 * steps if a cartridge ever nears 1024.
 */
export function queueHour(due: Due, job_id: string, ran: object) {
  const { next, tick } = ran as { next?: number; tick?: number };
  if (next === undefined) return;
  const k = due.findIndex(
    ([id, j]) => j.due_time > next || (j.due_time === next && cmp(id, job_id) > 0),
  );
  due.splice(k < 0 ? due.length : k, 0, [job_id, { due_time: next, tick }]);
  return over({ due_jobs_per_advance: due.length });
}
