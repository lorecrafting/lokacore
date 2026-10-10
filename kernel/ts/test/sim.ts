// size: allow 540, the existing headless action generator also consumes exact service offers
// Deterministic simulation (docs/ROADMAP.md, verification harness; r1-acceptance-envelope §3):
// a seed picks a v2 demo cartridge (its known-answer artifact, through the loader), a start
// world and 1 to 64 commands, generated against the world as it goes: mostly what the GameView
// offers, some it does not (unknown and unowned types, wrong and stale ids, foreign actors and
// worlds, the nil CommandId), wait to time boundaries, and repeats. Each step must return a
// DecisionResult, never throw, keep every registered invariant that applies (CHECKED) and, when
// accepted, adopt exactly what its delta composes to; its canonical decision and state hash feed
// the sequence digest. A failure is shrunk by greedy step deletion and reported with its seed,
// the generator version, the command that reproduces it and a `loka play` playback.
//   node kernel/ts/test/sim.ts [--cartridge <artifact>] <seed>...   prints each seed's
//   cartridge, digest and failure, if any
import { createHash } from 'node:crypto';
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encode, hash } from '../src/foundation/canonical.ts';
import { compose, key, same } from '../src/foundation/compose.ts';
import type { Command, DecisionResult, Key } from '../src/contracts.gen.ts';
import { id } from '../src/foundation/id_source.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { check } from '../src/runtime/invariants.ts';
import { resolved } from '../src/commands/actions.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
import { MOVES } from '../src/mechanics/barrier/rule.ts';
import { next, type RngState } from '../src/foundation/rng.ts';
import { utf8 } from '../src/foundation/sha256.ts';
import { resolve } from '../src/commands/target.ts';
import { gameView, holds, row, step } from '../src/runtime/world.ts';
import { base } from '../src/runtime/apply.ts';
import { append, kernelVersion, line, ROOT } from '../play/obs.ts';
import { decide } from '../play/run.ts';
import { read } from './read.ts';

/**
 * Bump when a seed would generate a different sequence, a new demo cartridge known answer
 * included (begin picks among them by seed); sim_seeds.json records it.
 */
export const GENERATOR = 17;
/** Each registered invariant's world/observation check or reason for host-only proof. */
export const CHECKED = {
  world: [
    'player_in_one_room',
    'exits_resolve',
    'facts_typed',
    'one_container_per_item',
    'containment_acyclic',
  ],
  step: [
    'one_container_per_item',
    'containment_acyclic',
    'no_last_writer_wins',
    'delta_preconditions_hold',
    'liquid_rows_valid',
    'patrol_transitions_hold',
    'fault_discards_whole_proposal',
    'fault_codes_are_evaluation_faults',
    'target_candidates_ordered',
    'rejection_consumes_nothing',
    'unknown_types_fail_closed',
    'gameview_agrees_with_admission',
    'job_complete_owned_by_run',
  ],
  none: {
    no_proposed_event_escapes: 'publication after a host commit: R6 authority',
    command_id_ignores_placement: 'authority placement: R6 host',
    retry_replays_receipt: 'receipts: R6 host',
    idempotency_payload_conflict: 'receipts: R6 host',
  },
};

export type Kernel = { step: typeof step; gameView: typeof gameView };
export const KERNEL: Kernel = { step, gameView };

// `path`: the `--cartridge` artifact the reproduce line names; fixture cartridges have none.
type Loaded = { cartridge: Cartridge; hash: string; artifact: string; path?: string };
export const CARTRIDGES: Loaded[] = globSync('protocol/fixtures/cartridge_*hash.json', {
  cwd: ROOT,
})
  .sort()
  .map((path) =>
    read(path.replace(/cartridge_(items|locks|sampler)_hash/, 'containers_cartridge_$1_hash')),
  )
  .filter((k) => k.value.format === 'loka-cartridge-v2')
  .map((k) =>
    loaded(`{"cartridge":${k.canonical},"content_hash":"${k.sha256}"}`, k.value.manifest.id),
  );

