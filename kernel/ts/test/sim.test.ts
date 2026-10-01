// The deterministic simulation (test/sim.ts; docs/ROADMAP.md verification harness;
// r1-acceptance-envelope §3): the committed regression seeds, then 10,000 fresh sequences,
// each step keeping every registered invariant; determinism in and across processes; and red
// controls, each a kernel planted in this process that the simulator must catch and shrink.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type { AdvertisedAction, Command, DecisionResult } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { gameView, step } from '../src/world.ts';
import { check } from '../src/invariants.ts';
import { CHECKED, GENERATOR, KERNEL, report, shrink, simulate, type Kernel } from './sim.ts';
import { read } from './read.ts';

const SEEDS: { generator: number; seeds: { seed: number; type: string }[] } = read(
  'kernel/ts/test/sim_seeds.json',
);
const seeds = SEEDS.seeds.map((s) => s.seed);
const FRESH = 10_000;
// Outcomes the demo cartridges give; the generator must reach each one (a new one may join).
const REACHED = [
  'accepted',
  'cooldown',
  'exit_closed',
  'exit_locked',
  'fault budget_exceeded',
  'fault evaluator_error',
  'insufficient_resource',
  'invalid_state',
  'invalid_target',
  'not_found',
  'not_owned',
  'not_present',
  'permission_denied',
  'unsupported_capability',
];
// Each v2 demo cartridge, and the unregistered command types (Object prototype keys among them,
// the bug class of the regression seeds): each must turn up in the fresh sequences.
const PICKED = [
  'bell',
  'details',
  'dusk',
  'errand',
  'facts',
  'ferry',
  'gate',
  'green',
  'items',
  'road',
  'rooms',
].map((c) => `ashmere_${c}`);
const UNKNOWN = ['dance', 'constructor', '__proto__', 'toString', 'hasOwnProperty'];

// Breaks: SHOWN's inherited constructor is treated as a list of view refusal codes.
test('an unknown constructor action is safe to compare with admission', () => {
  const view = {
    exits: [],
    entities: [],
    inventory: [],
    actions: [{ action_key: 'constructor', available: true }],
  };
  const command = { payload: { type: 'constructor' } };
  const decision = { kind: 'rejected', error: { code: 'invalid_state' } };
  assert.equal(check('gameview_agrees_with_admission', { view, command, decision }), true);
});

// Breaks: an invariant registered with no per-step check and no stated reason.
test('every registered invariant is checked per step, or says why not', () => {
  const ids = read('protocol/invariants.json').map((i: { id: string }) => i.id);
  const covered = new Set([...CHECKED.world, ...CHECKED.step, ...Object.keys(CHECKED.none)]);
  assert.deepEqual([...covered].sort(), ids.sort());
});

// Breaks: any kernel change that throws out of step or breaks a registered invariant on a
// generated sequence; a generator that stops reaching a refusal code, a cartridge or an
// unregistered command type.
test(`the regression seeds, then ${FRESH} fresh sequences, keep every invariant`, (t) => {
  assert.equal(SEEDS.generator, GENERATOR, 'sim_seeds.json is of another generator: re-curate it');
  const first = Date.now(); // the fresh seeds, printed so a failure can be rerun
  const lengths = Array<number>(8).fill(0);
  const [codes, seen] = [new Set<string>(), new Set<string>()]; // outcomes; cartridges, types
  let steps = 0;
  for (const seed of [...seeds, ...Array.from({ length: FRESH }, (_, i) => first + i)]) {
    const o = simulate(seed);
    if (o.failure) assert.fail(report(o));
    lengths[(o.commands.length - 1) >> 3]! += 1;
    steps += o.commands.length;
    for (const c of o.codes) codes.add(c);
    seen.add(o.loaded.cartridge.manifest.id);
    for (const c of o.commands) seen.add(c.payload.type);
  }
  t.diagnostic(
    `generator ${GENERATOR}; regression seeds ${seeds.join(' ')}; fresh seeds ${first} to ` +
      `${first + FRESH - 1}; ${seeds.length + FRESH} sequences, ${steps} steps; lengths 1-8, 9-16, ... 57-64: ` +
      `${lengths.join(' ')}; outcomes ${[...codes].sort().join(', ')}`,
  );
  const missing = [...PICKED, ...UNKNOWN].filter((x) => !seen.has(x));
  assert.deepEqual([...REACHED.filter((c) => !codes.has(c)), ...missing], [], 'never reached');
});

