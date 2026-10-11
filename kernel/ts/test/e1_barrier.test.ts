// E1 witness for a reaction's named barrier.set (e1_barrier.ts, Beads loka-kgd.103), on the showcase
// smithy with one rule: dropping the torch opens the woodstore door.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newWorld } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { reactionWitnesses } from './e1_obligations.ts';
import { act, content, go, id, ref, take } from './showcase_fixture.ts';

const RULE = ref('reaction', 'unbar');
const c = structuredClone(content) as any;
c.reactions = {
  [RULE]: {
    key: 'unbar',
    on: { event: 'item_dropped', item: c.reactions[ref('reaction', 'kindle')].on.item },
    apply: [
      {
        op: 'barrier.set',
        to: 'open',
        barrier: c.rooms[ref('room', 'smithy')].exits.south.barrier,
      },
    ],
  },
};

// Breaks: a committed barrier.set is never witnessed (its rule stays pending), or one that wrote
// nothing (the door already open) is.
test('E1 witnesses a named barrier.set only when it moved the barrier', () => {
  let w = newWorld(c as Cartridge, '5ca5e000-0000-4000-8000-0000000e1ba7' as never, [1, 2, 3, 4]);
  w = take(go(go(go(w, 'north').world, 'east').world, 'south').world, 'smithy_torch');
  const drop = (before: typeof w) => {
    const r = act(before, { type: 'drop', item_id: id(before, 'item', 'smithy_torch') });
    return { r, paths: reactionWitnesses(before, r.world, r.decision) };
  };
  const first = drop(w);
  assert.deepEqual(first.paths, [`/reactions/${RULE}`, `/reactions/${RULE}/apply/0`]);
  const again = drop(take(first.r.world, 'smithy_torch'));
  assert.equal(again.r.decision.kind, 'accepted');
  assert.deepEqual(again.paths, []);
});
