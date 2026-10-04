import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from './read.ts';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { validate } from '../src/foundation/validate.ts';
const fixture = read('protocol/fixtures/corpse_creation.json');

// Breaks: absent-source upsert, orphan identity, collision, wrong owner/group or lost identity row.
test('portable creation/custody literals and independent success proof', () => {
  for (const c of fixture.cases) {
    const delta = { ops: c.ops };
    assert.deepEqual(compose(c.state, delta), c.expected, c.id);
    const observation = { state: c.state, delta, result: c.expected };
    for (const id of ['delta_preconditions_hold', 'one_container_per_item'])
      assert.equal(check(id, observation), true, `${c.id}: ${id}`);
    if (c.expected.fault)
      assert.equal(
        check('delta_preconditions_hold', {
          ...observation,
          result: fixture.cases[0].expected,
        }),
        false,
        c.id,
      );
  }
});

// Breaks: missing required data, escaped bounds/unknown fields, nullable union type confusion.
test('new contract trust boundaries', () => {
  for (const c of fixture.contracts)
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.id);
});