/** A cartridge from its artifact bytes (a fixture's, or `mix loka.compile` output). */
export function loaded(artifact: string, name = 'cartridge'): Loaded {
  const r = loadCartridge(utf8(artifact), INSTALLED);
  if (!r.ok) throw new Error(`${name} refused: ${encode(r.diagnostic as never)}`);
  return { cartridge: r.cartridge as Cartridge, hash: r.hash, artifact };
}

// The generator's own stream: the kernel's xoshiro128** over a state of its own (the seed's
// SHA-256), never a world's.
type Gen = { draw: () => number; int: (n: number) => number; pick: <T>(xs: readonly T[]) => T };
function gen(seed: number): Gen {
  const b = createHash('sha256').update(`${SIM} ${seed}`).digest();
  let s: RngState = [0, 4, 8, 12].map((i) => b.readUInt32LE(i));
  const draw = () => {
    const [x, t] = next(s);
    s = t;
    return x;
  };
  const int = (n: number) => draw() % n;
  return { draw, int, pick: (xs) => xs[int(xs.length)] };
}

/** A sequence: its seed, cartridge, start world and commands. */
export type Sequence = {
  seed: number;
  loaded: Loaded;
  start: World;
  drained?: string; // the pools of a drained start
  commands: Command[];
};
export type Failure = { id: string; detail: string; at: number };
export type Outcome = Sequence & { digest: string; codes: string[]; failure?: Failure };

const SIM = 'loka-sim';
const NIL = '00000000-0000-0000-0000-000000000000';
const STALE = id(SIM, 'stale', 0); // an id no world of this run mints

// One start in four drains the body's pools to a boundary (its minimum, one above, or 10, the
// largest cost), as spending could leave them. Legacy starts retain time 0; opted starts keep
// their valid birth metadata. ponytail: authored through state since 82 moves do not fit in
// 64 steps; such a start has no `loka play` transcript (play starts fresh).
function begin(seed: number, g: Gen, cartridges: Loaded[]) {
  const loaded = g.pick(cartridges);
  const rng = [g.draw(), g.draw(), g.draw(), (g.draw() | 1) >>> 0];
  const world = newWorld(loaded.cartridge, id(SIM, String(seed), 0) as World['context'], rng);
  if (g.int(4)) return { loaded, start: world };
  const rows = Object.values(loaded.cartridge.resources ?? {}).map((spec) => {
    const resource = resourceRef(world, spec.key);
    const pick = g.pick([spec.minimum, spec.minimum + 1, 10]);
    const value = Math.max(spec.minimum, Math.min(pick, spec.maximum)); // within the bounds
    const target = key({ kind: 'resource', resource, entity_id: world.body });
    const row = spec.regen ? { ...world.state.resources![target]!, value } : { value, at: 0 };
    return [target, row, spec.key] as const;
  });
  const state = {
    ...world.state,
    resources: { ...world.state.resources, ...Object.fromEntries(rows) },
  };
  const drained = rows.map(([, { value }, k]) => `${k} ${value}`).join(', ');
  return { loaded, start: { ...world, state }, drained };
}

/** Generates and checks seed's sequence, stopping at its first failure. */
export function simulate(seed: number, kernel = KERNEL, cartridges = CARTRIDGES): Outcome {
  const g = gen(seed);
  const s: Sequence = { seed, ...begin(seed, g, cartridges), commands: [] };
  const length = 1 + g.int(64);
  const digest = createHash('sha256');
  const codes: string[] = [];
  let world = s.start;
  for (let n = 0; n < length; n++) {
    const cid = id(SIM, String(seed), n + 2) as Command['id'];
    s.commands.push(generate(world, g, s.commands.at(-1), cid));
    const r = checked(kernel, world, s.commands[n]!, n + 1);
    if (r.failure) return { ...s, digest: '', codes, failure: { ...r.failure, at: n } };
    digest.update(r.bytes);
    codes.push(r.code);
    world = r.world;
  }
  return { ...s, digest: digest.digest('hex'), codes };
}

