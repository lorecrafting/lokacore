// Toolbox row G3 (second half) on the compiled NPC attribute sampler: an opposed str check that
// names a guard reads that guard's declared str at use (player str 10 against 15 and 5).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';

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
  let w = newWorld(content, '4c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d' as never, [1, 2, 3, 4]);
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

// Breaks: the loader drops a row G3 attribute check, so an artifact naming no NPC or attribute, a
// guard without the checked attribute, a template NPC, a duplicate entry or an older kernel_api loads and fails in play.
test('the loader refuses each unsound NPC attribute declaration', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const strong = `${P}:npc/strong_guard`;
  const at = `.cartridge.npcs[${JSON.stringify(strong)}].attributes`;
  const north = `.cartridge.recipes[${JSON.stringify(`${P}:recipe/shove_north`)}].check`;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.recipes[`${P}:recipe/shove_north`].check.npc.key = 'ghost'),
      'UNRESOLVED_REFERENCE',
      `${north}.npc`,
    ],
    [(c) => delete c.npcs[strong].attributes, 'SCHEMA_VIOLATION', `${north}.npc`],
    [(c) => (c.npcs[strong].spawn_template = true), 'SCHEMA_VIOLATION', `${north}.npc`],
    [
      (c) => (c.npcs[strong].attributes[0].attribute.key = 'dex'),
      'UNRESOLVED_REFERENCE',
      `${at}[0].attribute`,
    ],
    [
      (c) => c.npcs[strong].attributes.push({ ...c.npcs[strong].attributes[0], value: 1 }),
      'SCHEMA_VIOLATION',
      `${at}[1].attribute`,
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.45'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
