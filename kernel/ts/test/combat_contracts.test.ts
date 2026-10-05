import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

// Breaks: a combat trust boundary accepts missing fields, malformed references or out-of-range values.
test('combat contracts match the independent shared boundary corpus', () => {
  for (const { name, contract, value, errors } of read('protocol/fixtures/combat_contracts.json')
    .contracts)
    assert.deepEqual(validate(contract, value), errors, name);
});
