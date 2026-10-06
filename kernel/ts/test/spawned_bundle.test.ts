import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose, key } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';

const literal = read('protocol/fixtures/spawned_bundle.json');
const state = literal.state;
const full = literal.ops as any[];

// Breaks: a complete birth can omit its pelt or HP, place the pelt in a room, or advance an
// unrelated generation/slot while composition and independent preconditions still accept it.
test('complete spawned birth admits only its literal pair, HP and matching slot', () => {
  const good = compose(state, { ops: full });
  assert.ok('changes' in good, JSON.stringify(good));
  if (!('changes' in good)) return;
  const at = (target: object) => good.changes.find((c) => key(c.target) === key(target))?.value;
  assert.deepEqual(
    at({ kind: 'entity', entity_id: literal.expected_rows.member }),
    literal.expected_rows.hound,
  );
  assert.deepEqual(
    at({ kind: 'entity', entity_id: literal.expected_rows.child }),
    literal.expected_rows.pelt,
  );
  assert.equal(
    at({ kind: 'containment', entity_id: literal.expected_rows.member }),
    literal.expected_rows.room,
  );
  assert.equal(
    at({ kind: 'containment', entity_id: literal.expected_rows.child }),
    literal.expected_rows.member,
  );
  assert.deepEqual(
    at({ kind: 'resource', resource: full[4]!.resource, entity_id: literal.expected_rows.member }),
    literal.expected_rows.hp,
  );
  assert.deepEqual(
    at({ kind: 'population_slot', plan: full[5]!.plan, slot: 1 }),
    literal.expected_rows.slot,
  );
  assert.equal(
    check('delta_preconditions_hold', { state, delta: { ops: full }, result: good }),
    true,
  );

  const variants = [
    full.map((op, i) => (i === 3 ? { ...op, destination_id: literal.expected_rows.room } : op)),
    full.filter((_, i) => i !== 2 && i !== 3),
    full.filter((_, i) => i !== 4),
    full
      .filter((_, i) => i !== 5)
      .map((op) =>
        op.op === 'entity.create'
          ? {
              ...op,
              identity: { ...op.identity, origin: { ...op.identity.origin, generation: 2 } },
            }
          : op,
      ),
    full.map((op, i) => (i === 5 ? { ...op, value: { ...op.value, generation: 2 } } : op)),
    [...full, { ...full[5], slot: 2 }],
    full.map((op, i) =>
      i === 2
        ? { ...op, identity: { ...op.identity, origin: { ...op.identity.origin, generation: 2 } } }
        : op,
    ),
  ] as any[][];
  for (const ops of variants) {
    const result = compose(state, { ops });
    assert.ok('fault' in result, JSON.stringify(ops));
    assert.equal(check('delta_preconditions_hold', { state, delta: { ops }, result: good }), false);
  }
});

// Breaks: final-only validation prevents proposal reads from hydrating a lawful paired prefix.
test('paired spawned prefix remains composable for intermediate reads', () => {
  const result = compose(state, { ops: full.slice(0, 4) }, false);
  assert.ok('changes' in result, JSON.stringify(result));
});