// Breaks: a generator change after which a regression seed no longer issues the command type it
// was kept for, so it stops guarding that bug.
test('each regression seed still issues the command type it was kept for', () => {
  for (const { seed, type } of SEEDS.seeds)
    assert.ok(
      simulate(seed).commands.some((c) => c.payload.type === type),
      `seed ${seed}: ${type}`,
    );
});

// Breaks: anything nondeterministic in the kernel or the generator (time, Math.random, host
// iteration order), which would make a failing seed unreproducible.
test('a seed gives byte-identical steps twice in one process and in another process', () => {
  const digests = seeds.map((s) => simulate(s).digest);
  assert.deepEqual(
    seeds.map((s) => simulate(s).digest),
    digests,
  );
  const r = spawnSync('node', [new URL('sim.ts', import.meta.url).pathname, ...seeds.map(String)], {
    encoding: 'utf8',
  });
  assert.equal(r.stdout, seeds.map((s, i) => `${s} ${digests[i]}\n`).join(''), r.stderr);
});

const planted = (k: Partial<Kernel>): Kernel => ({ ...KERNEL, ...k });

// The first of seeds 1, 2, ... whose sequence fails on `kernel`, shrunk and reported.
function caught(kernel: Kernel) {
  for (let seed = 1; seed <= 2000; seed++) {
    const o = simulate(seed, kernel);
    if (o.failure)
      return { ...o.failure, shrunk: shrink(o, o.failure.id, kernel), text: report(o, kernel) };
  }
  assert.fail('the planted bug was never found');
}
const types = (cs: Command[]) => cs.map((c) => c.payload.type);

test('red control: a planted rule bug (drop puts the item inside itself) is found and shrunk', () => {
  const f = caught(
    planted({
      step: (w, c) => {
        const s = step(w, c);
        if (c.payload.type !== 'drop' || s.decision.kind !== 'accepted') return s;
        const containers = { ...s.world.state.containers, [c.payload.item_id]: c.payload.item_id };
        return { ...s, world: { ...s.world, state: { ...s.world.state, containers } } };
      },
    }),
  );
  assert.equal(f.id, 'containment_acyclic');
  // move, take, drop; a drained start may need a wait first (which seed finds it depends on the
  // demo cartridges).
  assert.ok(f.shrunk.length <= 4 && types(f.shrunk).at(-1) === 'drop', f.text);
  assert.match(
    f.text,
    /^simulation failure: containment_acyclic .*\ngenerator 5, seed (\d+).*\nreproduce .*: node kernel\/ts\/test\/sim.ts \1\n/,
  );
  assert.match(f.text, /shrunk from \d+ to [1-4] commands:\n/);
});

// Breaks: job_complete_owned_by_run not checked per step, or blind to a job.complete in the
// command's own writer group (a rule completing a job instead of the job's run_job).
test('red control: a job completed in the root writer group trips job_complete_owned_by_run', () => {
  const f = caught(
    planted({
      step: (w, c) => {
        const s = step(w, c);
        if (s.decision.kind !== 'accepted') return s;
        const ops = s.decision.delta.ops.map((o) => ({ ...o, writer_group: 0 }));
        return { ...s, decision: { ...s.decision, delta: { ops } } };
      },
    }),
  );
  assert.equal(f.id, 'job_complete_owned_by_run');
  assert.match(f.text, /cartridge ashmere_green/);
});

test('red control: a rejection that moves the clock trips rejection_consumes_nothing', () => {
  const f = caught(
    planted({
      step: (w, c) => {
        const s = step(w, c);
        if (s.decision.kind !== 'rejected') return s;
        return { ...s, world: { ...w, state: { ...w.state, clock: w.state.clock + 1 } } };
      },
    }),
  );
  assert.equal(f.id, 'rejection_consumes_nothing');
  assert.equal(f.shrunk.length, 1, f.text);
});

test('red control: an unknown command type accepted trips unknown_types_fail_closed', () => {
  const f = caught(
    planted({
      step: (w, c) =>
        step(
          w,
          c.payload.type === ('dance' as string)
            ? ({ ...c, payload: { type: 'scan', actor_id: w.character } } as Command)
            : c,
        ),
    }),
  );
  assert.equal(f.id, 'unknown_types_fail_closed');
  assert.deepEqual(types(f.shrunk), ['dance'], f.text);
});

