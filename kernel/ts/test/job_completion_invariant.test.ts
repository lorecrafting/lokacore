import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check } from '../src/runtime/invariants.ts';
import { command, elapsed, fixture } from './c5_bleed_fixture.ts';

function paired() {
  const { world, target } = fixture();
  let current = command(world, 1, { type: 'attack', target_id: target }, 1).world;
  for (const [i, at] of [64950, 65050, 65100, 65150].entries()) {
    const next = elapsed(current, at, i + 2);
    assert.equal(next.decision.kind, 'accepted');
    current = next.world;
  }
  const { decision } = elapsed(current, 65250, 6);
  assert.equal(decision.kind, 'accepted');
  if (decision.kind !== 'accepted') throw Error('paired jobs refused');
  return { decision, before: current.state };
}

// Break: the invariant mistakes an accepted equal-due round/bleed pair for foreign ownership.
test('a lawful round and bleed completion may share their run writer group', () => {
  const observation = paired();
  assert.deepEqual(
    observation.decision.delta.ops
      .filter((op) => op.op === 'job.complete')
      .map((op) => ({
        group: op.writer_group,
        due: observation.before.jobs![op.job_id].due_time,
        bleed: !!observation.before.jobs![op.job_id].bleed_body_id,
      })),
    [
      { group: 1, due: 65250, bleed: false },
      { group: 1, due: 65250, bleed: true },
    ],
  );
  assert.equal(check('job_complete_owned_by_run', observation), true);
});

// Break: removing the uniqueness check also admits a root-command job completion.
test('a paired completion in the root writer group is refused', () => {
  const { decision, before } = paired();
  const ops = decision.delta.ops.map((op) =>
    op.op === 'job.complete' ? { ...op, writer_group: 0 } : op,
  );
  assert.equal(
    check('job_complete_owned_by_run', { before, decision: { ...decision, delta: { ops } } }),
    false,
  );
});

// Break: allowing paired groups also allows completion before the job's due time.
test('a paired completion beyond the advance target is refused', () => {
  const { decision, before } = paired();
  const ops = decision.delta.ops.map((op) =>
    op.op === 'time.advance' ? { ...op, to: 65249 } : op,
  );
  assert.equal(
    check('job_complete_owned_by_run', { before, decision: { ...decision, delta: { ops } } }),
    false,
  );
});
