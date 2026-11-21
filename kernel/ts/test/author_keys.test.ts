// kernel/ts/play/keys.ts: the free key a dropped template's child takes. Expected keys are written by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childKey } from '../play/keys.ts';

test("a dropped template's child takes the first free <template>_<n>", () => {
  // Breaks: a child key reusing a compiled one (the starter refuses the drop), or starting past _1.
  // Also: an item's key counted against an NPC child, or a template's key (no node holds it) missed.
  const nodes = ['npc/wild', 'npc/wild_1', 'item/wild_2', 'npc/wild_4'].map((r) => ({
    kind: r.split('/')[0],
    ref: `cart@0:${r}`,
  }));
  const wild = (held: string[], on = nodes) => childKey('npcs', 'wild', on, held); // each call mints its key
  assert.deepEqual([wild([], []), wild([]), wild(['wild_3'])], ['wild_1', 'wild_2', 'wild_5']);
});
