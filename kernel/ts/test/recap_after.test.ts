// Toolbox row W27 on the compiled recap sampler: GameView carries the authored away recap threshold
// in logical seconds; the loader's twin of the Elixir API floor (1.47).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-recap-after-'));
let source: any;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/recap_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  source = JSON.parse(readFileSync(file, 'utf8')).cartridge;
} finally {
  rmSync(scratch, { recursive: true });
}
function load(change: (c: any) => void = () => {}) {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const view = (change?: (c: any) => void) => {
  const r = load(change);
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostic));
  return gameView(
    newWorld(
      r.cartridge as Cartridge,
      '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
      [1, 2, 3, 4],
    ),
  );
};

// Breaks: the threshold is projected in real minutes or seconds, not logical seconds (30 minutes
// at rate 50 is 90000); it shows without the field; the API floor is not checked.
test('recap_after is the authored minutes in logical seconds, absent unless authored', () => {
  assert.equal(view().recap_after, 90000);
  assert.equal(
    view((c) => delete c.manifest.time_policy.recap_after_minutes).recap_after,
    undefined,
  );
  const r = load((c) => (c.manifest.requires.kernel_api.at_least = '1.46'));
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
  ]);
});
