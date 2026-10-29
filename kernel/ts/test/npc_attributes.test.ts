// Toolbox row G3 (second half) on the compiled NPC attribute sampler: an opposed str check that
// names a guard reads that guard's declared str at use (player str 10 against 15 and 5).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-npc-attr-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/npc_attr_sampler', file], {
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
const P = 'npc_attr_sampler@0.0.1';

// Breaks: the rating read from the actor, the detail or the attribute's start 10 (both shoves
// pass), or from the wrong guard (both fail or the outcomes swap).
test('str 10 loses to the strong guard (str 15) and beats the weak guard (str 5)', () => {
  let n = 0;
  let w = newWorld(content, ctx('4c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d'), [1, 2, 3, 4]);
  const perform = (action: string) => {
    n += 1;
    const r = step(
      w,
      {
        id: `ffffffff-9999-4999-8999-${String(n).padStart(12, '0')}` as never,
        world_context_id: w.context,
        payload: { actor_id: w.character, type: 'perform', action },
      } as never,
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
    return (r.decision as { outcome: string }).outcome;
  };
  assert.equal(perform('shove_north'), 'failure');
  assert.equal(perform('shove_south'), 'success');
});
