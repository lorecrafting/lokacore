import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, newWorld, step, type Cartridge } from '../src/index.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-deer-source-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ashmere_missing_child', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const compiled = JSON.parse(new TextDecoder().decode(artifact));
export const bundle = { canonical: encode(compiled.cartridge), sha256: compiled.content_hash };
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const content = loaded.cartridge as Cartridge;
export const fresh = (seed: readonly number[] = [1, 2, 3, 4]) => {
  const world = newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, seed);
  const selected = step(
    world,
    {
      id: '11111111-2222-4333-8444-555555555555' as never,
      world_context_id: world.context,
      payload: {
        type: 'choose_ancestry',
        actor_id: world.character,
        ancestry: 'fey_touched' as never,
      },
    },
    1,
  );
  assert.equal(selected.decision.kind, 'accepted');
  return selected.world;
};
export const ref = (kind: string, name: string) =>
  `${content.manifest.id}@${content.manifest.version}:${kind}/${name}`;
