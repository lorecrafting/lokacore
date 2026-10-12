// `node kernel/ts/play/flows.ts <artifact> [--seeds N] [--days D]` (docs/system/cartridge.md#measured-flows-balance-tool-2):
// plays a purposeful player policy over many seeds and prints the coin and item flows it measured
// by source, the money supply and the living populations per game hour, as one canonical JSON
// document. A report for authors, not a check.
import { readFileSync } from 'node:fs';
import type { Command, DefinitionRef, GameView } from '../src/contracts.gen.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { decode, encode, type Json } from '../src/foundation/canonical.ts';
import { elapsedCommandId, id } from '../src/foundation/id_source.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { units } from '../src/mechanics/calendar.ts';
import { living } from '../src/mechanics/death/shared.ts';
import { refString } from '../src/runtime/decision.ts';
import { gameView, stepElapsed } from '../src/runtime/world.ts';
import { checked, gen, KERNEL, offers, type Gen, type Kernel, type Payload } from '../test/sim.ts';
import { ledger } from './ledger.ts';

// Candidates in preference order; the first the kernel accepts is played, none ends the run.
export type Policy = (
  w: World,
  view: GameView,
  g: Gen,
  visits: Record<string, number>,
) => Payload[];
type Tally = Record<string, { in?: number; out?: number }>;

const CAP = 5000; // ponytail: steps per seed, so a policy that never passes time still ends
// The worker's command types, best first; ancestry first, as nothing else is accepted before it.
const RANK = ['choose_ancestry', 'sell', 'harvest', 'choose', 'accept_quest', 'take', 'talk'];

/** The worker (cartridge.md "Measured flows"): ranked offers, the least-visited move, a wait. */
export function worker(w: World, view: GameView, g: Gen, visits: Record<string, number>) {
  const exits = w.rooms[w.state.containers[w.body]!]!.exits as Record<
    string,
    { to: DefinitionRef }
  >;
  const seen = (p: Payload) => visits[w.roomIds[refString(exits[p.direction as string]!.to)]!] ?? 0;
  const choice = view.choice;
  const own: Payload[] = [
    ...view.entities.flatMap((e) =>
      (e.shop ?? []).flatMap((s) =>
        s.sell.available
          ? [{ type: 'sell', provider_id: e.id, item_id: s.item_id, quoted_price: s.sell.price }]
          : [],
      ),
    ),
    ...(choice?.choices ?? []).flatMap((c) =>
      c.available
        ? [{ type: 'choose', choice_id: c.choice_id, continuation_id: choice!.continuation_id }]
        : [],
    ),
    ...(view.notices ?? []).flatMap((n) =>
      (n.actions ?? []).flatMap((a) =>
        a.command === 'harvest' && a.available
          ? [{ type: 'harvest', target_id: a.target_ids![0] }]
          : [],
      ),
    ),
  ];
  const all = shuffled([...offers(w, view, g), ...own], g);
  const moves = all.filter((p) => p.type === 'move' && exits[p.direction as string]);
  const { hour } = units(w.cartridge);
  return [
    ...RANK.flatMap((t) => all.filter((p) => p.type === t)),
    ...moves.sort((a, b) => seen(a) - seen(b)),
    { type: 'wait', until: (Math.floor(w.state.clock / hour) + 1) * hour },
  ];
}

function shuffled<T>(xs: T[], g: Gen): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = g.int(i + 1);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

