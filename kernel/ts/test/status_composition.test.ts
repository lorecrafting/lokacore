import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

// Breaks: a stale expected row, a shortened end, a generation jump, a past end or a non-body
// target composes, or a refresh or successor loses its generation.
test('literal status composition cases', () => {
  for (const c of read('protocol/fixtures/status_composition.json').cases)
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.id);
});

// Breaks: generic admission accepts an active status row, a transition or a condition view
// missing one owned field, or an inactive row carrying a live field.
test('status rows, transitions and condition views require their complete shape', () => {
  const op = read('protocol/fixtures/status_composition.json').cases[0].ops[0];
  assert.deepEqual(validate('DeltaOp', op), []);
  for (const field of ['generation', 'ends_at', 'next_tick_at', 'job_id']) {
    const value = { ...op.value };
    delete value[field];
    assert.deepEqual(validate('StatusRow', value), [
      { path: '/' + field, code: 'missing_property' },
    ]);
  }
  for (const field of ['body_id', 'status', 'expected', 'value']) {
    const partial = { ...op };
    delete partial[field];
    assert.deepEqual(validate('DeltaOp', partial), [
      { path: '/' + field, code: 'missing_property' },
    ]);
  }
  assert.deepEqual(
    validate('StatusRow', { active: false, generation: 1, job_id: op.value.job_id }),
    [{ path: '/job_id', code: 'unknown_property' }],
  );
  const view = {
    label: 'condition.poisoned',
    ends_at: 400,
    next_tick_at: 160,
    resource: 'hp',
    per_tick: -1,
    tick_every: 60,
  };
  assert.deepEqual(validate('ConditionView', view), []);
  for (const field of Object.keys(view)) {
    const partial: Record<string, unknown> = { ...view };
    delete partial[field];
    assert.deepEqual(validate('ConditionView', partial), [
      { path: '/' + field, code: 'missing_property' },
    ]);
  }
  assert.deepEqual(validate('ConditionView', { ...view, tick_every: 0 }), [
    { path: '/tick_every', code: 'below_minimum' },
  ]);
});
