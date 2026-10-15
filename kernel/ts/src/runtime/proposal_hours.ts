// A job's next step inside the advance as its own drain step (runtime/proposal.ts jobs; `next` is
// set by schedule/rule.ts scheduledJob, population/shared.ts runPopulation and status/job.ts runStatus).
import { key, over, target } from '../foundation/compose.ts';
import type { DeltaOp } from '../contracts.gen.ts';
import { merge } from '../mechanics/status/job.ts';
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
  if (next !== undefined) return enqueue(due, job_id, next, tick);
}

// Inserts a drain step in (due_time, job_id) order; the limit if the drain outgrows due_jobs_per_advance.
export function enqueue(due: Due, job_id: string, due_time: number, tick?: number) {
  const k = due.findIndex(
    ([id, j]) => j.due_time > due_time || (j.due_time === due_time && cmp(id, job_id) > 0),
  );
  due.splice(k < 0 ? due.length : k, 0, [job_id, { due_time, tick }]);
  return over({ due_jobs_per_advance: due.length });
}

// A job a run scheduled inside the advance runs at its own due time, as in steps (loka-kgd.152).
export function queueScheduled(due: Due, ops: readonly DeltaOp[], to: number) {
  for (const o of ops)
    if (o.op === 'job.schedule' && o.due_time <= to) {
      const limit = enqueue(due, o.job_id, o.due_time);
      if (limit) return limit;
    }
}

// Each drain step rescans the advance's ops, so a target's canonical key is encoded once per op.
const keys = new WeakMap<DeltaOp, string>();
function opKey(o: DeltaOp) {
  let k = keys.get(o);
  if (k === undefined) keys.set(o, (k = key(target(o))));
  return k;
}

// The advance's op positions (from `next`) by target key; positions, not ops, as `merge` replaces
// ops. Extended to the op list's end on each join, so writes appended outside `join` count too.
export type Writes = { next: number; at: Map<string, number[]> };

// A run (or its reaction's or credit's group) writing a target that a run of strictly earlier due
// time wrote (`earlier`) joins that run's writer group, as steps commit them in order
// (loka-kgd.151): the indexed ops before `cut`; a target that a run of the same due time, or a
// sibling group of this run (from `cut`), wrote stays apart, faulting as in steps.
export function joinEarlier(
  all: DeltaOp[],
  [w, cut]: readonly [Writes, number],
  own: readonly DeltaOp[],
  group: number,
  maps: Map<string, number>[],
) {
  for (; w.next < all.length; w.next++) {
    const k = opKey(all[w.next]);
    const at = w.at.get(k);
    if (at) at.push(w.next);
    else w.at.set(k, [w.next]);
  }
  const groups = new Set<number>();
  for (const k of new Set(own.map(opKey)))
    for (const i of w.at.get(k) ?? []) {
      const g = all[i].writer_group;
      if (g === group) continue;
      if (i >= cut) return;
      groups.add(g);
    }
  merge(all, groups, group, maps);
}

// A run's ops from `mark` (its reactions', a kill's credit, combat/credit.ts) join strictly earlier
// writers per writer group; a sight handoff's reused group (proposal_sight.ts) stays as it is.
export function joinTail(
  all: DeltaOp[],
  [w, cut, mark]: readonly [Writes, number, number],
  handoff: number | undefined,
  maps: Map<string, number>[],
) {
  const tail = all.slice(mark);
  for (const g of new Set(tail.map((o) => o.writer_group)))
    if (g !== handoff)
      joinEarlier(
        all,
        [w, cut],
        tail.filter((o) => o.writer_group === g),
        g,
        maps,
      );
  return all.slice(mark);
}