/** Measured flows (cartridge.md "Measured flows (balance tool 2)"). */
export function flows(c: Cartridge, opts: { seeds?: number; days?: number; policy?: Policy } = {}) {
  const { seeds = 16, days = 3, policy = worker } = opts;
  const currencies = new Set(ledger(c as unknown as Obj).currencies.map((r) => r.resource));
  const coin: Tally = {};
  const items: Tally = {};
  const runs = Array.from({ length: seeds }, (_, s) =>
    run(c, s + 1, days, policy, currencies, coin, items),
  );
  const hours = Math.max(...runs.map((r) => r.samples.length));
  const at = (h: number) => runs.flatMap((r) => r.samples[h] ?? []);
  const plans = Object.keys(c.populations ?? {}).sort();
  return {
    cartridge: `${c.manifest.id}@${c.manifest.version}`,
    policy: policy.name,
    seeds,
    days,
    coin: {
      per_hour: band(runs.map((r) => r.perHour)),
      by_source: coin,
      supply: Array.from({ length: hours }, (_, hour) => ({
        hour,
        player: median(at(hour).map((x) => x.player)),
        purses: median(at(hour).map((x) => x.purses)),
      })),
    },
    items: { by_source: items },
    populations: Array.from({ length: hours }, (_, hour) => ({
      hour,
      living: Object.fromEntries(plans.map((p) => [p, median(at(hour).map((x) => x.living[p]!))])),
    })),
  };
}

// One seed's run: tallies each accepted step's coin and item moves under its label, and samples
// the world at each game hour it reaches.
function run(
  c: Cartridge,
  seed: number,
  days: number,
  policy: Policy,
  currencies: Set<string>,
  coin: Tally,
  items: Tally,
) {
  const g = gen(seed);
  const rng = [g.draw(), g.draw(), g.draw(), (g.draw() | 1) >>> 0];
  let w = newWorld(c, id('loka-flows', String(seed), 0) as World['context'], rng);
  const { hour, hours, day } = units(c);
  const [start, end] = [w.state.clock, w.state.clock + days * day];
  const visits: Record<string, number> = { [w.state.containers[w.body]!]: 1 };
  const samples = [sample(w, currencies)];
  let hourly = new Set<string>(); // the commands played this game hour, each played once
  for (let n = 1; n <= CAP && w.state.clock < end; n++) {
    const before = w;
    const fresh = policy(w, gameView(w), g, visits).filter((p) => !hourly.has(same(p)));
    const [played, after] = first(w, fresh, seed, n) ?? [];
    if (!played || !after) break;
    w = after;
    if (Math.floor(w.state.clock / hour) !== Math.floor(before.state.clock / hour))
      hourly = new Set();
    else hourly.add(same(played));
    const here = w.state.containers[w.body]!;
    if (here !== before.state.containers[before.body]) visits[here] = (visits[here] ?? 0) + 1;
    const now = tally(before, w, labelOf(before, played), currencies, coin, items);
    while (samples.length <= Math.min(Math.floor((w.state.clock - start) / hour), days * hours))
      samples.push(now);
  }
  const elapsed = (w.state.clock - start) / hour;
  const net = sample(w, currencies).player - samples[0]!.player;
  return { samples, perHour: elapsed ? net / elapsed : 0 };
}

// a command's identity within an hour: a continuation id changes with every reply
const same = (p: Payload) => JSON.stringify({ ...p, continuation_id: undefined });

// The first candidate the kernel accepts, with its world. Refused candidates take the plain
// step; the accepted one is replayed through the simulator's `checked`, so every played step keeps
// every invariant (checking each candidate was 85% of a run).
function first(w: World, candidates: Payload[], seed: number, n: number) {
  for (const p of candidates) {
    const [kernel, command] = delivered(w, p, seed, n);
    if (kernel.step(w, command, n).decision.kind !== 'accepted') continue;
    const r = checked(kernel, w, command, n);
    if (r.failure) throw new Error(`seed ${seed} step ${n}: ${r.failure.id} ${r.failure.detail}`);
    return [p, r.world] as const;
  }
  return undefined;
}

