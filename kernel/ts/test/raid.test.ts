// Toolbox row 37a on the compiled raid sampler (mechanics.md "Phased world events"): the lunar
// cycle is 2000 units, new at 0, full at 1000; the `raid` rule spawns one `raiders` bundle (cap 2,
// targets 0, wander every hour) at the first full-moon clock_hour while `raided` is false, and
// `calm` clears it at the new moon.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { DeltaOp } from '../src/contracts.gen.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { apply } from '../src/runtime/apply.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { cmp } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-raid-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/raid_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const VILLAGE = 'raid_sampler@0.0.1:room/village';

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
function world(edit?: (c: any) => void, context = '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f') {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(r.cartridge as Cartridge, context as never, [1, 2, 3, 4]);
}
let n = 0;
// Advances `hour` units (one hour by default) at a time to `until`, keeping each accepted delta.
function elapsed(w: World, until: number, receipts: DeltaOp[][] = [], hour = 100): World {
  while (w.state.clock < until) {
    const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}` as never;
    const from = w.state.clock;
    const to = Math.min(until, from - (from % hour) + hour);
    const r = stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, from, to) as never,
        world_context_id: w.context,
        payload: { type: 'elapsed', actor_id: w.character, run_id, from, until: to },
      },
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    if (r.decision.kind === 'accepted') receipts.push([...r.decision.delta.ops]);
    w = r.world;
  }
  return w;
}
const raiders = (w: World) =>
  Object.keys(w.entities).filter(
    (e) => w.state.created?.[e]?.origin.kind === 'spawned' && w.entities[e]!.kind === 'npc',
  );
function act(w: World, payload: object): World {
  const id = `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}` as never;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const slot = (w: World, n: number) =>
  Object.entries(w.state.population_slots!).find(([k]) => JSON.parse(k).slot === n)![1];
const raided = (w: World) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => k.includes('raided'))?.[1] ?? false;

// Breaks: genesis or an hour before the full moon births a raider (the plan's own job, or the
// rule firing outside the full phase).
test('a: no raider before the full moon', () => {
  const w = elapsed(world(), 999);
  assert.deepEqual(raiders(w), []);
  assert.equal(raided(w), false);
});

// Breaks: the reaction drops the spawn step (no raider), births outside the home, or a later
// hour of the same phase spawns again (the once-per-cycle fact not read).
test('b, c: the first full-moon hour births one raider in the village, once', () => {
  let w = elapsed(world(), 1000);
  assert.equal(raiders(w).length, 1);
  assert.equal(w.state.containers[raiders(w)[0]!], w.roomIds[VILLAGE]);
  assert.equal(raided(w), true);
  w = elapsed(w, 1900);
  assert.equal(raiders(w).length, 1);
});

// Breaks: the new moon does not reset the fact (no second raider), or the step ignores the cap
// (a third raider at the third full moon) or faults when no slot is free.
test('d, e: one raider per full moon up to cap 2, then nothing and no fault', () => {
  let w = elapsed(world(), 2000);
  assert.equal(raided(w), false);
  w = elapsed(w, 3000);
  assert.deepEqual(
    raiders(w).map((e) => w.state.containers[e]),
    [w.roomIds[VILLAGE], w.roomIds[VILLAGE]],
  );
  w = elapsed(w, 5000);
  assert.equal(raiders(w).length, 2);
  assert.equal(raided(w), true);
});

// Breaks: the step refills a dead member's slot before its replacement_delay (10000) is due, or
// fills from the lowest slot (the plan job's end).
test('a slain raider slot waits out its delay; the next full moon fills slot 1', () => {
  let w = elapsed(world(), 1000);
  const raider = raiders(w)[0]!;
  assert.equal(slot(w, 2).member_id, raider);
  w = act(act(w, { type: 'move', direction: 'north' }), { type: 'attack', target_id: raider });
  w = elapsed(w, 3000);
  assert.notEqual(slot(w, 2).replacement_due, null);
  assert.equal(slot(w, 2).member_id, raider);
  assert.notEqual(slot(w, 1).member_id, null);
});

// Break: a second step of one delivery does not skip the slot the first took (both birth slot 2).
test('a rule with two spawn steps births two raiders, slots 2 then 1', () => {
  const twice = (c: any) => {
    const apply = c.reactions['raid_sampler@0.0.1:reaction/raid'].apply;
    apply.unshift(apply[0]);
  };
  const w = elapsed(world(twice), 1000);
  assert.equal(raiders(w).length, 2);
  assert.ok(slot(w, 1).member_id && slot(w, 2).member_id);
});

// The full moon from 100: the raid's calendar job and the plan's job (wander boundary every hour)
// are both due at 100; same-time jobs run in job id order, so context 1111… runs the calendar job
// first and 2222… the plan's. `probe` also gives the plan target 1 and chance 100, so its own job
// births slot 1 at 100 too.
const CONTEXTS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
const fullAt100 = (c: any) => (c.calendar.lunar.phases[1].at = 100);
const probe = (c: any) => {
  fullAt100(c);
  Object.assign(Object.values(c.populations)[0]!, { day_target: 1, night_target: 1, chance: 100 });
};
const calendarFirst = (w: World) => {
  const plan = Object.values(w.state.population_plans!)[0]!.job_id;
  const due = Object.keys(w.state.jobs!).filter((id) => w.state.jobs![id]!.due_time === 100);
  return due.sort(cmp)[0] !== plan;
};

// Breaks: the plan's wander moves a spawned member (conflicting_write on its containment when the
// calendar job runs first, or in any order a later hour of one advance), or the spawn takes the
// plan job's slot 1 (one raider when the calendar job runs first, two when the plan's runs first).
test('a spawn and the plan wander at one time: the same raiders in both job orders', () => {
  assert.deepEqual(
    CONTEXTS.map((c) => calendarFirst(world(probe, c))),
    [true, false],
  );
  for (const context of CONTEXTS)
    for (const [edit, count] of [
      [fullAt100, 1],
      [probe, 2],
    ] as const) {
      const at100 = elapsed(world(edit, context), 100);
      const home = at100.roomIds[VILLAGE];
      assert.deepEqual(
        raiders(at100).map((e) => at100.state.containers[e]),
        Array(count).fill(home),
      );
      // One advance over four wander boundaries: the spawned raider is still home.
      const at400 = elapsed(world(edit, context), 400, [], 400);
      const spawned = raiders(at400).find((e) => slot(at400, 2).member_id === e)!;
      assert.equal(at400.state.containers[spawned], home);
    }
});

// Breaks: the spawn is not in the committed delta (a world rebuilt from the receipts lacks the
// raider) or the rebuilt world respawns it at a later hour of the same phase.
test('f: a world rebuilt from the receipts holds the one raider and does not respawn', () => {
  const receipts: DeltaOp[][] = [];
  const live = elapsed(world(), 1000, receipts);
  let rebuilt = world();
  for (const ops of receipts) {
    const r = apply(rebuilt, ops);
    assert.ok('world' in r, JSON.stringify(r));
    rebuilt = r.world;
  }
  assert.deepEqual(rebuilt.state, live.state);
  assert.equal(raiders(elapsed(rebuilt, 1900)).length, 1);
});

// Breaks: the loader's population.spawn or day_target 0 floor is missing or low, or the step's
// plan is never resolved.
test('g: the loader refuses population.spawn or a 0 target below 1.84, or an unknown plan', () => {
  const raid = 'raid_sampler@0.0.1:reaction/raid';
  const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
  for (const drop of [false, true]) {
    const old = load((c) => {
      c.manifest.requires.kernel_api.at_least = '1.83';
      if (drop) c.reactions[raid].apply.shift(); // the plan's target 0 alone
    });
    assert.deepEqual(old.ok ? undefined : [old.diagnostic.code, old.diagnostic.path], api);
  }
  const nowhere = load((c) => (c.reactions[raid].apply[0].plan.key = 'nowhere'));
  assert.deepEqual(nowhere.ok ? undefined : [nowhere.diagnostic.code, nowhere.diagnostic.path], [
    'UNRESOLVED_REFERENCE',
    `.cartridge.reactions["${raid}"].apply[0].plan`,
  ]);
});
