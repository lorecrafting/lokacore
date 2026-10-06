import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from './read.ts';
import { compose } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { check } from '../src/runtime/invariants.ts';

const fixture = read('protocol/fixtures/liquid_composition.json');

// Breaks: omitted debit, partial adoption, stale whole rows, malformed contents or conflicting writers.
test('liquid composition matches independently pinned rows and atomic refusals', () => {
  for (const c of fixture.cases) {
    const state = c.state ?? fixture.state;
    const delta = { ops: c.ops };
    assert.deepEqual(validate('StateDelta', delta), [], c.id);
    const result = compose(state, delta);
    assert.deepEqual(result, c.expected, c.id);
    for (const id of ['delta_preconditions_hold', 'liquid_rows_valid', 'no_last_writer_wins'])
      assert.ok(check(id, { state, delta, result }), `${c.id}: ${id}`);
  }
});

// Breaks: independent replay trusts composition, omits a Pour participant or accepts stale rows.
test('liquid precondition replay rejects counterfeit successes and missing debit', () => {
  for (const c of fixture.cases) {
    if (c.expected.fault?.code === 'conflicting_write') continue;
    const result = c.expected.changes
      ? { changes: [] }
      : {
          changes: c.ops.map((op: any) => ({
            target: { kind: 'liquid', item_id: op.item_id },
            value: op.to,
          })),
        };
    assert.equal(
      check('delta_preconditions_hold', {
        state: c.state ?? fixture.state,
        delta: { ops: c.ops },
        result,
      }),
      false,
      c.id,
    );
  }
  const c = fixture.cases[0];
  assert.equal(
    check('delta_preconditions_hold', {
      state: fixture.state,
      delta: { ops: c.ops },
      result: { changes: [c.expected.changes[1]] },
    }),
    false,
    'receiver credit alone cannot prove a Pour',
  );
});
