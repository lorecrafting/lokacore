// Diku rounds (loka-kgd.197, mechanics.md "Diku rounds") on the compiled diku sampler: Attack
// resolves round 1 at once, a uniform(2) draw orders each round, lines name the goblin, a hit's
// loss picks a tier and the goblin's condition follows the blows. The goblin has 10 HP and a sure
// hit for 2; the player's blow is a sure hit for 3; tiers at 50 and 25; conditions 100, 50, 1.
// RNG oracles: numeric-vectors.json rng_steps; seed [1,2,3,4] draws 11520, 0, 5927040, 70819200,
// so uniform(2) gives 0 (player first) in rounds 1 and 2; rng_steps[3].state draws 2031721883
// first, uniform(2) = 1 (the goblin first). Sure hits make the other draws' values irrelevant.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { check } from '../src/runtime/invariants.ts';
import { encountersValid } from '../src/mechanics/combat/saved.ts';
import { cartridgeOf, cmd, ctx, eid, reload } from './harness.ts';
import type { RngState } from '../src/contracts.gen.ts';
import type { Round } from '../src/mechanics/combat/round.ts';
import { swings } from '../src/mechanics/combat/swings.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-diku-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/diku_sampler', file, '--allow-placeholders'], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'diku_sampler@0.0.1';
const GOBLIN = 'npc.goblin.short';
const base = cartridgeOf(artifact);
function sampler(edit?: (combat: any) => void) {
  const r = reload(base, edit && ((c) => edit(c.world.combat)));
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}

let n = 0;
const id = () => `eeeeeeee-1970-4970-8970-${String(++n).padStart(12, '0')}`;
function decided(r: { world: World; decision: { kind: string } }) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const d = r.decision as any;
  return { w: r.world, d, lines: (d.narration ?? []) as { key: string; bindings?: object }[] };
}
function play(w: World, payload: object) {
  const command = { id: id(), world_context_id: w.context, payload };
  return decided(step(w, cmd({ ...command, payload: { actor_id: w.character, ...payload } }), n));
}
/** Walk south to the goblin and attack it. */
function attack(content: Cartridge, seed = [1, 2, 3, 4]) {
  n = 0;
  const w = play(newWorld(content, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), seed as RngState), {
    type: 'move',
    direction: 'south',
  }).w;
  return { before: w, ...play(w, { type: 'attack', target_id: goblin(w) }) };
}
function round(w: World) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return decided(stepElapsed(w, cmd({ ...command, world_context_id: w.context }), n));
}
const goblin = (w: World) => w.entityIds[`${S}:npc/goblin`];
const hp = (w: World, e: string) => level(w, eid(e), resourceRef(w, 'hp'));
const key = (k: string) => `combat.${k}`;
const ops = (d: any) => d.delta.ops.map((o: { op: string }) => o.op);

// Breaks: Attack only schedules round 1 (no blows, no RNG), draws other than three, the proposal carries a job.complete
// (invariant job_complete_owned_by_run), round 2 is not at clock + interval, the odd/even rule
// orders round 1, a line lacks its name, the tier or condition is missing or misplaced.
test('Attack strikes round 1 at once, player first, and names, tiers and conditions it', () => {
  const { before, w, d, lines } = attack(sampler());
  const g = goblin(w);
  assert.deepEqual([hp(w, g), hp(w, w.body)], [7, 8]);
  // Three raw draws (initiative, both accuracy rolls; fixed damage draws none): the state after
  // numeric-vectors.json rng_steps[2] from [1, 2, 3, 4].
  assert.deepEqual(
    [before.state.rng, w.state.rng],
    [
      [1, 2, 3, 4],
      [25179138, 12295, 540162, 2107404],
    ],
  );
  assert.ok(!ops(d).includes('job.complete'));
  assert.ok(check('job_complete_owned_by_run', { decision: d, before: before.state }));
  const jobs = d.delta.ops.filter((o: { op: string }) => o.op === 'job.schedule');
  assert.deepEqual(
    jobs.map((o: { due_time: number }) => o.due_time),
    [before.state.clock + 150],
  );
  assert.deepEqual(lines, [
    { key: key('player_hit_25'), bindings: { target: GOBLIN } },
    { key: key('npc_hit'), bindings: { attacker: GOBLIN } },
    { key: key('condition_50'), bindings: { target: GOBLIN } },
  ]);
  // 4 of 10 is below the 50 cut (400 < 500), at or above the 1 cut
  const two = round(w);
  assert.deepEqual([hp(two.w, g), hp(two.w, two.w.body)], [4, 6]);
  assert.deepEqual(
    two.lines.map((l) => l.key),
    [key('player_hit_25'), key('npc_hit'), key('condition_1')],
  );
});

