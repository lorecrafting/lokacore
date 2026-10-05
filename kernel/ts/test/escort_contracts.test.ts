import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from './read.ts';
import { compose } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { check } from '../src/runtime/invariants.ts';

const fixture = read('protocol/fixtures/escort.json');

// Breaks: required/closed fields or nullable expected rows admit malformed escort data.
test('escort contracts match independent boundary literals', () => {
  for (const c of fixture.contracts)
    assert.deepEqual(validate(c.contract, c.value), c.errors, c.name);
});

// Breaks: the composer accepts stale rows, swapped identity, illegal edges or conflicting writers.
test('escort composition matches literal lifecycle and refusal rows', () => {
  for (const c of fixture.cases) {
    const delta = { ops: c.ops };
    assert.deepEqual(compose(c.state, delta), c.expected, c.id);
    assert.ok(
      check('delta_preconditions_hold', { state: c.state, delta, result: c.expected }),
      c.id,
    );
  }
});

// Breaks: independent replay approves fabricated successes or omits the final written row.
test('escort invariant rejects counterfeit and missing writes', () => {
  for (const c of fixture.cases) {
    if (c.expected.fault?.code === 'conflicting_write') continue;
    const result = c.expected.changes
      ? { changes: [] }
      : {
          changes: [
            { target: { kind: 'escort', actor_id: c.ops[0].actor_id }, value: c.ops.at(-1).value },
          ],
        };
    assert.equal(
      check('delta_preconditions_hold', { state: c.state, delta: { ops: c.ops }, result }),
      false,
      c.id,
    );
  }
});