/** The first failure of `commands` from `start`, if any. */
export function replay(start: World, commands: readonly Command[], kernel = KERNEL) {
  let world = start;
  for (const [at, c] of commands.entries()) {
    const r = checked(kernel, world, c, at + 1);
    if (r.failure) return { ...r.failure, at };
    world = r.world;
  }
}

/** Greedy step deletion to a fixpoint, keeping the failure's id. ponytail: no argument */
/** simplification or delta debugging; add them when shrunk sequences stay long. */
export function shrink(s: Sequence, failed: string, kernel = KERNEL): Command[] {
  let commands = s.commands;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = commands.length - 1; i >= 0; i--) {
      const fewer = commands.filter((_, j) => j !== i);
      if (replay(s.start, fewer, kernel)?.id === failed) [commands, changed] = [fewer, true];
    }
  }
  return commands;
}

type Checked = { world: World; bytes: string; code: string; failure?: Omit<Failure, 'at'> };

// One step through `kernel` as commit `revision`: a throw or broken invariant fails, never crashes.
export function checked(
  kernel: Kernel,
  before: World,
  command: Command,
  revision: number,
  action?: Key,
): Checked {
  try {
    const input = JSON.stringify(before);
    const view = kernel.gameView(before);
    const { decision, world } = kernel.step(before, command, revision, action);
    const bad =
      (JSON.stringify(before) !== input ? 'input_mutated' : undefined) ??
      violated(before, command, view, decision, world) ??
      (decision.kind === 'accepted' && !adopted(before, decision, world, revision)
        ? 'adopt_mismatch'
        : undefined);
    const code = decision.kind === 'accepted' ? 'accepted' : kindCode(decision);
    const bytes = `${encode(decision as never)}\n${hash(world.state as never)}\n`;
    return { world, bytes, code, ...(bad && { failure: { id: bad, detail: code } }) };
  } catch (e) {
    return { world: before, bytes: '', code: 'threw', failure: { id: 'threw', detail: String(e) } };
  }
}

const kindCode = (d: Exclude<DecisionResult, { kind: 'accepted' }>) =>
  d.kind === 'rejected' ? d.error.code : `fault ${d.code}`;

export { base };

// The first registered invariant the step breaks.
function violated(
  before: World,
  command: Command,
  view: unknown,
  decision: DecisionResult,
  after: World,
) {
  const state = base(before);
  const ok = decision.kind === 'accepted';
  const delta = ok ? decision.delta : { ops: [] };
  const result = ok
    ? compose(state as never, delta)
    : decision.kind === 'fault'
      ? { fault: decision }
      : { changes: [] };
  const obs = {
    state,
    delta,
    result,
    before: before.state,
    after: after.state,
    command,
    decision,
    view,
    world_context_id: before.context,
    resolves: Object.fromEntries(
      Object.values(resolved(before, before.character)).map((a) => [a.key, a.command]),
    ),
  };
  const ids = CHECKED.step.filter((i) => i !== 'target_candidates_ordered');
  return (
    CHECKED.world.find((i) => !holds(i, after)) ??
    ids.find((i) => !check(i, obs)) ??
    (shared(after).some(
      (w) =>
        !check('target_candidates_ordered', { resolution: resolve(after, after.character, w) }),
    )
      ? 'target_candidates_ordered'
      : undefined)
  );
}

// An accepted step's State is the State before with its delta's composed changes and its rng,
// and nothing else (runtime/proposal.ts adopt); a delta that does not compose is never accepted. A simulator
// failure (adopt_mismatch), not a registered invariant.
function adopted(before: World, decision: Accepted, after: World, revision: number): boolean {
  const result = compose(base(before) as never, decision.delta);
  if ('fault' in result) return false;
  const want: Record<string, unknown> = { ...before.state, rng: decision.rng };
  for (const { target, value } of result.changes) {
    if (target.kind === 'clock') want.clock = value;
    const at = row(target);
    if (at) {
      const rows = { ...(want[at[0]] as Record<string, unknown>) };
      if (target.kind === 'quest' && value === null) delete rows[at[1]];
      else rows[at[1]] = value;
      want[at[0]] = rows;
    }
  }
  // A continuation opened here carries the revision its commit takes (runtime/proposal.ts adopt).
  for (const o of decision.delta.ops)
    if (o.op === 'choice.open') {
      const choices = want.choices as Record<string, object>;
      choices[o.continuation_id] = { ...choices[o.continuation_id], opened_revision: revision };
    }
  return same(want, after.state);
}
type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;

