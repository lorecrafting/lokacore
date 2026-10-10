// Toolbox row 6a on the compiled targets sampler: two goblins of one pack plan (6 HP, attack
// chance 0) and a player blow that always hits for 2; with world.combat.target_choice, Attack on
// the other roster member while engaged makes it the primary the player strikes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-targets-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/targets_sampler', file], {
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
const id = () => `eeeeeeee-6666-4666-8666-${String(++n).padStart(12, '0')}` as never;
function play(w: World, payload: object) {
  return step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
}
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
/** In the den, engaged with the lower-id goblin; returns [world, first, second]. */
function engaged(cartridge = content): [World, string, string] {
  n = 0;
  let w = newWorld(cartridge, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  w = ok(play(w, { type: 'move', direction: 'east' }));
  const den = w.state.containers[w.body];
  const [a, b] = Object.keys(w.state.created ?? {})
    .filter((e) => w.state.created![e].origin.kind === 'spawned' && w.state.containers[e] === den)
    .sort();
  assert.ok(a && b, 'two goblins in the den');
  return [ok(play(w, { type: 'attack', target_id: a })), a, b];
}
function round(w: World) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
}
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));

// Breaks: the switch is refused, writes nothing, or the round still strikes the first primary.
test('the player picks the second goblin; the round blow lands on it, the first is untouched', () => {
  const [start, a, b] = engaged();
  assert.deepEqual([hp(round(start), a), hp(round(start), b)], [4, 6], 'default: first goblin');
  const switched = play(start, { type: 'attack', target_id: b });
  const w = ok(switched);
  assert.deepEqual(switched.decision.kind === 'accepted' && switched.decision.narration, [
    { key: 'combat.goblin_targeted', participants: { enemy: b } },
  ]);
  assert.equal(w.state.rng, start.state.rng, 'no draw');
  const after = round(w);
  assert.deepEqual([hp(after, a), hp(after, b)], [6, 4]);
});

// Breaks: the current primary or a goblin without the opt-in can be "switched" to, or the
// GameView offers Attack on a target the rule refuses.
test('only another roster member is a choice, and only when the cartridge opts in', () => {
  const [w, a, b] = engaged();
  const offered = (v: World) =>
    gameView(v).entities.flatMap((e) =>
      e.actions.filter((x) => x.action_key === 'attack').map((x) => [e.id, x.available]),
    );
  assert.deepEqual(offered(w), [
    [a, false],
    [b, true],
  ]);
  assert.equal(play(w, { type: 'attack', target_id: a }).decision.kind, 'rejected');
  const single = structuredClone(w);
  for (const row of Object.values(single.state.encounters ?? {}))
    (row as { active_ids: unknown }).active_ids = [a];
  assert.deepEqual(offered(single), [], 'a roster of one keeps the single-foe ActionSet');
  const plain = structuredClone(content) as { world: { combat: Record<string, unknown> } };
  delete plain.world.combat.target_choice;
  const [off, , other] = engaged(plain as unknown as Cartridge);
  assert.deepEqual(offered(off), []);
  assert.equal(play(off, { type: 'attack', target_id: other }).decision.kind, 'rejected');
});

// Breaks: the loader admits target choice under API 1.47 (twin of content_targets_test.exs).
test('the loader refuses target choice below API 1.48', () => {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.manifest.requires.kernel_api.at_least = '1.47';
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
  ]);
});
