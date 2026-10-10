import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { DEFS, type Policy, type ResourceSpec } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { current } from '../src/foundation/resource.ts';
import { compose, key } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { loadCartridge } from '../src/content/cartridge.ts';
import { hourOf, nextHour, status } from '../src/mechanics/calendar.ts';
import { holds } from '../src/mechanics/policy.ts';
import { gameView } from '../src/view/view.ts';
import { newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const base = () => structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
const controlled = (c: any) => {
  c.calendar = {
    start: 0,
    units_per_hour: 100,
    hours_per_day: 10,
    subdivisions_per_hour: 10,
    solar: [
      { at: 100, phase: 'dawn' },
      { at: 200, phase: 'day' },
      { at: 700, phase: 'dusk' },
      { at: 800, phase: 'night' },
    ],
    lunar: {
      period: 80,
      origin: 7,
      phases: [
        'new',
        'waxing_crescent',
        'first_quarter',
        'waxing_gibbous',
        'full',
        'waning_gibbous',
        'last_quarter',
        'waning_crescent',
      ].map((phase, i) => ({ at: i * 10, phase })),
    },
  };
  c.npcs['ashmere_ferry@0.0.1:npc/bram'].daily_schedule = {
    '2': c.rooms['ashmere_ferry@0.0.1:room/ferry_landing'].exits.north.to,
  };
};
const load = (change: (c: any) => void = () => {}) => {
  const c = base();
  controlled(c);
  change(c);
  const canonical = encode(c);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${hash}"}`),
    {
      kernel_api: '1.0',
      capabilities: Object.fromEntries(Object.keys(c.lock.capabilities).map((k) => [k, [1]])),
      content_schema: 1,
      rule_ir: 1,
      client_features: [],
    },
  );
};