// Breaks: initiative is not drawn (round 1 stays player first), or drawn with the wrong sense.
test('a 1 on the initiative draw lets the goblin strike first', () => {
  const { lines } = attack(sampler(), [27274249, 25704967, 31982592, 12605441]);
  assert.deepEqual(
    lines.map((l) => l.key),
    [key('npc_hit'), key('player_hit_25'), key('condition_50')],
  );
});

// Breaks: a tier or condition cut scaled other than by 100 (e.g. 101 × loss): a 3-hp hit on a
// 101-hp goblin is 300 < 3 × 101 but >= 2 × 101; its 98 left is 9800 < 98 × 101 but >= 97 × 101.
test('a cut compares 100 × hp with at_percent × hp range, both sides, on a 101-hp foe', () => {
  const big = reload(base, (c) => {
    c.npcs[`${S}:npc/goblin`].hp = { minimum: 0, maximum: 101, start: 101, gain: 0 };
    c.world.combat.tiers = [
      { at_percent: 3, player_hit: key('player_hit_50') },
      { at_percent: 2, player_hit: key('player_hit_25') },
    ];
    c.world.combat.conditions = [
      { at_percent: 98, text: key('condition_100') },
      { at_percent: 97, text: key('condition_50') },
    ];
  });
  assert.ok(big.ok, JSON.stringify(big));
  const { w, lines } = attack(big.cartridge as Cartridge);
  assert.equal(hp(w, goblin(w)), 98);
  assert.deepEqual(
    lines.map((l) => l.key),
    [key('player_hit_25'), key('npc_hit'), key('condition_50')],
  );
});

// Breaks: a fatal round 1 schedules a successor, the dead foe gets a condition line or strikes,
// the full-hp tier (100 × 10 >= 50 × 10) is missed, the death line loses its name, or a save
// refuses the closed row whose round-1 job was never scheduled.
test('a killing first blow closes the fight with no successor and no condition', () => {
  const { w, d, lines } = attack(
    sampler((c) => (c.player_attack.damage_min = c.player_attack.damage_max = 10)),
  );
  assert.equal(hp(w, goblin(w)), 0);
  assert.deepEqual([hp(w, w.body), ops(d).includes('job.schedule')], [10, false]);
  assert.ok(ops(d).includes('encounter.close'));
  assert.ok(encountersValid(w));
  assert.deepEqual(lines, [
    { key: key('player_hit_50'), bindings: { target: GOBLIN } },
    { key: key('npc_died'), bindings: { target: GOBLIN } },
  ]);
});

// Breaks (mechanics.md "First round at Attack"): a save accepts a missing job on a row other than
// a closed round-1 row, refuses that row once the cartridge drops initiative, refuses a live row's
// own job, or keeps a closed row whose job still waits.
test('a save lets only a closed round-1 row lack its job, with or without initiative', () => {
  const fatal = attack(
    sampler((c) => (c.player_attack.damage_min = c.player_attack.damage_max = 10)),
  ).w;
  const live = attack(sampler()).w;
  const edited = (w: World, edit: (row: any, job: any, w: any) => void) => {
    const copy = structuredClone(w);
    const [row] = Object.values(copy.state.encounters!);
    edit(row, copy.state.jobs?.[row!.job_id], copy);
    return encountersValid(copy);
  };
  assert.deepEqual(
    [
      encountersValid(live),
      edited(fatal, (row) => (row.round = 2)),
      edited(fatal, (_row, _job, w) => delete w.cartridge.world.combat.initiative),
      edited(fatal, (row) => (row.status = 'open')),
      edited(live, (_row, job) => (job.encounter_id = 'ffffffff-1970-4970-8970-000000000001')),
      edited(live, (row) => (row.status = 'closed')),
    ],
    [true, false, true, false, false, false],
  );
});

