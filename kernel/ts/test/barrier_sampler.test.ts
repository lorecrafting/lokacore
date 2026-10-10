// Toolbox rows 13 and G12 on the compiled barrier sampler, content only (mechanics.md pick and
// force): a keyless chest whose lid opens once its lock (rated 1) is picked, a fragile wooden door
// (rated 5) whose failed pick jams it and which then gives to STR 8, and an iron door that no
// force recipe reaches; pick grows [1], not taught.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-barrier-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/barrier_sampler', file], {
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

// Breaks: the pick check ignoring the rating or the use count (the chest opens on the first try or
// never), opens_when skipped for an item's barrier (the chest opens before the pick), a failure
// outcome's jam not written (the door can be picked again), the force check not reading STR, or
// has_tag ignoring the barrier's tags (the iron door is forced).
test('a keyless chest opens on a pick; a jammed fragile door gives to STR; an iron door does not', () => {
  let n = 0;
  let w = newWorld(content, '5d7f9b1c-3e5a-4c7e-9a1b-3d5f7b9d1e3f' as never, [1, 2, 3, 4]);
  const chest = w.entityIds['barrier_sampler@0.0.1:item/chest'];
  const run = (payload: object) => {
    n += 1;
    const r = step(
      w,
      {
        id: `eeeeeeee-1313-4313-8313-${String(n).padStart(12, '0')}`,
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    );
    w = r.world;
    const d = r.decision as { kind: string; outcome?: string; error?: { code: string } };
    return d.kind === 'accepted' ? d.outcome : d.error?.code;
  };
  const perform = (action: string) => run({ type: 'perform', action });
  assert.deepEqual(
    [
      run({ type: 'open', target_id: chest }),
      perform('pick_lock'),
      perform('pick_lock'),
      run({ type: 'open', target_id: chest }),
      perform('pick_door'),
      perform('pick_door'),
      run({ type: 'open', direction: 'north' }),
      perform('force_door'),
      run({ type: 'open', direction: 'north' }),
      perform('force_iron'),
      run({ type: 'open', direction: 'east' }),
    ],
    [
      'invalid_state', // the lid stays shut until the lock is picked
      'failure', // pick level 0 < 1
      'success', // level 1 after one use
      'opened',
      'failure', // level 1 < 5, and the failure jams the lock
      'invalid_state', // the policy refuses: the lock is jammed
      'invalid_state',
      'success', // STR 8 >= 5, and the door is fragile
      'opened',
      'invalid_state', // the policy refuses: the iron door is not fragile
      'invalid_state',
    ],
  );
});
