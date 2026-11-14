// The Rules block's per-branch form (docs/design/story-tooling.md §2b K1 row 3): a `named` leaf keys
// on a condition, and no other Policy leaf does. Unit-level, over `branchForm` alone.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { branchForm } from '../src/edit/blocks/branch_form.ts';

const named = { properties: { op: { const: 'named' }, key: { type: 'string' } } };
const adjust = {
  properties: { op: { const: 'fact.adjust' }, fact: { $ref: '#/$defs/FactRef' }, amount: {} },
};

// Break: the condition picker is attached to every branch, so `fact.adjust`'s `fact` field becomes a
// condition list and an author can no longer name a fact.
test('only the named leaf keys on a condition', () => {
  assert.deepEqual(branchForm([named, adjust] as never, [{}, {}], 0).key, {
    'ui:field': 'ConditionKey',
  });
  assert.equal(branchForm([named, adjust] as never, [{}, {}], 1).key, undefined);
});

// Break: the branch's own uiSchema is dropped when the condition field is added, so every other
// field on a `named` leaf (its title, its hidden tag) reverts to rjsf's default.
test('a named leaf keeps its branch uiSchema alongside the condition key', () => {
  const form = branchForm([named] as never, [{ key: { 'ui:title': 'Which condition' } }], 0);
  assert.deepEqual(form.key, { 'ui:title': 'Which condition', 'ui:field': 'ConditionKey' });
  assert.equal(form['ui:label'], false);
});
