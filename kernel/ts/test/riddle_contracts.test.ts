import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

// Breaks: malformed answers/banks, leaked answers or malformed journal variants cross boundaries.
test('bounded dialogue and journal contracts match literal controls', () => {
  for (const c of read('protocol/fixtures/riddle_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});
