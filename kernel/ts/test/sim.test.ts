// The deterministic simulation (test/sim.ts; docs/ROADMAP.md verification harness;
// r1-acceptance-envelope §3): the committed regression seeds, then 10,000 fresh sequences,
// each step keeping every registered invariant; determinism in and across processes; and red
// controls, each a kernel planted in this process that the simulator must catch and shrink.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { gameView, step } from '../src/world.ts';
import { CHECKED, GENERATOR, KERNEL, report, shrink, simulate, type Kernel } from './sim.ts';
import { read } from './read.ts';

const SEEDS: { generator: number; seeds: { seed: number }[] } = read(
  'kernel/ts/test/sim_seeds.json',
);
const seeds = SEEDS.seeds.map((s) => s.seed);
const FRESH = 10_000;
// Every outcome the demo cartridges can give; the generator must reach each one.
const REACHED = [
  'accepted',
  'cooldown',
  'exit_closed',
  'exit_locked',
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

// Breaks: an invariant registered with no per-step check and no stated reason.
test('every registered invariant is checked per step, or says why not', () => {
  const ids = read('protocol/invariants.json').map((i: { id: string }) => i.id);
  const covered = new Set([...CHECKED.world, ...CHECKED.step, ...Object.keys(CHECKED.none)]);
  assert.deepEqual([...covered].sort(), ids.sort());
});

// Breaks: any kernel change that throws out of step or breaks a registered invariant on a
// generated sequence; a generator that stops reaching most refusal codes.
test(`the regression seeds, then ${FRESH} fresh sequences, keep every invariant`, (t) => {
  assert.equal(SEEDS.generator, GENERATOR, 'sim_seeds.json is of another generator: re-curate it');
  const first = Date.now(); // the fresh seeds, printed so a failure can be rerun
  const lengths = Array<number>(8).fill(0);
  const codes = new Set<string>();
  let steps = 0;
  for (const seed of [...seeds, ...Array.from({ length: FRESH }, (_, i) => first + i)]) {
    const o = simulate(seed);
    if (o.failure) assert.fail(report(o));
    lengths[(o.commands.length - 1) >> 3]! += 1;
    steps += o.commands.length;
    for (const c of o.codes) codes.add(c);
  }
  t.diagnostic(
    `generator ${GENERATOR}; regression seeds ${seeds.join(' ')}; fresh seeds ${first} to ` +
      `${first + FRESH - 1}; ${seeds.length + FRESH} sequences, ${steps} steps; lengths 1-8, 9-16, ... 57-64: ` +
      `${lengths.join(' ')}; outcomes ${[...codes].sort().join(', ')}`,
  );
  assert.deepEqual([...codes].sort(), REACHED);
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
  assert.ok(f.shrunk.length <= 3 && types(f.shrunk).at(-1) === 'drop', f.text);
  assert.match(f.text, /^simulation failure: containment_acyclic .*\ngenerator 1, seed \d+/);
  assert.match(f.text, /shrunk from \d+ to [1-3] commands:\n/);
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
    assert.ok(f.shrunk.length <= 2, f.text);
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
