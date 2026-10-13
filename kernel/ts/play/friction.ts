// `node kernel/ts/play/friction.ts <artifact> [--seeds N] [--days D]`
// (docs/system/cartridge.md#refusal-and-friction-report-balance-tool-8): plays measured flows' run
// and prints which commands it was refused, where and why, where the GameView offered what
// admission refused, and how much the walk backtracked, as one canonical JSON document. A report
// for authors, not a check.
import { readFileSync } from 'node:fs';
import { resolved } from '../src/commands/actions.ts';
import type { DecisionResult, GameView } from '../src/contracts.gen.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { gameView } from '../src/runtime/world.ts';
import { gameview_agrees_with_admission } from '../src/view/invariants_view.ts';
import type { Payload } from '../test/sim.ts';
import { flows, median, worker, type Observe, type Policy } from './flows.ts';

type Counts = Record<string, number>;
type Drift = { seed: number; step: number; room: string; command: string; code: string };

const count = (t: Counts, k: string) => (t[k] = (t[k] ?? 0) + 1);
const roomOf = (w: World) => w.rooms[w.state.containers[w.body]!]!.key as string;
const facts = (w: World) => (w.state.facts ?? {}) as Record<string, unknown>;

// The running tallies; `left` is the room left on the run's previous room change.
const blank = () => ({
  ...{ commands: 0, refused: 0, moves: 0, backtracks: 0, seed: 0, lastFact: 0 },
  ...{ by_code: {} as Counts, by_room: {} as Counts, by_command: {} as Counts },
  ...{ revisits: {} as Counts, drift: [] as Drift[], gaps: [] as number[] },
  left: undefined as string | undefined,
  entered: new Set<string>(), // the rooms this seed's run has entered
});
type T = ReturnType<typeof blank>;
type At = Parameters<Observe>[3];

/** The tallies one or more runs feed through `observe`; `report()` reads them. */
export function tally() {
  const t = blank();
  const observe: Observe = (before, p, { decision, world }, at) => {
    const room = roomOf(before);
    if (at.seed !== t.seed) {
      [t.seed, t.lastFact, t.left, t.entered] = [at.seed, 0, undefined, new Set([room])];
    }
    t.commands++;
    if (decision.kind === 'accepted') walk(t, before, world, at.step);
    else refusal(t, before, p, decision, at);
  };
  const report = () => ({
    commands: t.commands,
    refused: t.refused,
    per_100: (t.commands ? (t.refused * 100) / t.commands : 0).toFixed(2),
    ...{ by_code: t.by_code, by_room: t.by_room, by_command: t.by_command },
    drift: { count: t.drift.length, first: t.drift.slice(0, 5) },
    revisits: t.revisits,
    ...{ moves: t.moves, backtracks: t.backtracks },
    new_facts: {
      count: t.gaps.length,
      median_steps_between: t.gaps.length ? median(t.gaps) : null,
    },
  });
  return { observe, report };
}

// A refused candidate: counted by code, room and command, and checked against the view.
type Refused = Exclude<DecisionResult, { kind: 'accepted' }>;
function refusal(t: T, before: World, p: Payload, decision: Refused, at: At) {
  const code = decision.kind === 'rejected' ? decision.error.code : `fault ${decision.code}`;
  const command = p.type === 'perform' ? `perform:${p.action as string}` : (p.type as string);
  const room = roomOf(before);
  t.refused++;
  count(t.by_code, code);
  count(t.by_room, room);
  count(t.by_command, command);
  if (!agrees(before, at.command, decision))
    t.drift.push({ seed: at.seed, step: at.step, room, command, code });
}

// An accepted step: a room change (and whether it returns to the room left), and a new fact.
function walk(t: T, before: World, after: World, step: number) {
  const [from, to] = [roomOf(before), roomOf(after)];
  if (to !== from) {
    t.moves++;
    if (to === t.left) t.backtracks++;
    t.left = from;
    if (t.entered.has(to)) count(t.revisits, to);
    t.entered.add(to);
  }
  const [was, now] = [facts(before), facts(after)];
  const changed = Object.entries(now).some(
    ([k, v]) => !Object.hasOwn(was, k) || JSON.stringify(v) !== JSON.stringify(was[k]),
  );
  if (changed) {
    t.gaps.push(step - t.lastFact);
    t.lastFact = step;
  }
}

// The view invariant on a refused step, with the actor's resolved actions as the simulator builds
// them; built once per world, as a step's refused candidates share it.
const seen = new WeakMap<World, { view: GameView; resolves: Record<string, string> }>();
function agrees(before: World, command: At['command'], decision: DecisionResult) {
  let obs = seen.get(before);
  if (!obs) {
    const actions = Object.values(resolved(before, before.character));
    obs = {
      view: gameView(before),
      resolves: Object.fromEntries(actions.map((a) => [a.key, a.command])),
    };
    seen.set(before, obs);
  }
  return gameview_agrees_with_admission({ ...obs, command, decision });
}

/** The refusal and friction report (cartridge.md "Refusal and friction report (balance tool 8)"). */
export function friction(
  c: Cartridge,
  opts: { seeds?: number; days?: number; policy?: Policy } = {},
) {
  const { seeds = 16, days = 3, policy = worker } = opts;
  const t = tally();
  flows(c, { seeds, days, policy, observe: t.observe });
  const cartridge = `${c.manifest.id}@${c.manifest.version}`;
  return { cartridge, policy: policy.name, seeds, days, ...t.report() };
}

if (import.meta.main) {
  const [file, ...rest] = process.argv.slice(2);
  const flag = (name: string, fallback: number) => {
    const i = rest.indexOf(name);
    return i < 0 ? fallback : Number(rest[i + 1]);
  };
  const [seeds, days] = [flag('--seeds', 16), flag('--days', 3)];
  if (!file || ![seeds, days].every((x) => Number.isInteger(x) && x > 0)) {
    console.error('usage: node kernel/ts/play/friction.ts <artifact> [--seeds N] [--days D]');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  console.log(encode(friction(loaded.cartridge as Cartridge, { seeds, days }) as unknown as Json));
}
