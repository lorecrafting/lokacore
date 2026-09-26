// The logical clock, wait, recipe duration and luck checks (R5 S6a; 21 §4 Time, Deterministic
// RNG, §7 Check; 04 §5.0, §5.4; 00 §4.2). Worlds are the bell known answer
// (protocol/fixtures/cartridge_bell_hash.json) with ring_bell given a check, a failure outcome and
// a duration, re-hashed with node:crypto over sorted-key JSON.stringify. The seed is the numeric
// profile's initial_rng [1, 2, 3, 4]; docs/spec/conformance/numeric-vectors.json rng_steps give
// its first raw draw 11520, below 2^32 - (2^32 mod 100) = 4294967200, so the roll is
// 11520 mod 100 = 20, and the state after it [7, 0, 1026, 12288]; the second raw draw is 0, a
// roll of 0. Ids are Python's hashlib over the IdSource input; everything else is hand-written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode } from '../src/canonical.ts';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { holds } from '../src/policy.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_bell_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
const BELL = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const IDS = [
  'e2870386-6797-8a1b-8e1a-b2c028c16c49', // IdSource [context, CMD, 0], Python
  '2ed1ae6f-befe-8e6a-a5b1-bce1b3d1e5d9', // 1
  'dc69e85d-a2c1-815e-a631-9c6b94c780d3', // 2
  '65f0a182-6d50-8708-9615-77955d1c68ab', // 3
];
const SEED = [1, 2, 3, 4];
const AFTER_ONE_DRAW = [7, 0, 1026, 12288];
const RECIPE = 'ashmere_bell@0.0.1:recipe/ring_bell';

const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
// The bell with check@1 and schedule@1 locked, `f` applied, loaded and fresh.
const world = (f: (c: any) => void = () => {}): World => {
  const c = structuredClone(kat.value);
  for (const key of ['check', 'schedule'])
    c.manifest.requires.capabilities[key] = c.lock.capabilities[key] = 1;
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], SEED);
};
// ring_bell with a luck check of `chance`, a 90-second duration, and a failure outcome that
// emits bell_muffled.
const checked = (chance: number) =>
  world((c) => {
    const r = c.recipes[RECIPE];
    r.check = { key: 'ring_true', kind: 'luck', chance };
    r.duration = 90;
    r.outcomes.failure = {
      sequence: [{ op: 'event.emit', event: 'bell_muffled' }],
      narration: { actor: 'narration.ring_bell.observers' },
    };
  });
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
const cmd = (payload: object): Command =>
  ({ id: CMD, world_context_id: CONTEXT, payload: { actor_id: CHARACTER, ...payload } }) as Command;
const ring = cmd({ type: 'perform', action: 'ring_bell' });
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_bell',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const instance = { kind: 'instance', world_context_id: CONTEXT };
const at = (id: string, position: number, payload: object, scope: object = player) => ({
  id,
  world_context_id: CONTEXT,
  scope,
  actor_id: CHARACTER,
  logical_time: 0,
  position,
  causation_id: CMD,
  correlation_id: CMD,
  payload,
});
const player = { kind: 'player', character_id: CHARACTER };
const check = (type: string) => ({ type, check: ref('check', 'ring_true'), subject_id: BELL });
const custom = (key: string) => ({
  type: 'custom_event',
  event: ref('event', key),
  subject_id: BELL,
});
const completed = { type: 'action_completed', action: 'ring_bell', subject_id: BELL };
const advance = { op: 'time.advance', writer_group: 0, from: 0, to: 90 };

// Known answer (roll 20). Breaks: a pass test of <= instead of < (chance 20 would pass), the
// check event missing or not at position 1, the draw not committed, the success sequence not
// run, or the duration not advancing the clock.
test('a luck check of chance 21 passes on the roll of 20 and runs success', () => {
  const { decision, world: w } = step(checked(21), ring);
  assert.deepEqual(plain(decision), {
    kind: 'accepted',
    outcome: 'success',
    delta: {
      ops: [
        {
          op: 'fact.assign',
          writer_group: 0,
          fact: ref('fact', 'chapel_bell_rung'),
          scope: instance,
          expected: false,
          value: true,
        },
        advance,
      ],
    },
    events: [
      at(IDS[0], 1, check('check_passed')),
      at(
        IDS[3],
        2,
        { type: 'fact_changed', fact: ref('fact', 'chapel_bell_rung'), old: false, new: true },
        instance,
      ),
      at(IDS[1], 3, custom('bell_rung')),
      at(IDS[2], 4, completed),
    ],
    effects: [],
    rng: AFTER_ONE_DRAW,
    narration: [{ key: 'narration.ring_bell.actor' }],
  });
  assert.deepEqual(w.state.rng, AFTER_ONE_DRAW);
  assert.equal(w.state.clock, 90);
});