// Words two or more things of the world answer to, so a lookup can be ambiguous.
function shared(world: World): string[] {
  const words = [
    ...Object.values(world.entities).flatMap((e) => e.keywords),
    ...Object.values(world.details).flatMap((d) => d.aliases),
  ] as string[];
  return [...new Set(words.filter((w, i) => words.indexOf(w) !== i))];
}

type Payload = Record<string, unknown>;

// The next command: 6 in 10 offered by the GameView, 2 stray, 1 a wait to a boundary, 1 a repeat.
function generate(world: World, g: Gen, prev: Command | undefined, cid: Command['id']): Command {
  const own = { id: cid, world_context_id: world.context };
  const as = (payload: Payload) =>
    ({ ...own, payload: { actor_id: world.character, ...payload } }) as Command;
  const k = g.int(10);
  if (k === 9 && prev) return { ...prev, id: cid };
  if (k === 8) return as({ type: 'wait', until: g.pick(boundaries(world)) });
  if (k >= 6) return stray(world, g, own, as);
  return as(offered(world, g));
}

// A command the GameView offers, available or not: each place action (a recipe's perform, a
// quest offer's accept_quest, a direction verb through each exit, wait to a boundary), each door
// verb of the set through each exit (the GameView lists only the accepted ones, on their exits),
// and on each item in the room, held or inside one (c1-locks; listed only where accepted, on the
// item), each wear and remove of the set on each held and worn item (likewise), each action on a
// listed entity or an item inside one, and look at each detail of the room.
function offered(world: World, g: Gen): Payload {
  const view = gameView(world);
  if (view.ancestry_choices?.length)
    return { type: 'choose_ancestry', ancestry: g.pick(view.ancestry_choices).key };
  const set = resolved(world, world.character);
  const here = world.state.containers[world.body]!;
  const exits = Object.keys(world.rooms[here]!.exits);
  const npcs = view.entities.filter((e) => e.kind === 'npc').map((e) => e.id);
  const options: Payload[] = view.actions.flatMap((a): Payload[] => {
    const o = set[a.action_key]!;
    if (o.recipe) return [{ type: 'perform', action: o.key }];
    if (o.quest) return [{ type: o.command, quest: o.quest }];
    if (o.input.includes('direction'))
      return exits.map((direction) => ({ type: o.command, direction }));
    if (o.input.includes('until')) return [{ type: 'wait', until: g.pick(boundaries(world)) }];
    return [{ type: o.command }];
  });
  for (const n of view.notices ?? [])
    for (const a of n.actions ?? [])
      if (set[a.action_key]?.command === 'fill' && a.target_ids?.length === 2)
        options.push(aimed('fill', a.target_ids[0], a.target_ids[1]));
  for (const e of view.entities)
    for (const s of e.services ?? [])
      options.push({
        type: 'use_service',
        provider_id: e.id,
        service: s.service,
        quoted_price: s.price,
      });
  const inside = [...view.entities, ...view.inventory].flatMap((e) => e.contents ?? []);
  const items = [...view.entities, ...view.inventory, ...inside].filter((e) => e.kind === 'item');
  for (const o of Object.values(set))
    if (Object.hasOwn(MOVES, o.command))
      options.push(
        ...exits.map((direction) => ({ type: o.command, direction })),
        ...items.map((e) => aimed(o.command, e.id, STALE)),
      );
  const worn = (view.equipment ?? []).flatMap((slot) => (slot.item ? [slot.item] : []));
  for (const o of Object.values(set))
    if (o.command === 'wear' || o.command === 'remove')
      options.push(...[...view.inventory, ...worn].map((e) => aimed(o.command, e.id, STALE)));
  for (const e of [...view.entities, ...view.inventory, ...worn, ...inside])
    for (const a of e.actions)
      options.push(
        aimed(
          set[a.action_key]!.command,
          a.target_ids?.[0] ?? e.id,
          a.target_ids?.[1] ?? g.pick([...npcs, STALE]),
        ),
      );
  for (const [d, detail] of Object.entries(world.details))
    if (detail.room === here) options.push({ type: 'look', target_id: d });
  return options.length ? g.pick(options) : { type: 'look' };
}