test('red control: a GameView that disagrees with admission trips gameview_agrees_with_admission', () => {
  const open = planted({
    gameView: (w) => ({
      ...gameView(w),
      exits: gameView(w).exits.map(({ direction }) => ({ available: true, direction })),
    }),
  });
  const shut = planted({
    gameView: (w) => ({
      ...gameView(w),
      actions: gameView(w).actions.map((a) => ({
        ...a,
        available: false,
        reason: { code: 'invalid_state' },
      })),
    }),
  });
  for (const kernel of [open, shut]) {
    const f = caught(kernel);
    assert.equal(f.id, 'gameview_agrees_with_admission');
    // A refusal the view hides may need MV drained first (which seed finds it depends on the
    // demo cartridges): moves, then the refused command.
    assert.ok(f.shrunk.length <= 4, f.text);
  }
});

// Breaks: the recipe half of the check (a perform's view entry, its shown codes) or the
// reason-code clause is lost, and a view offering a recipe admission refuses goes unseen.
test('red control: a recipe shown available, or refused for another code, trips gameview_agrees_with_admission', () => {
  const view = (f: (a: AdvertisedAction) => AdvertisedAction) =>
    planted({ gameView: (w) => ({ ...gameView(w), actions: gameView(w).actions.map(f) }) });
  const all = view((a) => ({ ...a, available: true }));
  const swapped = view((a) =>
    a.available
      ? a
      : { ...a, reason: { code: a.reason.code === 'cooldown' ? 'invalid_state' : 'cooldown' } },
  );
  for (const kernel of [all, swapped]) {
    const f = caught(kernel);
    assert.equal(f.id, 'gameview_agrees_with_admission');
    assert.equal(types(f.shrunk).at(-1), 'perform', f.text);
  }
});

// Breaks: unknown_types_fail_closed stops validating an accepted decision, so an unregistered
// event type passes.
test('red control: an accepted decision with an unregistered event trips unknown_types_fail_closed', () => {
  const f = caught(
    planted({
      step: (w, c) => {
        const s = step(w, c);
        if (s.decision.kind !== 'accepted') return s;
        const events = [...s.decision.events, { type: 'bogus' } as never];
        return { ...s, decision: { ...s.decision, events } };
      },
    }),
  );
  assert.equal(f.id, 'unknown_types_fail_closed');
  assert.equal(f.shrunk.length, 1, f.text);
});

// Breaks: an accepted step whose adopted State is not its proposal's (a clock off by one, the
// RNG not advanced), or whose delta does not compose, passes unseen.
test('red control: an accepted step adopted wrong, or not composing, is adopt_mismatch', () => {
  type Stepped = ReturnType<typeof step>;
  const on = (type: string, f: (s: Stepped, before: World) => Stepped) =>
    planted({
      step: (w, c) => {
        const s = step(w, c);
        return c.payload.type === type && s.decision.kind === 'accepted' ? f(s, w) : s;
      },
    });
  const state = (s: Stepped, change: Partial<World['state']>) => ({
    ...s,
    world: { ...s.world, state: { ...s.world.state, ...change } },
  });
  const late = on('wait', (s) => state(s, { clock: s.world.state.clock - 1 }));
  const stuck = on('perform', (s, before) => state(s, { rng: before.state.rng }));
  const stale = on('wait', (s) => {
    const d = s.decision as Extract<DecisionResult, { kind: 'accepted' }>;
    const ops = d.delta.ops.map((o) => (o.op === 'time.advance' ? { ...o, from: o.from + 1 } : o));
    return { ...s, decision: { ...d, delta: { ...d.delta, ops } } };
  });
  for (const [kernel, type] of [
    [late, 'wait'],
    [stuck, 'perform'],
    [stale, 'wait'],
  ] as const) {
    const f = caught(kernel);
    assert.equal(f.id, 'adopt_mismatch');
    assert.equal(types(f.shrunk).at(-1), type, f.text);
  }
});

test('red control: a throw inside a rule is a reported failure, not a crash of the runner', () => {
  const f = caught(
    planted({
      step: (w, c) => {
        if (c.payload.type === 'scan') throw new Error('planted');
        return step(w, c);
      },
    }),
  );
  assert.equal(f.id, 'threw');
  assert.deepEqual(types(f.shrunk), ['scan'], f.text);
  assert.match(f.text, /threw \(Error: planted\)/);
});
