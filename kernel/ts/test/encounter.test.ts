// Toolbox row 9 on the compiled encounter sampler (mechanics.md "Random encounters"): `bandits`
// (cap 1, wander_interval 3600, chance 25) from 08:00. Expected RNG states and rolls are
// hand-computed with an independent xoshiro128** uniform(100), not this kernel's sampler.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-encounter-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/encounter_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const PLAN = 'encounter_sampler@0.0.1:population/bandits';
const HOUR = 3600;
const START = 8 * HOUR;

function load(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
function world(rng: number[], edit?: (c: any) => void) {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(r.cartridge as Cartridge, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, rng);
}
let n = 0;
function elapsed(w: World, until: number): World {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}` as never;
  const from = w.state.clock;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, from, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from, until },
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const slot = (w: World, n = 1) =>
  Object.entries(w.state.population_slots!).find(([k]) => JSON.parse(k).slot === n)![1];
const bandits = (w: World) =>
  Object.keys(w.entities).filter(
    (e) => w.state.created?.[e]?.origin.kind === 'spawned' && w.entities[e]!.kind === 'npc',
  );
const room = (w: World, e: string) => w.state.containers[e];

// Break: genesis births an encounter plan like an ecology plan.
test('a fresh sampler world holds no bandit', () => {
  const w = world([1, 2, 3, 4]);
  assert.deepEqual(bandits(w), []);
  assert.equal(slot(w).generation, 0);
  assert.equal(slot(w).member_id, null);
});

// Breaks: the drawn RNG is not returned (no birth, RNG unchanged); a draw with no eligible slot
// (the second hour moves the RNG).
test('one hour rolls 20 and births a bandit in the road; a full plan draws nothing', () => {
  const one = elapsed(world([1, 2, 3, 4]), START + HOUR);
  assert.deepEqual(one.state.rng, [7, 0, 1026, 12288]);
  const [bandit] = bandits(one);
  assert.equal(bandits(one).length, 1);
  assert.equal(room(one, bandit!), one.roomIds['encounter_sampler@0.0.1:room/road']);
  const two = elapsed(one, START + 2 * HOUR);
  assert.deepEqual(two.state.rng, [7, 0, 1026, 12288]);
  assert.deepEqual(bandits(two), [bandit]);
});

// Break: crossed sub-steps of one advance do not see the earlier step's RNG (60 forever).
test('one three-hour advance rolls 60, 60, 20 and births at the third boundary', () => {
  const w = elapsed(world([1, 1, 1, 1]), START + 3 * HOUR);
  assert.deepEqual(w.state.rng, [2560, 513, 262145, 5242880]);
  assert.equal(bandits(w).length, 1);
});

// Break: the roll is compared with `<=`, so 25 births.
test('two hours rolling 25, 25 birth nothing', () => {
  const w = elapsed(elapsed(world([1, 7000003, 1, 1]), START + HOUR), START + 2 * HOUR);
  assert.deepEqual(w.state.rng, [1451102211, 3584001536, 7000003, 2801664688]);
  assert.deepEqual(bandits(w), []);
});

// Breaks: no boundary gate (the replacement-due occurrence draws and births); a draw before the
// eligibility check (the boundaries before the replacement due move the RNG).
test('a slot not yet due draws nothing at the boundary or at its replacement due', () => {
  let w = world([1, 2, 3, 4]);
  const key = Object.keys(w.state.population_slots!)[0]!;
  const due = START + 2 * HOUR + HOUR / 2;
  const row = { ...w.state.population_slots![key]!, replacement_due: due };
  w = { ...w, state: { ...w.state, population_slots: { [key]: row } } };
  for (const at of [START + HOUR, START + 2 * HOUR, due]) {
    w = elapsed(w, at);
    assert.deepEqual([w.state.rng, bandits(w)], [[1, 2, 3, 4], []], `at ${at}`);
  }
  w = elapsed(w, START + 3 * HOUR);
  assert.deepEqual(w.state.rng, [7, 0, 1026, 12288]);
  assert.equal(bandits(w).length, 1);
});

// Breaks: a successful roll births every eligible slot; it births the last, not the first.
test('a roll births one slot even when the cap is two', () => {
  const w = elapsed(
    world([1, 2, 3, 4], (c) =>
      Object.assign(c.populations[PLAN], { cap: 2, day_target: 2, night_target: 2 }),
    ),
    START + HOUR,
  );
  assert.equal(bandits(w).length, 1);
  assert.deepEqual([slot(w, 1).generation, slot(w, 2).generation], [1, 0]);
});

// Break: the suppression resume births like an ecology plan's (it is not a wander boundary).
test('a suppression resume births nothing and draws nothing', () => {
  let w = world([1, 2, 3, 4]);
  const [plan, control] = Object.entries(w.state.population_plans!)[0]!;
  const job_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  const ends_at = START + HOUR / 2;
  const suppression = { generation: 1, ends_at, job_id, cause_event_id: job_id };
  const job = { ...Object.values(w.state.jobs!)[0]!, due_time: ends_at };
  w = {
    ...w,
    state: {
      ...w.state,
      jobs: { ...w.state.jobs, [job_id]: job },
      population_plans: { [plan]: { ...control, suppression } as never },
    },
  };
  w = elapsed(w, ends_at);
  assert.deepEqual([w.state.rng, bandits(w)], [[1, 2, 3, 4], []]);
});

// Break: the loader admits an encounter plan below kernel_api 1.74.
test('chance needs kernel_api 1.74', () => {
  const r = load((c) => (c.manifest.requires.kernel_api.at_least = '1.73'));
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
  ]);
});