// 04 §5.0. Breaks: a failed check rejected (or its RNG restored, its time not committed), the
// success outcome run anyway, or a retry rerolling the same state instead of the advanced one.
test('a luck check of chance 20 fails on the roll of 20: accepted, draw and time commit', () => {
  const before = checked(20);
  const { decision, world: w } = step(before, ring);
  assert.deepEqual(plain(decision), {
    kind: 'accepted',
    outcome: 'failure',
    delta: { ops: [advance] },
    events: [
      at(IDS[0], 1, check('check_failed')),
      at(IDS[1], 2, custom('bell_muffled')),
      at(IDS[2], 3, completed),
    ],
    effects: [],
    rng: AFTER_ONE_DRAW,
    narration: [{ key: 'narration.ring_bell.observers' }],
  });
  assert.deepEqual([w.state.rng, w.state.clock, w.state.facts], [AFTER_ONE_DRAW, 90, undefined]);
  // A new attempt draws from the advanced state: the second raw draw, 0, passes.
  const again = step(w, ring).decision;
  assert.ok(again.kind === 'accepted');
  assert.equal(again.outcome, 'success');
  assert.deepEqual(again.events[0].payload, check('check_passed'));
  // Seeded determinism: the same world and command decide byte-identically.
  assert.equal(encode(step(before, ring).decision as never), encode(decision as never));
});

// 04 §5.0. Breaks: a rejection that draws, advances time or commits anything.
test('a rejected perform of a checked recipe draws nothing and changes nothing', () => {
  const w = checked(50);
  const down = step(w, cmd({ type: 'move', direction: 'down' })).world;
  const rung = step(checked(99), ring).world; // policy: the bell is not yet rung
  for (const [before, code] of [
    [down, 'not_present'],
    [rung, 'invalid_state'],
  ] as const) {
    const r = step(before, ring);
    assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
    assert.equal(r.world, before);
  }
});

// Breaks: a recipe without a check drawing or changing its outcome, or ignoring its duration.
test('a recipe without a check keeps outcome performed and the RNG; duration still advances', () => {
  const w = world((c) => (c.recipes[RECIPE].duration = 3600));
  const { decision, world: after } = step(w, ring);
  assert.ok(decision.kind === 'accepted');
  assert.equal(decision.outcome, 'performed');
  assert.deepEqual(decision.rng, SEED);
  assert.deepEqual(decision.delta.ops.at(-1), { ...advance, to: 3600 });
  assert.equal(gameView(after).time, 3600);
});

// Breaks: wait accepting an until not later than now, not adopting the advance, emitting an
// event, or offered without schedule@1 locked.
test('wait advances the clock to until, later than now only', () => {
  const w = world();
  const wait = (until: number) => cmd({ type: 'wait', until });
  const now = step(w, wait(0));
  assert.deepEqual(now.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(now.world, w);
  const r = step(w, wait(1));
  assert.deepEqual(plain(r.decision), {
    kind: 'accepted',
    outcome: 'waited',
    delta: { ops: [{ op: 'time.advance', writer_group: 0, from: 0, to: 1 }] },
    events: [],
    effects: [],
    rng: SEED,
  });
  assert.equal(r.world.state.clock, 1);
  const back = step(r.world, wait(1));
  assert.deepEqual(back.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  const unlocked = world((c) => {
    delete c.manifest.requires.capabilities.schedule;
    delete c.lock.capabilities.schedule;
  });
  assert.deepEqual(step(unlocked, wait(1)).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
});

// 00 §4.2 dusk at 18. One unit is one second; hour h starts at h * 3600. Breaks: a window that
// does not wrap midnight, an off-by-one at either edge, or the day not wrapping at 24 hours.
test('time_of_day holds in its window, wrapping midnight when to < from', () => {
  const w = world();
  const at = (t: number, from: number, to: number) =>
    holds({ ...w, state: { ...w.state, clock: t } }, w.character, {
      op: 'time_of_day',
      from,
      to,
    });
  const rows: [number, number, number, boolean][] = [
    [17 * 3600 + 3599, 18, 6, false],
    [18 * 3600, 18, 6, true],
    [23 * 3600, 18, 6, true],
    [0, 18, 6, true],
    [5 * 3600 + 3599, 18, 6, true],
    [6 * 3600, 18, 6, false],
    [12 * 3600, 18, 6, false],
    [86400 + 18 * 3600, 18, 6, true], // day 2
    [86400 + 12 * 3600, 18, 6, false],
    [5 * 3600 + 3599, 6, 18, false],
    [6 * 3600, 6, 18, true],
    [17 * 3600 + 3599, 6, 18, true],
    [18 * 3600, 6, 18, false],
  ];
  for (const [t, from, to, want] of rows) assert.equal(at(t, from, to), want, `${t} ${from}-${to}`);
});