// Breaks: fixed 3600/24 math, a non-strict next job, or an inclusive window endpoint.
test('controlled calendar drives schedule, window and displayed subdivisions', () => {
  const loaded = load();
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const c = loaded.cartridge as Cartridge;
  const w = newWorld(c, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'], [1, 2, 3, 4]);
  assert.deepEqual(
    Object.values(w.state.jobs ?? {}).map((j) => j.due_time),
    [200],
  );
  assert.equal(nextHour(c, { '2': true }, 200), 1200);
  const window = { op: 'time_window', from: 8, to: 2 } as Policy;
  for (const [time, expected] of [
    [899, true],
    [199, true],
    [200, false],
    [799, false],
  ] as const)
    assert.equal(
      holds({ ...w, state: { ...w.state, clock: time } }, w.character, window),
      expected,
    );
  assert.deepEqual([hourOf(c, 999), hourOf(c, 1000)], [9, 0]);
  for (const [time, day, hour, subdivision] of [
    [999, 1, 9, 9],
    [1000, 2, 0, 0],
    [1001, 2, 0, 0],
  ])
    assert.deepEqual(status(c, '', time), {
      day,
      hour,
      subdivision,
      solar: 'night',
      lunar: 'waxing_gibbous',
    });
  assert.deepEqual(gameView({ ...w, state: { ...w.state, clock: 1000 } }).calendar_status, {
    day: 2,
    hour: 0,
    subdivision: 0,
    solar: 'night',
    lunar: 'waxing_gibbous',
  });
  const out = step(
    w,
    {
      id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b' as never,
      world_context_id: w.context,
      payload: { type: 'wait', actor_id: w.character, until: 200 },
    },
    0,
  );
  assert.equal(out.decision.kind, 'accepted');
  assert.deepEqual(
    Object.values(out.world.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .map((j) => j.due_time),
    [1200],
  );
});

// Breaks: a hidden 24-hour cap rejects a valid longer authored day or misplaces its next job.
test('a 30-hour calendar accepts hour 29 and a start on day two', () => {
  const loaded = load((c) => {
    c.calendar.hours_per_day = 30;
    c.calendar.start = 3000;
    c.npcs['ashmere_ferry@0.0.1:npc/bram'].daily_schedule = {
      '29': c.entry,
    };
  });
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const c = loaded.cartridge as Cartridge;
  assert.equal(nextHour(c, { '29': true }, 3000), 5900);
  assert.equal(status(c, '', 3000)?.day, 2);
  const w = newWorld(c, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'], [1, 2, 3, 4]);
  const window = { op: 'time_window', from: 29, to: 2 } as Policy;
  assert.equal(holds({ ...w, state: { ...w.state, clock: 2900 } }, w.character, window), true);
  assert.equal(holds({ ...w, state: { ...w.state, clock: 200 } }, w.character, window), false);
});

// Breaks: a cut comparison shifts one boundary, the lunar origin is ignored, or pre-origin time is negative.
test('solar and lunar cuts include their start and wrap at their cycle', () => {
  const loaded = load();
  assert.ok(loaded.ok);
  const c = loaded.cartridge as Cartridge;
  for (const [time, solar] of [
    [99, 'night'],
    [100, 'dawn'],
    [199, 'dawn'],
    [200, 'day'],
    [699, 'day'],
    [700, 'dusk'],
    [799, 'dusk'],
    [800, 'night'],
    [1000, 'night'],
  ] as const)
    assert.equal(status(c, '', time)?.solar, solar);
  for (const [time, lunar] of [
    [6, 'waning_crescent'],
    [7, 'new'],
    [17, 'waxing_crescent'],
    [47, 'full'],
    [87, 'new'],
  ] as const)
    assert.equal(status(c, '', time)?.lunar, lunar);
});

// Breaks: the bundled chapter day/time or phase pin drifts from its authored release.
test('chapter time renders the hand-checked evening and following days', () => {
  const c = read('protocol/fixtures/missing_child_v015_hash.json').value as Cartridge;
  for (const [time, day, hour, subdivision, solar, lunar] of [
    [64800, 1, 18, 0, 'dusk', 'new'],
    [86399, 1, 23, 59, 'night', 'new'],
    [86400, 2, 0, 0, 'night', 'new'],
    [151200, 2, 18, 0, 'dusk', 'new'],
    [237600, 3, 18, 0, 'dusk', 'new'],
  ] as const)
    assert.deepEqual(status(c, '', time), { day, hour, subdivision, solar, lunar });
});

// Breaks: an authored legacy gain interval still uses the fixed hourly boundary.
test('legacy resource gain uses its authored interval; opted fractional recovery keeps its own', () => {
  const spec = {
    key: 'hp',
    minimum: 0,
    maximum: 20,
    start: 4,
    gain: 2,
    gain_every: 100,
  } as ResourceSpec;
  assert.equal(current({ value: 4, at: 95 }, spec, 205), 8);
  const opted = { ...spec, regen: { every: 60, by_position: { standing: 2 } } } as never;
  assert.equal(current({ value: 4, at: 95, rate: 2, remainder: 0 }, opted, 205), 7);
});

// Breaks: hourly invariant replay rejects an authored-interval debit and accepts a forged stale from-value.
test('independent resource replay honors authored gain boundaries', () => {
  const { resource, target } = read('protocol/fixtures/resource_recovery.json');
  const spec = { key: 'hp', minimum: 0, maximum: 20, start: 4, gain: 2, gain_every: 100 };
  const state = {
    clock: 205,
    resource_specs: { [key(resource)]: spec },
    resources: { [key(target)]: { value: 4, at: 95 } },
  };
  const op = {
    op: 'resource.adjust',
    writer_group: 0,
    resource,
    entity_id: target.entity_id,
    from: 8,
    to: 7,
  };
  const delta = { ops: [op] } as never;
  const result = { changes: [{ target, value: { value: 7, at: 205 } }] };
  assert.deepEqual(compose(state, delta), result);
  const forged = { ops: [{ ...op, from: 4 }] };
  assert.deepEqual(
    [
      check('delta_preconditions_hold', { state, delta, result }),
      check('delta_preconditions_hold', { state, delta: forged, result }),
    ],
    [true, false],
  );
});

// Breaks: malformed calendar or impossible schedule/window reaches runtime arithmetic.
test('loader refuses malformed calendar and out-of-day references', () => {
  for (const mutate of [
    (c: any) => {
      c.calendar.solar[1].at = 100;
    },
    (c: any) => {
      c.calendar.lunar.phases[1].phase = 'new';
    },
    (c: any) => {
      c.calendar.units_per_hour = 101;
    },
    (c: any) => {
      c.npcs['ashmere_ferry@0.0.1:npc/bram'].daily_schedule['10'] = c.entry;
    },
  ])
    assert.equal(load(mutate).ok, false);
});

// Breaks: removing a new schema minimum, required field, or phase-key pattern admits malformed content.
test('calendar schema guards refuse malformed bounded fields', () => {
  const cal = { start: 0, units_per_hour: 100, hours_per_day: 10, subdivisions_per_hour: 10 };
  const cut = { at: 0, phase: 'new' };
  const status = { day: 1, hour: 0, subdivision: 0 };
  const resource = { key: 'hp', minimum: 0, maximum: 20, start: 4, gain: 2, gain_every: 100 };
  const cases: [string, object, string][] = [
    ['Calendar', { ...cal, units_per_hour: 0 }, 'below_minimum'],
    ['Calendar', { ...cal, hours_per_day: 0 }, 'below_minimum'],
    ['Calendar', { ...cal, subdivisions_per_hour: 0 }, 'below_minimum'],
    ['Calendar', { ...cal, solar: [] }, 'too_few_items'],
    ['Calendar', { ...cal, lunar: { period: 1, origin: 0, phases: [] } }, 'too_few_items'],
    ['Calendar', { ...cal, lunar: { period: 0, origin: 0, phases: [cut] } }, 'below_minimum'],
    ['Calendar', { ...cal, lunar: { period: 1, origin: -1, phases: [cut] } }, 'below_minimum'],
    ['Calendar', { ...cal, lunar: { origin: 0, phases: [cut] } }, 'missing_property'],
    ['Calendar', { ...cal, lunar: { period: 1, phases: [cut] } }, 'missing_property'],
    ['Calendar', { ...cal, lunar: { period: 1, origin: 0 } }, 'missing_property'],
    ['CalendarCut', { ...cut, at: -1 }, 'below_minimum'],
    ['CalendarCut', { ...cut, phase: 'New moon' }, 'pattern_mismatch'],
    ['CalendarCut', { phase: 'new' }, 'missing_property'],
    ['CalendarCut', { at: 0 }, 'missing_property'],
    ['CalendarStatus', { ...status, day: 0 }, 'below_minimum'],
    ['CalendarStatus', { ...status, hour: -1 }, 'below_minimum'],
    ['CalendarStatus', { ...status, subdivision: -1 }, 'below_minimum'],
    ['CalendarStatus', { ...status, solar: 'Bad phase' }, 'pattern_mismatch'],
    ['CalendarStatus', { ...status, lunar: 'Bad phase' }, 'pattern_mismatch'],
    ['CalendarStatus', { hour: 0, subdivision: 0 }, 'missing_property'],
    ['CalendarStatus', { day: 1, subdivision: 0 }, 'missing_property'],
    ['CalendarStatus', { day: 1, hour: 0 }, 'missing_property'],
    ['ResourceSpec', { ...resource, gain_every: 0 }, 'below_minimum'],
  ];
  for (const [contract, value, code] of cases) {
    const errors = validate(contract, value);
    assert.deepEqual(
      errors.map((e) => e.code),
      [code],
      `${contract}: ${JSON.stringify(value)}`,
    );
    const defs = structuredClone(DEFS) as Record<string, any>;
    const parts = errors[0].path.split('/').slice(1);
    const missing = code === 'missing_property' ? parts.pop() : undefined;
    let guard = defs[contract];
    for (const part of parts) {
      guard = guard.properties[part];
      if (guard.$ref) guard = defs[guard.$ref.split('/').pop()]; // lunar is a CalendarCycle
    }
    if (missing) guard.required = guard.required.filter((field: string) => field !== missing);
    else
      delete guard[
        (
          {
            below_minimum: 'minimum',
            too_few_items: 'minItems',
            pattern_mismatch: 'pattern',
          } as Record<string, string>
        )[code]
      ];
    assert.deepEqual(
      validate(contract, value, defs),
      [],
      `schema mutant survived: ${contract} ${errors[0].path}`,
    );
  }
});
