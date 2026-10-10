// Toolbox row W1 on the compiled reactions sampler: an item_dropped trigger with item and room
// filters (no bespoke job) sets the fact behind the crow room variant (prose only: no NPC
// moves); its delivery keeps reaction@1's budgets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-reactions-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/reactions_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const R = 'reactions_sampler@0.0.1';
const fresh = (c: Cartridge = content) =>
  newWorld(c, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
let n = 0;
const act = (w: World, p: object) => {
  n += 1;
  const id = `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}`;
  return step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
    n,
  );
};
const item = (w: World, k: string) => w.entityIds[`${R}:item/${k}`];
const room = (w: World) => gameView(w).place!.description.key;
// Take then drop `k`, returning the drop's step.
const takeDrop = (w: World, k: string) => {
  const taken = act(w, { type: 'take', item_id: item(w, k) });
  assert.equal(taken.decision.kind, 'accepted', JSON.stringify(taken.decision));
  return act(taken.world, { type: 'drop', item_id: item(w, k) });
};

// Breaks: the item filter ignored (any drop draws the crow), or item_dropped never triggering.
test('a dropped bone shows the crow variant; a dropped pebble does not', () => {
  const pebble = takeDrop(fresh(), 'pebble');
  assert.equal(pebble.decision.kind, 'accepted');
  assert.equal(room(pebble.world), 'room.yard.description');
  const bone = takeDrop(pebble.world, 'bone');
  assert.equal(bone.decision.kind, 'accepted');
  assert.equal(room(bone.world), 'room.yard.crow');
});

// Breaks: deliveries of a newly triggerable kind escaping the FIFO budgets. A pebble drop starts
// a crow_drawn flip-flop that never quiesces: the whole drop faults and commits nothing.
test('a reaction chain from a dropped pebble stops at the budget', () => {
  const c = structuredClone(content) as any;
  const fact = {
    cartridge_id: 'reactions_sampler',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key: 'crow_drawn',
  };
  const rule = (key: string, on: object, equals: boolean) => ({
    key,
    on,
    when: { policy_version: 1, root: { op: 'fact_compare', fact, equals } },
    apply: [{ op: 'fact.assign', fact, value: !equals }],
  });
  const pebble = { ...c.reactions[`${R}:reaction/bone_drop`].on.item, key: 'pebble' };
  c.reactions = {
    [`${R}:reaction/drop`]: rule('drop', { event: 'item_dropped', item: pebble }, false),
    [`${R}:reaction/off`]: rule('off', { event: 'fact_changed', fact }, true),
    [`${R}:reaction/on`]: rule('on', { event: 'fact_changed', fact }, false),
  };
  const w = fresh(c);
  const taken = act(w, { type: 'take', item_id: item(w, 'pebble') });
  const dropped = act(taken.world, { type: 'drop', item_id: item(w, 'pebble') });
  assert.deepEqual(dropped.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(dropped.world, taken.world);
});