// A command of `type` at entity `id`, by its payload's field; give's recipient `to`.
const aimed = (type: string, id: string, to: string): Payload =>
  type === 'fill'
    ? { type, source_id: id, vessel_id: to }
    : type === 'pour'
      ? { type, source_id: id, receiver_id: to }
      : type === 'drink'
        ? { type, vessel_id: id }
        : type === 'look' || type === 'talk' || Object.hasOwn(MOVES, type)
          ? { type, target_id: id }
          : {
              type,
              item_id: id,
              ...(type === 'give' && { recipient_id: to }),
              ...(type === 'put' && { container_id: to }),
            };

const UNKNOWN = ['dance', 'constructor', '__proto__', 'toString', 'hasOwnProperty'];
const DIRECTIONS = ['north', 'south', 'east', 'west', 'up', 'down', 'sideways', 'constructor'];

// A command the GameView does not offer.
function stray(world: World, g: Gen, own: Payload, as: (p: Payload) => Command): Command {
  const ids = [
    ...Object.keys(world.entities),
    ...Object.keys(world.details),
    ...Object.values(world.roomIds),
    world.body,
    world.character,
    STALE,
    'constructor',
  ];
  const recipes = Object.values(world.cartridge.recipes ?? {}).map((r) => r.key);
  const ref = { cartridge_id: 'x', cartridge_version: '0.0.1', kind: 'quest', key: 'q' };
  const cases: (() => Command)[] = [
    () => as({ type: g.pick(UNKNOWN) }),
    () => as(aimed(g.pick(['take', 'drop', 'give', 'look', 'talk']), g.pick(ids), g.pick(ids))),
    () =>
      as({
        type: g.pick(['move', 'open', 'close', 'lock', 'unlock']),
        direction: g.pick(DIRECTIONS),
      }),
    () =>
      as({
        type: 'perform',
        action: g.pick([...recipes, 'nope', 'constructor']),
        target_id: g.pick(ids),
      }),
    () =>
      as(
        g.pick([
          { type: 'accept_quest', quest: ref },
          { type: 'close_choice', continuation_id: STALE },
        ]),
      ),
    () => as({ type: 'choose', choice_id: 'yes', continuation_id: STALE }),
    () => ({ ...own, payload: { type: 'run_job', job_id: STALE } }) as Command,
    () =>
      ({
        ...as(offered(world, g)),
        payload: { ...offered(world, g), actor_id: g.pick([world.body, STALE]) },
      }) as Command,
    () => ({ ...as(offered(world, g)), world_context_id: STALE }) as Command,
    () => ({ ...as(offered(world, g)), id: NIL }) as Command,
  ];
  return g.pick(cases)();
}

const [HOUR, DAY, MAX] = [3600, 86400, Number.MAX_SAFE_INTEGER];

// wait targets: the next second, hour and day boundaries (and a second before the hour), now
// and a second ago (refused), next to 2^53, and each running cooldown's end and a second before.
function boundaries(world: World): number[] {
  const c = world.state.clock;
  const up = (m: number) => Math.ceil((c + 1) / m) * m;
  const ends = Object.values(world.cartridge.recipes ?? {}).flatMap((r) =>
    Object.values(world.state.cooldowns ?? {}).flatMap((at) =>
      r.cooldown ? [at + r.cooldown - 1, at + r.cooldown] : [],
    ),
  );
  return [c + 1, up(HOUR), up(HOUR) - 1, up(DAY), c, c - 1, MAX - 1, MAX, ...ends].filter(
    (t) => Number.isSafeInteger(t) && t >= 0,
  );
}

