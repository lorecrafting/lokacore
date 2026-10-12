// `node kernel/ts/play/fight.ts <artifact> [--seeds N] [--rounds R]` (docs/system/cartridge.md#fight-matrix-and-encounter-rating-balance-tool-7):
// fights every armed NPC and every population plan at each level and build over many seeds with
// the real round code, and prints each cell's outcomes and each target's rating as one canonical
// JSON document. A report for authors, not a check.
import { readFileSync } from 'node:fs';
import type { Command, DecisionResult, EntityId, PopulationPlan } from '../src/contracts.gen.ts';
import { decode, encode, type Json } from '../src/foundation/canonical.ts';
import { elapsedCommandId, id } from '../src/foundation/id_source.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { units } from '../src/mechanics/calendar.ts';
import { living } from '../src/mechanics/death/shared.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { refString } from '../src/runtime/decision.ts';
import { stepElapsed } from '../src/runtime/world.ts';
import { checked, gen, KERNEL, type Kernel } from '../test/sim.ts';
import { median } from './flows.ts';

type Outcome =
  | { end: 'win'; rounds: number; hp: number }
  | { end: 'death' | 'timeout' | 'fled' | 'unborn' }
  | { end: 'refused'; code: string };
type Find = (w: World) => EntityId | undefined;
type Row = { experience: number; allocated: Record<string, number> };
type Matrix = { c: Cartridge; worlds: World[]; rounds: number; builds: string[] };
type Cell = ReturnType<typeof cell>;

const RUN = id('loka-fights', 'run', 0);
const ELAPSED: Kernel = { ...KERNEL, step: stepElapsed as Kernel['step'] };
const byKey = ([a]: [string, unknown], [b]: [string, unknown]) => (a < b ? -1 : 1);

/** The fight matrix and ratings (cartridge.md "Fight matrix and encounter rating"). */
export function fights(c: Cartridge, opts: { seeds?: number; rounds?: number } = {}) {
  const { seeds = 32, rounds = 100 } = opts;
  const alone = withoutAllies(c);
  const worlds = Array.from({ length: seeds }, (_, s) => genesis(alone, s + 1));
  const m = { c, worlds, rounds, builds: ['none', ...Object.keys(c.attributes ?? {}).sort()] };
  const w0 = worlds[0]!;
  const npcs = Object.entries(w0.entityIds)
    .filter(([, e]) => w0.entities[e]?.kind === 'npc' && !!w0.entities[e].attack && living(w0, e))
    .sort(byKey)
    .map(([ref]) => target(m, ref, (w) => w.entityIds[ref] as EntityId)); // ids differ per seed
  const plans = Object.entries(c.populations ?? {})
    .sort(byKey)
    .map(([ref, plan]) => target(m, ref, (w) => member(w, ref), plan));
  return {
    cartridge: `${c.manifest.id}@${c.manifest.version}`,
    seeds,
    rounds,
    targets: [...npcs, ...plans],
  };
}

// One target's cells, level by level, then build by build, and its rating.
function target(m: Matrix, name: string, find: Find, plan?: PopulationPlan) {
  const spec = m.c.world?.levelling;
  const cells = [];
  for (let l = 1; l <= (spec ? spec.thresholds.length + 1 : 1); l++)
    for (const build of m.builds) {
      const outs = [];
      for (let s = 0; s < m.worlds.length && outs.at(-1)?.end !== 'refused'; s++)
        outs.push(fight(m.worlds[s]!, s + 1, find, row(m.c, l, build), m.rounds, plan));
      cells.push(cell(l, build, outs, !!plan));
    }
  return { target: name, rating: rating(m.c, cells, plan), cells };
}

// The levelling row of `build` at level `l`: every point on that one attribute.
function row(c: Cartridge, l: number, build: string): Row | undefined {
  const spec = c.world?.levelling;
  if (!spec) return undefined;
  const points = spec.points_per_level * (l - 1);
  return {
    experience: l > 1 ? spec.thresholds[l - 2]! : 0,
    allocated: build !== 'none' && points ? { [build]: points } : {},
  };
}

// The first cell in level, then build order with win_pct at least 50.00 names the level and build.
function rating(c: Cartridge, cells: Cell[], plan?: PopulationPlan) {
  const first = cells.find((x) => 'win_pct' in x && Number(x.win_pct) >= 50);
  const one = cells[0]!;
  return {
    first_win_level: first?.level ?? null,
    first_win_build: first?.build ?? null,
    death_pct_level_1: 'death_pct' in one ? one.death_pct : null,
    ...(plan && {
      chance: plan.chance ?? null,
      opportunities_per_day: (units(c).day / plan.wander_interval).toFixed(2),
    }),
  };
}

// The tool's pinned limit: the player fights alone, so no listed ally takes a turn.
function withoutAllies(c: Cartridge): Cartridge {
  if (!c.world?.combat?.allies) return c;
  const { allies: _, ...combat } = c.world.combat;
  return { ...c, world: { ...c.world, combat } };
}

// A new world for the seed, its RNG drawn as flows.ts draws it.
function genesis(c: Cartridge, seed: number) {
  const g = gen(seed);
  const rng = [g.draw(), g.draw(), g.draw(), (g.draw() | 1) >>> 0];
  return newWorld(c, id('loka-fights', String(seed), 0) as World['context'], rng);
}

// A plan's lowest-EntityId living member.
const member = (w: World, plan: string) =>
  Object.entries(w.state.population_slots ?? {})
    .flatMap(([k, slot]) =>
      refString((decode(k) as { plan: never }).plan) === plan &&
      slot.member_id &&
      living(w, slot.member_id)
        ? [slot.member_id]
        : [],
    )
    .sort()[0] as EntityId | undefined;