// Adds one accepted step's player coin and held-item changes to the tallies; returns the sample after.
function tally(
  was: World,
  w: World,
  label: string,
  currencies: Set<string>,
  coin: Tally,
  items: Tally,
) {
  const now = sample(w, currencies);
  add(coin, label, now.player - sample(was, currencies).player);
  const [had, has] = [held(was), held(w)];
  add(items, label, has.filter((e) => !had.includes(e)).length);
  add(items, label, -had.filter((e) => !has.includes(e)).length);
  return now;
}

const RUN = id('loka-flows', 'run', 0);
const ELAPSED: Kernel = { ...KERNEL, step: stepElapsed as Kernel['step'] };

// The kernel and command for `p`: a wait in a real-elapsed world (which refuses Wait) is the
// authority's elapsed delivery to the same time.
function delivered(w: World, p: Payload, seed: number, n: number): [Kernel, Command] {
  const [world_context_id, actor_id, from] = [w.context, w.character, w.state.clock];
  if (p.type !== 'wait' || !w.cartridge.manifest.time_policy) {
    const command = { id: id('loka-flows', String(seed), n), world_context_id };
    return [KERNEL, { ...command, payload: { actor_id, ...p } } as Command];
  }
  const until = p.until as number;
  const payload = { type: 'elapsed', actor_id, run_id: RUN, from, until };
  const cid = elapsedCommandId(RUN, w.context, from, until);
  return [ELAPSED, { id: cid, world_context_id, payload } as Command];
}

// `<payload type>:<definition key of its item or target>`, else the bare type
function labelOf(w: World, p: Payload): string {
  const t = (p.item_id ?? p.target_id) as string | undefined;
  const key = t && (w.entities[t]?.key ?? w.details[t]?.key);
  return key ? `${p.type}:${key}` : (p.type as string);
}

function add(t: Tally, label: string, delta: number) {
  if (!delta) return;
  const row = (t[label] ??= {});
  const dir = delta > 0 ? 'in' : 'out';
  row[dir] = (row[dir] ?? 0) + Math.abs(delta);
}

// the item entities directly in the player's body
const held = (w: World) =>
  Object.keys(w.state.containers).filter(
    (e) => w.state.containers[e] === w.body && w.entities[e]?.kind === 'item',
  );

// the player's and the NPC purses' coin, and each plan's living members
function sample(w: World, currencies: Set<string>) {
  let [player, purses] = [0, 0];
  for (const [k, row] of Object.entries(w.state.resources ?? {})) {
    const t = decode(k) as { entity_id: string; resource: Obj };
    if (!currencies.has(refString(t.resource as never))) continue;
    if (t.entity_id === w.body) player += row.value;
    else purses += row.value;
  }
  const alive: Record<string, number> = {};
  for (const plan of Object.keys(w.cartridge.populations ?? {})) alive[plan] = 0;
  for (const [k, row] of Object.entries(w.state.population_slots ?? {})) {
    const plan = refString((decode(k) as { plan: never }).plan);
    if (row.member_id && living(w, row.member_id)) alive[plan]! += 1;
  }
  return { player, purses, living: alive };
}

// lower medians, so every value stays an integer the canonical encoding holds
const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? 0;
// per-hour rates as decimal strings with two places, for the same reason
const band = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const fixed = (x = 0) => x.toFixed(2);
  return {
    min: fixed(s[0]),
    median: fixed(s[Math.floor((s.length - 1) / 2)]),
    max: fixed(s.at(-1)),
  };
};

if (import.meta.main) {
  const [file, ...rest] = process.argv.slice(2);
  const flag = (name: string, fallback: number) => {
    const i = rest.indexOf(name);
    return i < 0 ? fallback : Number(rest[i + 1]);
  };
  const [seeds, days] = [flag('--seeds', 16), flag('--days', 3)];
  if (!file || ![seeds, days].every((x) => Number.isInteger(x) && x > 0)) {
    console.error('usage: node kernel/ts/play/flows.ts <artifact> [--seeds N] [--days D]');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  console.log(encode(flows(loaded.cartridge as Cartridge, { seeds, days }) as unknown as Json));
}
