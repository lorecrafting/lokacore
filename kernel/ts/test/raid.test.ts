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
const fact = (w: World, key: string) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => JSON.parse(k).fact.key === key)?.[1];
const raided = (w: World) => fact(w, 'raided') ?? false;

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
// first and 4444… the plan's (the job ids depend on the content: row 38's defender moved them,
// so a content change may need a new context here). `probe` also gives the plan target 1 and chance 100, so its own job
// births slot 1 at 100 too.
const CONTEXTS = ['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444'];
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
      // drop: the plan's target 0 alone; else the step alone (targets 1)
      if (drop) c.reactions[raid].apply.shift();
      else Object.assign(Object.values(c.populations)[0]!, { day_target: 1, night_target: 1 });
    });
    assert.deepEqual(old.ok ? undefined : [old.diagnostic.code, old.diagnostic.path], api);
  }
  const nowhere = load((c) => (c.reactions[raid].apply[0].plan.key = 'nowhere'));
  assert.deepEqual(nowhere.ok ? undefined : [nowhere.diagnostic.code, nowhere.diagnostic.path], [
    'UNRESOLVED_REFERENCE',
    `.cartridge.reactions["${raid}"].apply[0].plan`,
  ]);
});

// Row 37b: the `aftermath` rule adds 1 to the instance fact `aftermaths` on `raided`'s
// fact_changed to false, which fires only at the first new-moon hour after a raid.
const aftermaths = (w: World) => fact(w, 'aftermaths') ?? 0;

// Breaks: the rule counts the raid's own change to true, counts every new-moon hour (a clock_hour
// trigger), or a world rebuilt from the receipts counts the closed cycle again.
test('37b: the aftermath applies once per cycle, across new-moon hours and a rebuild', () => {
  const receipts: DeltaOp[][] = [];
  let w = elapsed(world(), 1900, receipts);
  assert.equal(aftermaths(w), 0);
  w = elapsed(w, 2100, receipts);
  assert.equal(aftermaths(w), 1);
  let rebuilt = world();
  for (const ops of receipts) {
    const r = apply(rebuilt, ops);
    assert.ok('world' in r, JSON.stringify(r));
    rebuilt = r.world;
  }
  assert.deepEqual(rebuilt.state, w.state);
  rebuilt = elapsed(rebuilt, 2900);
  assert.equal(aftermaths(rebuilt), 1);
  rebuilt = elapsed(rebuilt, 4900);
  assert.equal(aftermaths(rebuilt), 2);
});

// Row 38 (protect objective): `called_to_hold` activates hold_the_gate for the player whose body
// enters the village while raided; `defender_fell` fails it on the defender's death; `gate_held`
// resolves it, per holder, when raided turns false.
const gate = (w: World) =>
  Object.values(w.state.quests ?? {})
    .filter((q) => q.quest.key === 'hold_the_gate')
    .map((q) => [q.scope, q.state, q.outcome]);
const holder = (w: World, state: string, outcome?: string) => [
  [{ kind: 'player', character_id: w.character }, state, outcome],
];
const defender = (w: World) =>
  Object.keys(w.entities).find((e) => w.entities[e]!.kind === 'npc' && !raiders(w).includes(e))!;

// Breaks: entering activates while the gate is not raided (the `when` not read for the entrant).
test('38: entering the village before the raid activates nothing; no holder resolves nothing', () => {
  let w = elapsed(act(world(), { type: 'move', direction: 'north' }), 999);
  assert.deepEqual(gate(w), []);
  w = elapsed(w, 2000);
  assert.deepEqual(gate(w), []);
});

// Breaks: the entrant is not the delivery actor (activation lands on the root's actor or
// nowhere), or the resolve step does not reach the holder on a world-caused fact_changed.
test('38: entering while raided activates for the entrant; the new moon resolves it held', () => {
  let w = act(elapsed(world(), 1000), { type: 'move', direction: 'north' });
  assert.deepEqual(gate(w), holder(w, 'active'));
  w = elapsed(act(w, { type: 'move', direction: 'south' }), 2000);
  assert.deepEqual(gate(w), holder(w, 'resolved', 'held'));
});

// Breaks: quest.fail is legal only under fact_changed (the death does not fail it), or the resolve
// step does not skip a terminal holder (the new moon overwrites failed or faults).
test('38: the defender dying fails it fallen; the new moon leaves it failed', () => {
  let w = act(elapsed(world(), 1000), { type: 'move', direction: 'north' });
  w = elapsed(act(w, { type: 'attack', target_id: defender(w) }), 1200);
  assert.deepEqual(gate(w), holder(w, 'failed', 'fallen'));
  w = elapsed(w, 2000);
  assert.deepEqual(gate(w), holder(w, 'failed', 'fallen'));
});

// Breaks: the activation `when` does not read the defender (a player entering after it fell takes
// a quest the new moon then resolves held), or a fail with no holder writes or faults.
test('38: with the defender already dead, entering while raided activates nothing', () => {
  let w = act(world(), { type: 'move', direction: 'north' });
  w = elapsed(act(w, { type: 'attack', target_id: defender(w) }), 1000);
  w = act(act(w, { type: 'move', direction: 'south' }), { type: 'move', direction: 'north' });
  assert.equal(raided(w), true);
  assert.deepEqual(gate(w), []);
});

// Breaks: an NPC entrant activates for the root player (reaction.ts drops `npc ||`; the actor falls
// back to the player, whose view holds the `when`). The defender walks field -> village on schedule.
test('38: the defender walking into the raided village activates nothing', () => {
  let w = world((c) => {
    const d = c.npcs['raid_sampler@0.0.1:npc/defender'];
    const at = (key: string) => ({ ...d.room, key });
    d.daily_schedule = { '0': at('field'), '2': at('village') };
    d.room = at('field');
  });
  w = elapsed(act(w, { type: 'move', direction: 'north' }), 1300);
  assert.equal(raided(w), true);
  assert.equal(w.state.containers[defender(w)], w.roomIds[VILLAGE]);
  assert.deepEqual(gate(w), []);
});
