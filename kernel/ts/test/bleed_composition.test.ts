import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

// Breaks: a foreign writer shares a body bleed target, or a spent bandage cannot enter the terminal holder.
test('literal bleed and terminal composition cases', () => {
  for (const c of read('protocol/fixtures/bleed_composition.json').cases)
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.id);
});

// Breaks: generic admission accepts an active wound missing any one owned occurrence field.
test('active bleed rows and containing deltas require the complete occurrence', () => {
  const op = read('protocol/fixtures/bleed_composition.json').cases[0].ops[0];
  const fields = ['effect', 'source_id', 'ends_at', 'next_tick_at', 'job_id'];
  for (const field of fields) {
    const value = { ...op.value };
    delete value[field];
    assert.deepEqual(validate('BleedRow', value), [
      { path: '/' + field, code: 'missing_property' },
    ]);
    assert.deepEqual(validate('DeltaOp', { ...op, value }), [
      { path: '/value/' + field, code: 'missing_property' },
    ]);
  }
  assert.deepEqual(
    validate('BleedRow', { active: false, generation: 1, job_id: op.value.job_id }),
    [{ path: '/job_id', code: 'unknown_property' }],
  );
});

// Breaks: the fourth cancellation binding is omitted or can share a sight binding.
test('bleed cancellation is the fourth exclusive job binding', () => {
  const op = {
    op: 'job.cancel',
    writer_group: 0,
    job_id: '11111111-2222-4333-8444-555555555555',
    bleed_body_id: '11111111-2222-4333-8444-555555555555',
    bleed_generation: 1,
  };
  assert.deepEqual(validate('DeltaOp', op), []);
  assert.deepEqual(validate('DeltaOp', { ...op, sight_member_id: op.bleed_body_id }), [
    { path: '', code: 'exclusive_properties' },
  ]);
});
