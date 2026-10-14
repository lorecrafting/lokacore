// Toolbox row 39 on the compiled boss sampler (mechanics.md "Boss phases"): the warlord (hp 20,
// hits the player for 1 each round) calls one guard once at or below 60% while alive (`summon`), sets the
// `withdrawn` fact at or below 25% (`withdraw`; his schedule reads it each hour) and holds one crown.
// The player (hp 30) hits for 1.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-boss-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/boss_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const P = 'boss_sampler@0.0.1:';

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
function world(edit?: (c: any) => void) {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(
    r.cartridge as Cartridge,
    '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
}
let n = 0;
// One elapsed run to `until`, or runs ending at each multiple of `stride` (loka-kgd.152).
function elapsed(w: World, until: number, stride = until, log?: string[]): World {
  while (w.state.clock < until) {
    const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}` as never;
    const from = w.state.clock;
    const to = Math.min(until, from - (from % stride) + stride);
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
    if (r.decision.kind === 'accepted')
      log?.push(...r.decision.events.map((e: any) => `${e.logical_time} ${e.payload.type}`));
    w = r.world;
  }
  return w;
}
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
const boss = (w: World) => w.entityIds[`${P}npc/warlord`]!;
const hp = (w: World, e = boss(w)) => level(w, e, resourceRef(w, 'hp'));
const guards = (w: World) =>
  Object.keys(w.entities).filter(
    (e) => w.state.created?.[e]?.origin.kind === 'spawned' && w.entities[e]!.kind === 'npc',
  );
const fact = (w: World, name: string) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => k.includes(name))?.[1] ?? false;

const W = `${P}npc/warlord`;
const R = (k: string) => `${P}reaction/${k}`;
const percentLeaf = (c: any, k: string) =>
  k === 'summon' ? c.reactions[R(k)].when.root.items[0].item : c.reactions[R(k)].when.root.item;
const warlordHp = (maximum: number, start: number) => (c: any) =>
  Object.assign(c.npcs[W].hp, { maximum, start });
const fought = (edit?: (c: any) => void, until = 150) => {
  const w = world(edit);
  return elapsed(act(w, { type: 'attack', target_id: boss(w) }), until);
};

// Breaks: the percent compares with > or rounds (Math.floor(pct * max / 100), the 21/12 rows), the
// leaf reads the pool before the hit's loss (every row is one off), or reads the player's body
// (29 of 30 after one hit: no row summons) or the resources.json hp maximum (30).
test('the phases read the warlord after the hit: at or below 60% summons, at or below 25% withdraws', () => {
  for (const [rule, pct, maximum, after, fires] of [
    ['summon', 61, 20, 12, true],
    ['summon', 61, 20, 13, false],
    ['summon', 61, 100, 61, false],
    ['summon', 61, 100, 60, true],
    ['summon', 60, 21, 13, false],
    ['summon', 60, 21, 12, true],
    ['withdraw', 26, 20, 5, true],
    ['withdraw', 26, 20, 6, false],
  ] as const) {
    const w = fought((c) => {
      warlordHp(maximum, after + 1)(c);
      percentLeaf(c, rule).at_least_percent = pct;
    });
    assert.equal(hp(w), after);
    const name = rule === 'summon' ? 'summoned' : 'withdrawn';
    assert.equal(fact(w, name), fires, `${rule} ${pct}% of ${maximum} at ${after}`);
  }
  // The authored summon leaf (not overridden) holds at exactly 60%: 12 of 20.
  assert.equal(fact(fought(warlordHp(20, 13)), 'summoned'), true);
});

// Breaks: the `summoned` guard is dropped or not read (a second hit under 60% spawns the second
// guard the plan's cap 2 has room for).
test('the summon calls one guard across the hits under 60%', () => {
  const at1050 = fought(undefined, 1050);
  assert.deepEqual([hp(at1050), guards(at1050).length], [13, 0]);
  const at1350 = elapsed(at1050, 1350);
  assert.deepEqual([hp(at1350), guards(at1350).length, fact(at1350, 'summoned')], [11, 1, true]);
  assert.equal(at1350.state.containers[guards(at1350)[0]!], at1350.roomIds[`${P}room/hall`]);
});

// Breaks: the attack_result `target` filter is dropped (the warlord's hit on a player at 15 of 30
// reads the player's pool as the subject and summons).
test('a hit on a hurt player does not summon', () => {
  const w = fought((c) => (c.resources[`${P}resource/hp`].start = 15));
  assert.deepEqual([hp(w), hp(w, w.body), guards(w).length], [19, 14, 0]);
});

// Breaks: the withdraw fact is not set at 25%, or the schedule does not read it at the next hour.
test('withdraw at 25%: the warlord moves to his lair at the next hour', () => {
  const at2100 = fought(undefined, 2100);
  assert.deepEqual([hp(at2100), fact(at2100, 'withdrawn')], [6, false]);
  const at2250 = elapsed(at2100, 2250);
  const hall = at2250.roomIds[`${P}room/hall`];
  assert.deepEqual([hp(at2250), fact(at2250, 'withdrawn')], [5, true]);
  assert.equal(at2250.state.containers[boss(at2250)], hall);
  const at2300 = elapsed(at2250, 2300);
  assert.equal(at2300.state.containers[boss(at2300)], at2300.roomIds[`${P}room/lair`]);
});

// Breaks: death custody leaves the crown on the dead warlord or loses it; the summon fires on the
// killing blow (hp 0 is under 60%).
test('the warlord drops his one crown into his corpse in the hall, and calls no guard dying', () => {
  const w = fought(warlordHp(20, 1), 150);
  assert.deepEqual([guards(w).length, fact(w, 'summoned')], [0, false]);
  const corpse = w.state.containers[w.entityIds[`${P}item/crown`]!]!;
  assert.equal(w.entities[corpse as never]!.key, 'npc_corpse');
  assert.equal(w.state.containers[corpse], w.roomIds[`${P}room/hall`]);
});

// Breaks: the loader's 1.87 floor misses `subject`, `at_least_percent` or the `target` filter (the
// two leaves sit inside reaction `when`s), or refuses a 1.86 cartridge with none of them.
test('the loader refuses subject, at_least_percent or target below 1.87', () => {
  const old = (keep: 'none' | 'subject' | 'percent' | 'target') => (c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.86';
    for (const k of ['summon', 'withdraw']) {
      const leaf = percentLeaf(c, k);
      if (keep !== 'subject') delete leaf.subject;
      if (keep !== 'percent') {
        delete leaf.at_least_percent;
        leaf.at_least = 1;
      }
      if (keep !== 'target') delete c.reactions[R(k)].on.target;
    }
    if (keep !== 'subject') delete c.reactions[R('summon')].when.root.items[1].subject;
  };
  const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
  assert.ok(load(old('none')).ok);
  for (const keep of ['subject', 'percent', 'target'] as const) {
    const r = load(old(keep));
    assert.deepEqual(r.ok ? keep : [r.diagnostic.code, r.diagnostic.path], api);
  }
});

// Breaks: the subject leaf reads a pool its entity does not hold through the cartridge-wide spec
// (the warlord has no `mv`: full by default, or NaN with regen, which faults the attack).
test('a subject without the pool reads false', () => {
  const w = fought((c) => {
    const items = c.reactions[R('summon')].when.root.items;
    items[0] = JSON.parse(JSON.stringify(items[0].item).replace('"key":"hp"', '"key":"mv"'));
    items[0].at_least_percent = 1;
  });
  assert.deepEqual([hp(w), guards(w).length, fact(w, 'summoned')], [19, 0, false]);
});

// Breaks (loka-kgd.152): the drain reads its due list once (the round due at 300, scheduled by the
// round at 150, never runs: nonfuture_job), or a job scheduled inside the wait runs at the wait's
// end. Steps of 50 cross at most one round each; 20 hp less one per round, the summon at 12 (60%)
// after the round at 1200.
test('one wait through nine rounds equals the same wait in steps of 50', () => {
  const w = world();
  const a = act(w, { type: 'attack', target_id: boss(w) });
  const [oneLog, stepLog]: string[][] = [[], []];
  const [one, steps] = [elapsed(a, 1350, 1350, oneLog), elapsed(a, 1350, 50, stepLog)];
  const rounds = [150, 300, 450, 600, 750, 900, 1050, 1200, 1350];
  const hits = rounds.flatMap((t) => [`${t} attack_result`, `${t} attack_result`]);
  hits.splice(16, 0, '1200 fact_changed');
  assert.deepEqual([oneLog, stepLog], [hits, hits]);
  // Hourly jobs differ by design: one wait runs them as sub-steps of one row (proposal_hours.ts).
  const rows = (v: World, pick: (enc: boolean, status: string) => boolean) =>
    Object.values(v.state.jobs!)
      .filter((j) => pick(!!j.encounter_id, j.status))
      .sort((x, y) => x.due_time - y.due_time || x.job.key.localeCompare(y.job.key))
      .map((j) => `${j.due_time} ${j.status} ${j.job.key}${j.encounter_id ? ' round' : ''}`);
  for (const v of [one, steps]) {
    assert.deepEqual(
      rows(v, (enc) => enc),
      [...rounds.map((t) => `${t} completed warlord round`), '1500 pending warlord round'],
    );
    assert.deepEqual(
      rows(v, (_, s) => s === 'pending'),
      ['1400 pending guards', '1400 pending warlord', '1500 pending warlord round'],
    );
  }
  const rest = (v: World) => encode({ ...v.state, jobs: null, population_plans: null } as never);
  assert.equal(rest(one), rest(steps));
  assert.deepEqual([hp(one), guards(one).length], [11, 1]);
});
