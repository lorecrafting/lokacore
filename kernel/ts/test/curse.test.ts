// Toolbox row 28 on the compiled curse sampler: a ring cursed on taking holds itself on once worn,
// reads cursed only while worn, and the chapel's blessing lifts the curse for good.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { gameView } from '../src/view/view.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-curse-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/curse_sampler', file], {
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

let n = 0;
const send = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-2828-4828-8828-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = () =>
  newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e28' as never, [2, 8, 2, 8]);
const ring = (w: World) => w.entityIds['curse_sampler@0.0.1:item/ring']!;
const worn = (w: World) => gameView(w).equipment!.find((s) => s.item?.id === ring(w))?.item;
const carried = (w: World) => gameView(w).inventory.find((e) => e.id === ring(w));
const removable = (w: World) => worn(w)!.actions.some((a) => a.action_key === 'remove');

// Breaks: equipment@1 never reads the item's own statuses (the cursed ring comes off and lists
// Remove), or reads them so a lifted curse still holds (the blessed ring stays on); the curse
// reaction ignores its blessed guard (the retaken ring is cursed again).
test('a cursed ring will not come off until the chapel blesses it', () => {
  let w = play(fresh(), { type: 'take', item_id: ring(fresh()) });
  assert.equal(carried(w)!.name, 'item.ring.short', 'hidden while carried');
  w = play(w, { type: 'wear', item_id: ring(w) });
  assert.equal(worn(w)!.name, 'item.ring.short_cursed');
  assert.equal(removable(w), false);
  const refused = send(w, { type: 'remove', item_id: ring(w) }).decision;
  assert.equal(refused.kind === 'rejected' && refused.error.code, 'invalid_state');

  w = play(w, { type: 'move', direction: 'north' });
  assert.equal(worn(w)!.name, 'item.ring.short', 'blessed');
  assert.equal(removable(w), true);
  w = play(w, { type: 'remove', item_id: ring(w) });
  w = play(w, { type: 'drop', item_id: ring(w) });
  w = play(w, { type: 'take', item_id: ring(w) });
  w = play(w, { type: 'wear', item_id: ring(w) });
  assert.equal(removable(w), true, 'not cursed again');
});
