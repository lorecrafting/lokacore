import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DeltaOp } from '../src/contracts.gen.ts';
import { joinEarlier } from '../src/runtime/proposal_hours.ts';

const done = (job_id: string, writer_group: number) =>
  ({ op: 'job.complete', job_id, writer_group }) as unknown as DeltaOp;

// Breaks: run B (due 200) joined run A's group (due 100) on target X, so run C (due 200) writing X
// joins it transitively and the B/C equal-due conflict is accepted where steps fault (loka-kgd.151).
test('a run joins an earlier writer of its target, but not across an equal-due writer', () => {
  const all = [done('x', 1)];
  joinEarlier(all, [0, 1], [done('x', 2)], 2, []);
  assert.equal(all[0]!.writer_group, 2);
  all.push(done('x', 2));
  joinEarlier(all, [0, 1], [done('x', 3)], 3, []);
  assert.deepEqual(
    all.map((o) => o.writer_group),
    [2, 2],
  );
});