// Breaks: an opted-out cartridge draws at Attack, loses its scheduled round 1 or the odd/even
// order, or binds a strike line; tiers and conditions still apply without initiative, and the
// condition line still binds {target} (no literal braces).
test('without initiative Attack only schedules; tiers and conditions still apply', () => {
  const { before, w, d, lines } = attack(sampler((c) => delete c.initiative));
  assert.deepEqual([w.state.rng, lines], [before.state.rng, []]);
  assert.deepEqual(
    ops(d).filter((o: string) => o.startsWith('job')),
    ['job.schedule'],
  );
  const one = round(w);
  assert.deepEqual(one.lines, [
    { key: key('player_hit_25') },
    { key: key('npc_hit') },
    { key: key('condition_50'), bindings: { target: GOBLIN } },
  ]);
  const two = round(one.w);
  assert.deepEqual(
    two.lines.map((l) => l.key),
    [key('npc_hit'), key('player_hit_25'), key('condition_1')],
  );
});

// Swings (loka-kgd.200, mechanics.md "Swings"), from [1, 2, 3, 4]: initiative 11520 % 2 = 0 (the
// player first), then hit rolls 0, 5927040 % 100 = 40 and 70819200 % 100 = 0, against chance 30.
const swinging = (player: object, goblin?: object) =>
  reload(base, (c) => {
    Object.assign(c.world.combat.player_attack, player);
    Object.assign(c.npcs[`${S}:npc/goblin`].attack, goblin);
  });
// Breaks: one hit roll for every swing, the damages not summed or not applied once, the tier read
// from one swing (3 of 10 is the 25 tier; the 6 total is the 50), the summary line after the strike
// line, a wrong key for 2 of 3 or 2 of 2, or the goblin's summary without its name.
test('three swings at 30 hit, miss, hit: a summary, then the 50 tier of the 6 total', () => {
  const content = swinging({ chance: 30, attacks: 3 }, { attacks: 2 });
  assert.ok(content.ok, JSON.stringify(content));
  const { w, lines } = attack(content.cartridge as Cartridge);
  assert.deepEqual([hp(w, goblin(w)), hp(w, w.body)], [4, 6]);
  assert.deepEqual(lines, [
    { key: key('player_volley'), bindings: { count: 3, hits: 2 } },
    { key: key('player_hit_50'), bindings: { target: GOBLIN } },
    { key: key('npc_volley_all'), bindings: { attacker: GOBLIN, count: 2, hits: 2 } },
    { key: key('npc_hit'), bindings: { attacker: GOBLIN } },
    { key: key('condition_1'), bindings: { target: GOBLIN } },
  ]);
});

// Breaks: 1 of 2 not told by the _one key, or a summary (or a hit line) when no swing hit.
test('one hit of two tells the _one summary; no hit tells only the miss line', () => {
  const told = (chance: number) => {
    const content = swinging({ chance, attacks: 2 });
    assert.ok(content.ok, JSON.stringify(content));
    return attack(content.cartridge as Cartridge).lines.map((l) => [l.key, l.bindings]);
  };
  assert.deepEqual(told(30).slice(0, 2), [
    [key('player_volley_one'), { count: 2, hits: 1 }],
    [key('player_hit_25'), { target: GOBLIN }],
  ]);
  assert.deepEqual(told(0).slice(0, 2), [
    [key('player_miss'), { target: GOBLIN }],
    [key('npc_hit'), { attacker: GOBLIN }],
  ]);
});

// Breaks: the budget stays eight: initiative, five player swings and four goblin swings spend ten
// draws (sure hits, fixed damage, no defense), a fault under the fixed budget.
test('swings grow the round budget past eight draws', () => {
  const content = swinging({ damage_min: 1, damage_max: 1, attacks: 5 }, { attacks: 4 });
  assert.ok(content.ok, JSON.stringify(content));
  const { w, lines } = attack(content.cartridge as Cartridge);
  assert.deepEqual([hp(w, goblin(w)), hp(w, w.body)], [5, 2]);
  assert.deepEqual(
    lines.map((l) => l.key),
    [
      key('player_volley_all'),
      key('player_hit_50'),
      key('npc_volley_all'),
      key('npc_hit_50'),
      key('condition_50'),
    ],
  );
});

// Breaks: an opportunity of n swings grows the budget other than by 4 × (n − 1) (mechanics.md
// "Swings"); three unhit swings spend three draws and touch no world state.
test('three swings grow the budget by eight', () => {
  const { w } = attack(sampler());
  const row = Object.values(w.state.encounters!)[0];
  const r = { rng: [1, 2, 3, 4], draws: 0, budget: 8 } as unknown as Round;
  const profile = { chance: 0, damage_min: 1, damage_max: 1, attacks: 3 };
  const out = swings(w, row, goblin(w), profile, false, r);
  assert.deepEqual([out.hits, r.draws, r.budget], [0, 3, 16]);
});
