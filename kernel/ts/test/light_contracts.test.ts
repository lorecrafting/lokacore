import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';
// Break: malformed/missing participants or unbounded fuel history cross the wire boundary.
test('light contracts share independent valid and invalid wire examples', () => {
  for (const c of read('protocol/fixtures/light_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});
