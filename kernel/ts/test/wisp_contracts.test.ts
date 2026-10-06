import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from './read.ts';
import { validate } from '../src/foundation/validate.ts';
import { compose } from '../src/foundation/compose.ts';

// Break: malformed new typed fields cross a boundary or actor/source/quest/count preconditions weaken.
test('independent bounded attempt and Wisp contracts', () => {
  for (const c of read('protocol/fixtures/wisp_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
  for (const c of read('protocol/fixtures/wisp_attempts.json'))
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.name);
});