/** The failure report: seed, generator, the reproducer, shrunk commands and, for a fresh */
/** start, a playback. */
export function report(o: Outcome, kernel = KERNEL): string {
  const f = o.failure!;
  const flags = o.loaded.path ? `--cartridge ${JSON.stringify(o.loaded.path)} ` : '';
  const commands = shrink(o, f.id, kernel);
  const name = o.loaded.cartridge.manifest.id;
  const head = `simulation failure: ${f.id} (${f.detail}) at step ${f.at + 1}\ngenerator ${GENERATOR}, seed ${o.seed}, cartridge ${name}, ${o.drained ? `drained start: ${o.drained}` : 'fresh start'}\nreproduce (re-checks every invariant): node kernel/ts/test/sim.ts ${flags}${o.seed}\n`;
  const body = `shrunk from ${o.commands.length} to ${commands.length} commands:\n${commands.map((c) => `${encode(c as never)}\n`).join('')}`;
  const none = 'no playback: `loka play` starts fresh, not drained; use the reproduce command\n';
  return head + body + (o.drained ? none : transcript(o, commands));
}

// The shrunk commands as a game_trace `loka play --replay` re-decides on the real kernel: a
// playback, not a reproducer (no invariant is checked, and a stray command ends it).
function transcript(o: Outcome, commands: readonly Command[]): string {
  const run_id = id(SIM, String(o.seed), 1);
  const r = {
    ids: {
      content_hash: o.loaded.hash,
      kernel_version: kernelVersion(),
      seed: o.start.state.rng,
      run_id,
    },
    world: o.start,
    ordinal: 0,
    revision: 0,
  };
  const data = {
    world_context_id: o.start.context,
    initial_state: { state: 'fresh' },
    fault_schedule: { state: 'unavailable', reason: 'not_applicable' },
  };
  let text = line({
    format: 'loka-obs-v1',
    event: 'trace.run',
    store: 'game_trace',
    ids: r.ids,
    data,
  });
  let stop = '';
  try {
    for (const c of commands) text += line(decide(r, c).trace);
  } catch (e) {
    stop = `(the transcript stops at command ${r.ordinal + 1}: ${e})\n`;
  }
  const artifact = `tmp/sim/${o.loaded.cartridge.manifest.id}.json`;
  mkdirSync(`${ROOT}tmp/sim`, { recursive: true });
  writeFileSync(ROOT + artifact, o.loaded.artifact);
  const trace = append('game_trace', `sim-${o.seed}`, text, 'w');
  const label = 'playback (re-decides; checks no invariant; ends at the first stray command)';
  return `${stop}${label}: node kernel/ts/play/main.ts ${artifact} --replay ${trace}\n`;
}

// `--cartridge <artifact>`: every seed runs on that compiled cartridge (a toolbox sampler,
// docs/MECHANICS-TOOLBOX.md) instead of a seed-picked fixture cartridge.
if (import.meta.main) {
  const args = process.argv.slice(2);
  const only = args[0] === '--cartridge';
  if (only && !args[1]) {
    console.error('usage: node kernel/ts/test/sim.ts [--cartridge <artifact>] <seed>...');
    process.exit(2);
  }
  const cartridges = only
    ? [{ ...loaded(readFileSync(args[1]!, 'utf8')), path: args[1] }]
    : CARTRIDGES;
  for (const seed of args.slice(only ? 2 : 0).map(Number)) {
    const o = simulate(seed, KERNEL, cartridges);
    process.stdout.write(
      o.failure ? report(o) : `${seed} ${o.loaded.cartridge.manifest.id} ${o.digest}\n`,
    );
  }
}
