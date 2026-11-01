// Toolbox rows 5 and G5 on the compiled skills sampler: pick (growth [1, 2, 3, 4, 5], not taught)
// against a chest rated 3, a gate rated 5 and a vault rated 7; STR 8 (mechanics.md skill growth).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { key } from '../src/foundation/compose.ts';
import { ctx } from './harness.ts';

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

const attempt = (w: World, action: string) =>
  step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, type: 'perform', action },
    } as never,
    n,
  );

// Breaks: no use counted (the gate never opens), the level read after this attempt's use (the gate
// opens on the fifth), the count read as the level without thresholds, the rating ignored or
// compared strictly, the count growing past its last threshold, the use written before the check
// event, or the attribute arm reading the skill.
test('five pick attempts raise pick until the gate opens; level 5 beats 3, not 7; STR 8 beats 7', () => {
  n = 0;
  let w = newWorld(content, ctx('3c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d'), [1, 2, 3, 4]);
  const perform = (action: string) => {
    const r = attempt(w, action);
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

// Breaks: a taught skill's level omits its base 1 (the gate opens a try late).
test('a taught pick opens the rating 5 gate on the fifth attempt', () => {
  let w = newWorld(content, ctx('3c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d'), [1, 2, 3, 4]);
  const taught = key({
    kind: 'fact',
    fact: {
      cartridge_id: 'skills_sampler',
      cartridge_version: '0.0.1',
      kind: 'fact',
      key: 'skill_pick',
    },
    scope: { kind: 'player', character_id: w.character },
  });
  w = { ...w, state: { ...w.state, facts: { ...w.state.facts, [taught]: true } } } as World;
  const outcomes: unknown[] = [];
  for (let i = 1; i <= 5; i++) {
    const r = step(
      w,
      {
        id: `eeeeeeee-9999-4999-8999-${String(i).padStart(12, '0')}`,
        world_context_id: w.context,
        payload: { actor_id: w.character, type: 'perform', action: 'pick_gate' },
      } as never,
      i,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
    outcomes.push((r.decision as { outcome?: unknown }).outcome);
  }
  assert.deepEqual(outcomes, ['failure', 'failure', 'failure', 'failure', 'success']);
  // Breaks: the top level's rank missed by an off-by-one against the taught base.
  assert.deepEqual(gameView(w).skills![0]!.rank, { label: 'skill.pick.rank6' });
});

// Breaks: ranks[level] for ranks[level - 1]; a rank at level 0; reached filled when undeclared or
// dropped when declared; learned shown only once acquired; a rank without its label accepted by the
// view schema.
test('the view names the rank of the current level and always carries the learned line', () => {
  n = 0;
  let w = newWorld(content, ctx('3c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d'), [1, 2, 3, 4]);
  const pick = () => {
    const view = gameView(w);
    assert.deepEqual(validate('GameView', view), []);
    return view.skills![0]!;
  };
  assert.equal(pick().learned, 'skill.pick.learned');
  assert.equal(pick().level, 0);
  assert.equal('rank' in pick(), false);
  const expected: [number, object][] = [
    [1, { label: 'skill.pick.rank1' }],
    [2, { label: 'skill.pick.rank2', reached: 'skill.pick.rank2_reached' }],
    [3, { label: 'skill.pick.rank3' }],
    [4, { label: 'skill.pick.rank4' }],
    [5, { label: 'skill.pick.rank5', reached: 'skill.pick.rank5_reached' }],
  ];
  for (const [at, rank] of expected) {
    const r = attempt(w, 'pick_gate');
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
    assert.equal(pick().level, at);
    assert.deepEqual(pick().rank, rank);
    assert.equal(pick().learned, 'skill.pick.learned');
  }
  const unlabelled = { ...gameView(w), skills: [{ ...pick(), rank: {} }] };
  assert.notDeepEqual(validate('GameView', unlabelled), []);
});
