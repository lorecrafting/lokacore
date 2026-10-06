import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

// Breaks: one cancellation form masks the other, or missing encounter identity is admitted.
test('sight, water and encounter cancellation share the requiredUnless boundary', () => {
  for (const { name, contract, value, errors } of read('protocol/fixtures/cancel_alternatives.json')
    .cases)
    assert.deepEqual(validate(contract, value), errors, name);
});
