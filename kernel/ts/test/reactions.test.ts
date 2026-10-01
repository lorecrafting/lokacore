// reaction@1 (Early R7/R8 R; 21 §3.4, §11; 06 §14; 04 §5.2-§5.4): reaction deliveries in the
// proposal, their writer groups, causal positions and budgets, and the loader's reaction checks.
// Worlds are the green known answer (protocol/fixtures/cartridge_green_hash.json: 06:00, the
// player and Bram at the ferry landing, Maud on the green; Bram to the green at 19:00, Maud to the
// landing at 20:00; green_noticed and lamps_lit (19:00-20:00 only) on someone entering the green,
// gossip on green_busy changing while it is true, ring on entering the belfry, and four rules
// swinging bell_up and rope_taut forever), variants re-hashed with node:crypto over their
// canonical bytes. Ids are IdSource and job CommandIds over the literal inputs, computed with
// Python hashlib (numeric profile); limits are composition-profile.json's literals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef, DomainEvent } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { accepted, allocator } from '../src/decision.ts';
import { admit, adopt, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const G = 'ashmere_green@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_green', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
// Fresh-world ids under the nil CommandId: ordinal 1 the body, 3 the landing, 4 the green, 5
// Bram, 6 Maud, 7 Bram's first job, 8 Maud's; the run_job CommandIds of those jobs at 19:00 and
// 20:00.
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157';
const LANDING = '91fde0fc-dd14-846f-826e-245e45d16ec7';
const GREEN = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b';
const BRAM = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const MAUD = '6a70d262-b6ea-8b64-9809-ec7f79d1521e';
const BRAM_JOB = '0f5f2329-bcff-82f4-948a-3d22a75fb068';
const MAUD_JOB = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
const RUN_BRAM = '2c814147-52f5-8be6-8919-4c4bf7939a69';
const RUN_MAUD = '11ea9088-1d7a-89a0-86d4-857aa3c872e8';
const H = (h: number) => h * 3600;

const load = (f: (c: any) => void) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_green_hash.json').value);
  f(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  return loadCartridge(new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`), {
    kernel_api: '1.0',
    capabilities: Object.fromEntries(Object.keys(c.lock.capabilities).map((k) => [k, [1]])),
    content_schema: 1,
    rule_ir: 1,
    client_features: [],
  });
};
const world = (f: (c: any) => void = () => {}): World => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const cmd = (w: World, payload: object, id = CMD): Command =>
  ({ id, world_context_id: CONTEXT, payload: { actor_id: w.character, ...payload } }) as Command;
const move = (w: World, direction: string) => step(w, cmd(w, { type: 'move', direction }), 0);
const instance = { kind: 'instance', world_context_id: CONTEXT };
const assign = (fact: string, writer_group: number) => ({
  op: 'fact.assign',
  writer_group,
  fact: ref('fact', fact),
  scope: instance,
  expected: false,
  value: true,
});
// An event as position, logical time, payload (fact_changed by fact key), and the position of
// the event that caused it (0: the command or a run_job, by id).
const shape = (events: readonly DomainEvent[]) =>
  events.map((e) => [
    e.position,
    e.logical_time,
    e.payload.type === 'fact_changed'
      ? `${e.payload.fact.key} ${e.payload.old}>${e.payload.new}`
      : e.payload,
    events.find((c) => (c.id as string) === e.causation_id)?.position ?? e.causation_id,
    e.correlation_id,
  ]);
const facts = (w: World) =>
  Object.fromEntries(
    Object.entries(w.state.facts ?? {}).map(([k, v]) => [JSON.parse(k).fact.key, v]),
  );

// Breaks: a root event's reaction not delivered, delivered in the root's writer group or with a
// group a failed `when` consumed (lamps_lit is out of its hours at 06:00), its fact_changed not at
// the next position or not caused by its trigger, `when` read on committed state (gossip's
// green_busy is still false there), or a chain stopping at depth 1.
test('a move into the green triggers green_noticed, whose fact_changed triggers gossip', () => {
  const w = world();
  const s = move(w, 'north');
  assert.ok(s.decision.kind === 'accepted', JSON.stringify(s.decision));
  const ops = s.decision.delta.ops;
  assert.deepEqual(JSON.parse(JSON.stringify(ops.filter((o) => o.op === 'fact.assign'))), [
    assign('green_busy', 1),
    assign('gossip_spread', 2),
  ]);
  assert.deepEqual(
    new Set(ops.filter((o) => o.op !== 'fact.assign').map((o) => o.writer_group)),
    new Set([0]),
  );
  assert.deepEqual(shape(s.decision.events), [
    [1, H(6), { type: 'entity_entered_room', entity_id: BODY, room_id: GREEN }, CMD, CMD],
    [2, H(6), 'green_busy false>true', 1, CMD],
    [3, H(6), 'gossip_spread false>true', 2, CMD],
  ]);
  assert.deepEqual(facts(s.world), { green_busy: true, gossip_spread: true });
});

// Breaks: job-root reactions skipped or run only after every job (Maud's arrival would come
// before them), a job's writer group shared with its reactions or numbered apart from them (one
// counter: root 0, then each job and delivery in turn), deliveries in map order instead of rule
// key order (the second world inserts the rules reversed), a job-root reaction's `when` read at
// the advance's target (20:30, outside lamps_lit's 19:00-20:00) instead of the event's time, or
// its fact_changed at the target time.
test("a wait runs Bram's arrival's reactions to quiescence before Maud's job", () => {
  const reversed = (w: World) => {
    const reactions = Object.fromEntries(Object.entries(w.cartridge.reactions!).reverse());
    return newWorld({ ...w.cartridge, reactions }, CONTEXT as World['context'], [1, 2, 3, 4]);
  };
  for (const w of [world(), reversed(world())]) {
    const s = step(w, cmd(w, { type: 'wait', until: H(20) + 1800 }), 0);
    assert.ok(s.decision.kind === 'accepted', JSON.stringify(s.decision));
    assert.deepEqual(
      s.decision.delta.ops.map((o) => [o.writer_group, o.op, 'fact' in o ? o.fact.key : '']),
      [
        [0, 'time.advance', ''],
        [1, 'entity.transfer', ''],
        [1, 'job.complete', ''],
        [1, 'job.schedule', ''],
        [2, 'fact.assign', 'green_busy'],
        [3, 'fact.assign', 'lamps_lit'],
        [4, 'fact.assign', 'gossip_spread'],
        [5, 'entity.transfer', ''],
        [5, 'job.complete', ''],
        [5, 'job.schedule', ''],
      ],
    );
    assert.deepEqual(shape(s.decision.events), [
      [1, H(19), { type: 'entity_entered_room', entity_id: BRAM, room_id: GREEN }, RUN_BRAM, CMD],
      [2, H(19), 'green_busy false>true', 1, CMD],
      [3, H(19), 'lamps_lit false>true', 1, CMD],
      [4, H(19), 'gossip_spread false>true', 2, CMD],
      [5, H(20), { type: 'entity_entered_room', entity_id: MAUD, room_id: LANDING }, RUN_MAUD, CMD],
    ]);
    assert.deepEqual(facts(s.world), { green_busy: true, lamps_lit: true, gossip_spread: true });
    const done = s.world.state.jobs!;
    assert.deepEqual([done[BRAM_JOB].status, done[MAUD_JOB].status], ['completed', 'completed']);
  }
});

// Breaks (04 §5.4, 06 §14): a cycle not stopped (the step never returns), stopped by truncating
// the chain and committing it (it would also fault conflicting_write: two groups write bell_up),
// or committing any part of the move.
test('entering the belfry starts a cycle that faults budget_exceeded and commits nothing', () => {
  const green = move(world(), 'north').world;
  const s = move(green, 'east');
  assert.deepEqual(s.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(s.world, green);
});

// A world whose reactions are only a chain of `n` rules: entering `room` sets c0, and each
// c(i-1) changing sets ci, so the last delivery is at reaction depth n.
const chain = (n: number, room = 'belfry') =>
  world((c) => {
    const bool = { version: 1, value_type: { type: 'bool', default: false }, scopes: ['instance'] };
    c.reactions = {};
    for (let i = 0; i < n; i++) {
      c.facts[`${G}:fact/c${i}`] = { ...bool, key: `c${i}`, meaning: 'a link' };
      c.reactions[`${G}:reaction/k${i}`] = {
        key: `k${i}`,
        on:
          i === 0
            ? { event: 'entity_entered_room', room: ref('room', room) }
            : { event: 'fact_changed', fact: ref('fact', `c${i - 1}`) },
        apply: [{ op: 'fact.assign', fact: ref('fact', `c${i}`), value: true }],
      };
    }
  });

// Breaks: no reaction_depth check (a chain one deeper than the limit commits), or an off-by-one
// limit (a chain at the limit faults).
test('a chain of 32 deliveries commits; one of 33 exceeds reaction_depth', () => {
  for (const [n, kind] of [
    [32, 'accepted'],
    [33, 'fault'],
  ] as const) {
    const s = move(move(chain(n), 'north').world, 'east');
    assert.equal(s.decision.kind, kind, `${n}`);
  }
});

// A world whose reactions are only `n` rules on entering the belfry, each with an empty apply
// (no operation or event) and `rest`; policy@1 locked for an `all`.
const belfry = (n: number, rest: object = {}) =>
  world((c) => {
    c.manifest.requires.capabilities.policy = c.lock.capabilities.policy = 1;
    c.reactions = {};
    for (let i = 0; i < n; i++)
      c.reactions[`${G}:reaction/r${i}`] = {
        key: `r${i}`,
        on: { event: 'entity_entered_room', room: ref('room', 'belfry') },
        apply: [],
        ...rest,
      };
  });
const enter = (w: World) => move(move(w, 'north').world, 'east').decision.kind;
const leaf = (equals: boolean) => ({ op: 'fact_compare', fact: ref('fact', 'bell_up'), equals });

// Breaks (04 §5.2, §5.4: a delivery is each rule an event triggers, its guard evaluated at
// delivery): no deliveries budget, an off-by-one limit, or a rule whose `when` is false not
// counted as a delivery (8193 of them commit).
test('8193 deliveries of one event exceed deliveries, whether their `when` holds or not', () => {
  const never = { when: { policy_version: 1, root: leaf(true) } }; // bell_up is false
  for (const rest of [{}, never]) {
    assert.equal(enter(belfry(8192, rest)), 'accepted');
    assert.equal(enter(belfry(8193, rest)), 'fault');
  }
});

// Breaks (04 §5.4 query_steps): reaction guards not counted, or an off-by-one limit. 1024 guards
// of 32 leaves evaluate exactly 32768; of 33, 33792. Each leaf is true at 06:00 and small, so the
// artifact stays under 4 MiB.
test('reaction guards past 32768 policy leaves exceed query_steps', () => {
  const all = (n: number) => ({
    when: {
      policy_version: 1,
      root: { op: 'all', items: Array(n).fill({ op: 'time_window', from: 0, to: 12 }) },
    },
  });
  assert.equal(enter(belfry(1024, all(32))), 'accepted');
  assert.equal(enter(belfry(1024, all(33))), 'fault');
});

// Breaks (04 §5.4: over-limit work discards the whole advance): a job-root reaction overflow
// ignored or answered with a partial advance (Bram moved, the clock or jobs advanced).
test("a chain past reaction_depth from Bram's 19:00 arrival discards the whole wait", () => {
  const w = chain(33, 'village_green');
  const s = step(w, cmd(w, { type: 'wait', until: H(19) + 1800 }), 0);
  assert.deepEqual(s.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(s.world, w);
});

// Breaks: no events budget at the end of the proposal (a result of 4097 events commits), or an
// off-by-one limit. The events carry nothing else, so neither operations nor output_bytes runs out.
test('4097 events exceed the events budget; 4096 commit', () => {
  const w = world();
  const SET = { id: CMD, payload: { actor_id: w.character } } as never;
  for (const [n, kind] of [
    [4096, 'accepted'],
    [4097, 'fault'],
  ] as const) {
    const events = Array.from({ length: n }, (_, i) => ({
      position: i + 1,
      payload: { type: 'custom_event' },
    }));
    const r = adopt(
      w,
      admit('action_recipe', accepted(w, 'x', [], events as never) as never),
      SET,
      allocator(w, SET),
      0,
    );
    assert.equal(r.decision.kind, kind, `${n}`);
  }
});

const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data: object = {},
  suggested: string[] = [],
) =>
  assert.deepEqual(load(f), {
    ok: false,
    diagnostic: {
      severity: 'error',
      code,
      path,
      message_key: `diagnostics.${code.toLowerCase()}`,
      data,
      suggested_capabilities: suggested,
    },
  });
const unlock = (c: any, cap: string) => {
  delete c.manifest.requires.capabilities[cap];
  delete c.lock.capabilities[cap];
};
const at = (key: string) => `.cartridge.reactions["${G}:reaction/${key}"]`;
const rule = (c: any, key: string) => c.reactions[`${G}:reaction/${key}`];

// Breaks: the loader admitting what the compiler rejects (test/loka/content_green_test.exs): a
// trigger of an unregistered event type, a trigger, `when` or fact.assign naming a fact or room the
// cartridge lacks (the kernel would never match it, or assign an undeclared fact), a value not
// of its fact's type, or a reaction, its trigger's event or its fact.assign's fact_changed whose
// owner (reaction@1, fact@1) is not locked.
test('the loader checks reaction triggers, consequences and owners', () => {
  fails(
    (c) => (rule(c, 'ring').on.event = 'bell_rung'),
    'SCHEMA_VIOLATION',
    `${at('ring')}.on.event`,
    {
      error: 'unknown_variant',
    },
  );
  fails(
    (c) => (c.reactions[`${G}:quest/ring`] = rule(c, 'ring')),
    'SCHEMA_VIOLATION',
    `.cartridge.reactions["${G}:quest/ring"]`,
    { error: 'pattern_mismatch' },
  );
  fails(
    (c) => (rule(c, 'gossip').on.fact = ref('fact', 'rumour')),
    'UNRESOLVED_REFERENCE',
    `${at('gossip')}.on.fact`,
    { target: `${G}:fact/rumour` },
  );
  fails(
    (c) => (rule(c, 'gossip').when.root.fact = ref('fact', 'rumour')),
    'UNRESOLVED_REFERENCE',
    `${at('gossip')}.when.root.fact`,
    { target: `${G}:fact/rumour` },
  );
  fails(
    (c) => (rule(c, 'ring').on.room = ref('room', 'tower')),
    'UNRESOLVED_REFERENCE',
    `${at('ring')}.on.room`,
    { target: `${G}:room/tower` },
  );
  fails(
    (c) => (rule(c, 'ring').apply[0].fact = ref('fact', 'bell')),
    'UNRESOLVED_REFERENCE',
    `${at('ring')}.apply[0].fact`,
    { target: `${G}:fact/bell` },
  );
  fails(
    (c) => (rule(c, 'ring').apply[0].value = 1),
    'FACT_TYPE_MISMATCH',
    `${at('ring')}.apply[0].value`,
  );
  fails(
    (c) => unlock(c, 'reaction'),
    'UNDECLARED_CAPABILITY',
    at('bell_falls'),
    { capability: 'reaction' },
    ['reaction@1'],
  );
  // Without fact@1 and every other use of it: only `key`'s trigger, or its one fact.assign, uses it.
  const only = (key: string, apply?: []) => (c: any) => {
    unlock(c, 'fact');
    const r = rule(c, key);
    delete r.when;
    c.reactions = { [`${G}:reaction/${key}`]: apply ? { ...r, apply } : r };
  };
  fails(
    only('gossip', []),
    'UNDECLARED_CAPABILITY',
    `${at('gossip')}.on.event`,
    { capability: 'fact' },
    ['fact@1'],
  );
  fails(
    only('ring'),
    'UNDECLARED_CAPABILITY',
    `${at('ring')}.apply[0].op`,
    { capability: 'fact' },
    ['fact@1'],
  );
});
