import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { validate } from '../src/foundation/validate.ts';
import type { StateDelta } from '../src/contracts.gen.ts';

const cases = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/crow_composition.json', import.meta.url),
    'utf8',
  ),
).cases.concat(
  JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/crow_review_composition.json', import.meta.url),
      'utf8',
    ),
  ).cases,
);

// Breaks: a crow transition ignores its exact prior row or writes outside the keyed slot.
test('crow transport composition matches independent literal answers', () => {
  for (const c of cases) {
    const delta = { ops: c.ops } as StateDelta;
    assert.deepEqual(validate('StateDelta', delta), [], c.id);
    const result = compose(c.state, delta);
    assert.deepEqual(result, c.expected, c.id);
    assert.equal(check('delta_preconditions_hold', { state: c.state, delta, result }), true, c.id);
    if (c.counterfeit)
      assert.equal(
        check('delta_preconditions_hold', { state: c.state, delta, result: c.counterfeit }),
        false,
        c.id,
      );
  }
});

// Breaks: a claimed successful transition omits the persisted crow row.
test('crow invariant rejects a counterfeit success', () => {
  const c = cases[0];
  assert.equal(
    check('delta_preconditions_hold', {
      state: c.state,
      delta: { ops: c.ops },
      result: { changes: [] },
    }),
    false,
  );
});

// Breaks: the job-cancel wire validator still assumes a single alternative to encounter_id.
test('crow-only job cancellation is valid; missing every alternative is rejected', () => {
  const op = {
    op: 'job.cancel',
    writer_group: 0,
    job_id: '44444444-4444-4444-8444-444444444444',
    crow_member_id: '11111111-1111-4111-8111-111111111111',
    crow_generation: 1,
  };
  assert.deepEqual(validate('DeltaOp', op), []);
  assert.notDeepEqual(validate('DeltaOp', { op: op.op, writer_group: 0, job_id: op.job_id }), []);
});

// Breaks: an unphased crow job is persisted, losing the stale-acquire/return distinction.
test('a crow-bound schedule requires its closed phase', () => {
  const c = cases.find((c: { id: string }) => c.id === 'schedule-phase-bound-crow-job');
  const op = c.ops[0];
  const { crow_phase: _phase, ...missing } = op;
  assert.deepEqual(compose(c.state, { ops: [missing] }), {
    fault: {
      kind: 'fault',
      code: 'precondition_failed',
      target: { kind: 'job', job_id: op.job_id },
    },
  });
  assert.notDeepEqual(validate('DeltaOp', { ...op, crow_phase: 'paused_return' }), []);
});
