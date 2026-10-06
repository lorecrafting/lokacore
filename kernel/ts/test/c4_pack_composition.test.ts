import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/c4_pack_composition.json', import.meta.url),
    'utf8',
  ),
);
function stateOf(name: string): any {
  const row = fixture.states[name];
  if (!row.extends) return structuredClone(row);
  const state = stateOf(row.extends);
  for (const edit of row.edits) (state[edit.section] ??= {})[edit.key] = edit.value;
  return state;
}

// Breaks: pack admission accepts a foreign member, or a flight stamp names the unselected hound.
test('literal exact pack admission and refusals agree with both independent guards', () => {
  for (const c of fixture.cases) {
    const state = stateOf(c.state);
    const delta = { ops: c.ops };
    assert.deepEqual(compose(state, delta), c.expected, c.id);
    assert.equal(
      check('delta_preconditions_hold', { state, delta, result: c.expected }),
      true,
      c.id,
    );
    if (c.counterfeit)
      assert.equal(
        check('delta_preconditions_hold', {
          state,
          delta,
          result: c.counterfeit,
        }),
        false,
        c.id,
      );
  }
});

// Breaks: final flight proof is applied to the runtime's in-progress prefix before encounter closure.
test('a legal transfer and stamp remain composable before their round exit is appended', () => {
  const c = fixture.cases.find(
    (row: { id: string }) => row.id === 'flight-stamp-requires-same-group-encounter-exit',
  );
  assert.deepEqual(compose(stateOf(c.state), { ops: c.ops }, false), c.counterfeit);
});