// One seed's play: seed 1 keeps every invariant through the simulator's checked step; later seeds
// take the plain step (checking every step took 359 s on the showcase, cartridge.md).
function session(w: World, seed: number) {
  const p = {
    w,
    n: 0,
    play(kernel: Kernel, command: Command): DecisionResult {
      if (seed > 1) {
        const s = kernel.step(p.w, command, ++p.n);
        p.w = s.world;
        return s.decision;
      }
      const r = checked(kernel, p.w, command, ++p.n);
      if (r.failure)
        throw new Error(`seed ${seed} step ${p.n}: ${r.failure.id} ${r.failure.detail}`);
      p.w = r.world;
      return decode(r.bytes.slice(0, r.bytes.indexOf('\n'))) as unknown as DecisionResult;
    },
  };
  return p;
}
type Session = ReturnType<typeof session>;

// One fight: an unborn target is elapsed to a birth, one wander interval at a time; then the
// player's body joins it with the level's row and attacks.
function fight(
  start: World,
  seed: number,
  find: Find,
  row: Row | undefined,
  rounds: number,
  plan?: PopulationPlan,
): Outcome {
  const p = session(start, seed);
  let foe = find(p.w);
  for (let k = 0; !foe && k < rounds; k++) {
    p.play(ELAPSED, elapsed(p.w, plan!.wander_interval));
    foe = find(p.w);
  }
  if (!foe) return { end: 'unborn' };
  const { w } = p;
  const containers = { ...w.state.containers, [w.body]: w.state.containers[foe]! };
  const levelling = row && { levelling: { ...w.state.levelling, [w.character]: row } };
  p.w = { ...w, state: { ...w.state, containers, ...levelling } };
  const payload = { type: 'attack', actor_id: w.character, target_id: foe };
  const command = { id: id('loka-fights', String(seed), p.n + 1), world_context_id: w.context };
  const attack = p.play(KERNEL, { ...command, payload } as Command);
  if (attack.kind === 'rejected') return { end: 'refused', code: attack.error.code };
  if (attack.kind === 'fault') return { end: 'refused', code: `fault ${attack.code}` };
  return combat(p, foe, rounds);
}

// Each step delivers one combat round, until a death, the target out of the player's room (fled:
// it fled, or its pack withdrew with it), or the round cap.
function combat(p: Session, foe: EntityId, rounds: number): Outcome {
  const body = p.w.body;
  for (let r = 1; r <= rounds; r++) {
    const decision = p.play(ELAPSED, elapsed(p.w, p.w.cartridge.world!.combat!.interval));
    const events = decision.kind === 'accepted' ? decision.events : [];
    const died = events.flatMap((e) =>
      e.payload.type === 'entity_died' ? [e.payload.victim_id] : [],
    );
    if (died.includes(body)) return { end: 'death' };
    if (died.includes(foe))
      return { end: 'win', rounds: r, hp: level(p.w, body, resourceRef(p.w, 'hp'))! };
    const { containers } = p.w.state;
    if (containers[foe] !== containers[body]) return { end: 'fled' };
  }
  return { end: 'timeout' };
}

// The authority's elapsed delivery of the next `by` logical seconds.
function elapsed(w: World, by: number): Command {
  const [from, until] = [w.state.clock, w.state.clock + by];
  const payload = { type: 'elapsed', actor_id: w.character, run_id: RUN, from, until };
  const cid = elapsedCommandId(RUN, w.context, from, until);
  return { id: cid, world_context_id: w.context, payload } as Command;
}

function cell(level: number, build: string, outs: Outcome[], plan: boolean) {
  const refused = outs.find((o) => o.end === 'refused');
  if (refused) return { level, build, refused: refused.code };
  const count = (end: Outcome['end']) => outs.filter((o) => o.end === end).length;
  const won = outs.flatMap((o) => (o.end === 'win' ? [o] : []));
  const [n, wins, deaths] = [outs.length, count('win'), count('death')];
  return {
    level,
    build,
    n,
    wins,
    deaths,
    timeouts: count('timeout'),
    fleds: count('fled'),
    ...(plan && { unborn: count('unborn') }),
    win_pct: pct(wins, n),
    death_pct: pct(deaths, n),
    fled_pct: pct(count('fled'), n),
    ...(won.length && {
      rounds: spread(won.map((o) => o.rounds)),
      hp_left: spread(won.map((o) => o.hp)),
    }),
  };
}

/** `k` of `n` as a percent with two places, a decimal string as flows.ts's rates. */
export const pct = (k: number, n: number) => ((k * 100) / n).toFixed(2);
const spread = (xs: number[]) => ({
  min: Math.min(...xs),
  median: median([...xs]),
  max: Math.max(...xs),
});

if (import.meta.main) {
  const [file, ...rest] = process.argv.slice(2);
  const flag = (name: string, fallback: number) => {
    const i = rest.indexOf(name);
    return i < 0 ? fallback : Number(rest[i + 1]);
  };
  const [seeds, rounds] = [flag('--seeds', 32), flag('--rounds', 100)];
  if (!file || ![seeds, rounds].every((x) => Number.isInteger(x) && x > 0)) {
    console.error('usage: node kernel/ts/play/fight.ts <artifact> [--seeds N] [--rounds R]');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  console.log(encode(fights(loaded.cartridge as Cartridge, { seeds, rounds }) as unknown as Json));
}
