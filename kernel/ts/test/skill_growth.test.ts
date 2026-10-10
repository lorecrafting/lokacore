// Toolbox rows 5 and G5 on the compiled skills sampler: pick (growth [1, 2, 3, 4, 5], not taught)
// against a chest rated 3, a gate rated 5 and a vault rated 7; STR 8 (mechanics.md skill growth).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-skills-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/skills_sampler', file], {
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
const P = 'skills_sampler@0.0.1';

let n = 0;
const id = () => `eeeeeeee-9999-4999-8999-${String(++n).padStart(12, '0')}` as never;
const uses = (w: World) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => k.includes('"uses_pick"'))?.[1] ?? 0;

// Breaks: no use counted (the gate never opens), the level read after this attempt's use (the gate
// opens on the fifth), the count read as the level without thresholds, the rating ignored or
// compared strictly, the count growing past its last threshold, the use written before the check
// event, or the attribute arm reading the skill.
test('five pick attempts raise pick until the gate opens; level 5 beats 3, not 7; STR 8 beats 7', () => {
  n = 0;
  let w = newWorld(content, '3c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d' as never, [1, 2, 3, 4]);
  const perform = (action: string) => {
    const r = step(
      w,
      {
        id: id(),
        world_context_id: w.context,
        payload: { actor_id: w.character, type: 'perform', action },
      } as never,
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
    return r.decision as Extract<typeof r.decision, { kind: 'accepted' }>;
  };
  const first = perform('pick_gate');
  assert.deepEqual(
    first.events.map((e) => [e.position, e.payload.type]),
    [
      [1, 'check_failed'],
      [2, 'fact_changed'],
    ],
  );
  assert.equal(first.rng, w.state.rng); // no draw
  for (let i = 2; i <= 5; i++) assert.equal(perform('pick_gate').outcome, 'failure', `try ${i}`);
  assert.equal(uses(w), 5);
  assert.equal(perform('pick_gate').outcome, 'success');
  assert.equal(perform('pick_chest').outcome, 'success');
  const vault = perform('pick_vault');
  assert.equal(vault.outcome, 'failure');
  assert.deepEqual(vault.delta.ops, []); // the count stays at its last threshold
  assert.equal(uses(w), 5);
  assert.equal(perform('force_vault').outcome, 'success');
});

// Breaks: the loader drops a rows 5/G5 check, so growth that does not increase, an opposed check
// against an unrated detail, an unknown skill, an authored write of the count or an old API floor
// loads.
test('the loader refuses each unsound growth or opposed declaration', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const skill = `.cartridge.skills["${P}:skill/pick"]`;
  const gate = `.cartridge.recipes["${P}:recipe/pick_gate"]`;
  const api = '.cartridge.manifest.requires.kernel_api.at_least';
  const room = (c: any) => c.rooms[`${P}:room/vault_room`];
  const rows: [(c: any) => void, string, string][] = [
    [(c) => (c.manifest.requires.kernel_api.at_least = '1.43'), 'KERNEL_API_RANGE_INVALID', api],
    [(c) => (c.skills[`${P}:skill/pick`].growth[2] = 2), 'SCHEMA_VIOLATION', `${skill}.growth`],
    [(c) => delete room(c).details.gate.rating, 'SCHEMA_VIOLATION', `${gate}.check`],
    [
      (c) => (c.recipes[`${P}:recipe/pick_gate`].check.skill.key = 'climb'),
      'UNRESOLVED_REFERENCE',
      `${gate}.check.skill`,
    ],
    [
      (c) =>
        (c.recipes[`${P}:recipe/pick_gate`].outcomes.success.sequence[0] = {
          op: 'fact.assign',
          fact: {
            cartridge_id: P.split('@')[0],
            cartridge_version: '0.0.1',
            kind: 'fact',
            key: 'uses_pick',
          },
          value: 5,
        }),
      'RESERVED_FACT',
      `${gate}.outcomes.success.sequence[0].fact`,
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
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path], path);
  }
});
