// Toolbox row 28 on the compiled curse sampler: a ring cursed on taking holds itself on once worn,
// reads cursed only while worn, and the chapel's blessing lifts the curse for good.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { gameView } from '../src/view/view.ts';
import { validate } from '../src/foundation/validate.ts';
import { commands, ctx } from './harness.ts';

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

const stream = commands('eeeeeeee-2828-4828-8828');
const { send, play } = stream;
const fresh = () => newWorld(content, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e28'), [2, 8, 2, 8]);
const ring = (w: World) => w.entityIds['curse_sampler@0.0.1:item/ring']!;
const worn = (w: World) => gameView(w).equipment!.find((s) => s.item?.id === ring(w))?.item;
const carried = (w: World) => gameView(w).inventory.find((e) => e.id === ring(w));
const remove = (w: World) => worn(w)!.actions.find((a) => a.action_key === 'remove');
const removable = (w: World) => remove(w)?.available;

// Breaks: equipment@1 never reads the item's own statuses (the cursed ring comes off and lists
// Remove), or reads them so a lifted curse still holds (the blessed ring stays on), or bars wear
// too; the curse reaction ignores its blessed guard (the retaken ring is cursed again); the held
// ring drops Remove or lists it without the cursed cause, or the refusal drops it (loka-x6t.38).
test('a cursed ring will not come off until the chapel blesses it', () => {
  let w = play(fresh(), { type: 'take', item_id: ring(fresh()) });
  assert.equal(carried(w)!.name, 'item.ring.short', 'hidden while carried');
  assert.ok(carried(w)!.actions.some((a) => a.action_key === 'wear' && a.available));
  w = play(w, { type: 'wear', item_id: ring(w) });
  assert.equal(worn(w)!.name, 'item.ring.short_cursed');
  const cursed = { code: 'invalid_state', cause: 'cursed' };
  const held = remove(w);
  assert.ok(held && !held.available, 'Remove listed, unavailable');
  assert.deepEqual(held.reason, cursed);
  assert.deepEqual(validate('GameView', gameView(w)), []);
  const refused = send(w, { type: 'remove', item_id: ring(w) }).decision;
  assert.deepEqual(refused, { kind: 'rejected', error: cursed });

  w = play(w, { type: 'move', direction: 'north' });
  assert.equal(worn(w)!.name, 'item.ring.short', 'blessed');
  assert.equal(removable(w), true);
  w = play(w, { type: 'remove', item_id: ring(w) });
  w = play(w, { type: 'drop', item_id: ring(w) });
  w = play(w, { type: 'take', item_id: ring(w) });
  w = play(w, { type: 'wear', item_id: ring(w) });
  assert.equal(removable(w), true, 'not cursed again');
});
