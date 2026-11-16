// K1b (docs/design/story-tooling.md §2b K1 row 3): a Policy's `named` leaf offers the conditions
// folder's keys. The node list is the Story payload's, so `condition` nodes must be selectable by
// kind exactly as rooms and items are — the picker filters on `kind`, nothing more.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNamed } from '../play/card.ts';
import { choices } from '../play/world_card.ts';

const S = 'scene_sampler@0.0.1:';
const nodes = [
  { ref: `${S}room/ferry_landing`, kind: 'room' },
  { ref: `${S}condition/trusts`, kind: 'condition' },
  { ref: `${S}condition/both`, kind: 'condition' },
];

test('the named leaf is recognised by its tag const, so only it swaps in the condition picker', () => {
  // Break: recognising `named` by the branch's position or title, so a Policy's other 26 leaves get
  // their `key` field turned into a condition picker and every fact adjust stops offering facts.
  const named = { properties: { op: { const: 'named' }, key: { type: 'string' } } };
  const fact = {
    properties: { op: { const: 'fact.adjust' }, fact: { $ref: '#/$defs/FactRef' }, amount: {} },
  };
  assert.equal(isNamed(named), true);
  assert.equal(isNamed(fact), false);
  assert.equal(isNamed(undefined), false);
});

test('a condition picker offers the condition keys and no other kind', () => {
  // Break: listing every node, so the key field offers rooms and items as conditions and the author
  // writes `named: ferry_landing`, which the compile refuses as an unknown condition.
  assert.deepEqual(choices('condition', nodes), ['trusts', 'both']);
});
