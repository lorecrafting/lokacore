import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DeltaOp } from '../src/contracts.gen.ts';
import { type Due, enqueue, joinEarlier } from '../src/runtime/proposal_hours.ts';

const done = (job_id: string, writer_group: number) =>
  ({ op: 'job.complete', job_id, writer_group }) as unknown as DeltaOp;

// Breaks: run B (due 200) joined run A's group (due 100) on target X, so run C (due 200) writing X
// joins it transitively and the B/C equal-due conflict is accepted where steps fault (loka-kgd.151).
test('a run joins an earlier writer of its target, but not across an equal-due writer', () => {
  const all = [done('x', 1)];
  const w = { next: 0, at: new Map<string, number[]>() };
  joinEarlier(all, [w, 1], [done('x', 2)], 2, []);
  assert.equal(all[0]!.writer_group, 2);
  all.push(done('x', 2));
  joinEarlier(all, [w, 1], [done('x', 3)], 3, []);
  assert.deepEqual(
    all.map((o) => o.writer_group),
    [2, 2],
  );
});

// Breaks: the target index keeping only a target's latest position whatever its group, so of two
// equal-due writers of X (groups 1 and 2), a strictly later run joins only the second.
test('a later run joins every earlier writer group of its target', () => {
  const all = [done('x', 1), done('x', 2)];
  joinEarlier(all, [{ next: 0, at: new Map() }, 2], [done('x', 3)], 3, []);
  assert.deepEqual(
    all.map((o) => o.writer_group),
    [3, 3],
  );
});

// Breaks: a drain step appended or inserted out of (due_time, job_id) order, so a job due earlier,
// or due at the same time with a smaller id, runs after a queued one (loka-kgd.152).
test('enqueue keeps the drain in due_time, then job_id, order', () => {
  const due: Due = [];
  for (const [id, at] of [
    ['b', 200],
    ['c', 300],
    ['a', 100],
    ['a', 200],
    ['c', 200],
  ] as const)
    enqueue(due, id, at);
  assert.deepEqual(
    due.map(([id, j]) => `${id}@${j.due_time}`),
    ['a@100', 'a@200', 'b@200', 'c@200', 'c@300'],
  );
});
