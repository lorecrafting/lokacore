// A schedule job's next listed hour inside the advance as its own drain step (runtime/proposal.ts
// jobs; mechanics/schedule/rule.ts scheduledJob sets `next`).
import { over } from '../foundation/compose.ts';
import { cmp } from '../foundation/validate.ts';

/**
 * Queues a run's crossed next hour (its `next`) in the drain's (due_time, job_id) order; the
 * drain's steps past due_jobs_per_advance are that limit.
 */
export function queueHour(due: [string, { due_time: number }][], job_id: string, ran: object) {
  const next = (ran as { next?: number }).next;
  if (next === undefined) return;
  const k = due.findIndex(
    ([id, j]) => j.due_time > next || (j.due_time === next && cmp(id, job_id) > 0),
  );
  due.splice(k < 0 ? due.length : k, 0, [job_id, { due_time: next }]);
  return over({ due_jobs_per_advance: due.length });
}
