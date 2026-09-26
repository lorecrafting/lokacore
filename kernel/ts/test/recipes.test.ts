// The ActionSet algebra and ActionRecipe execution (R5 S5; 06 §19-§20; ADR-016; 21 §7; 04 §5.2,
// §5.4). The world is built from the bell known answer (protocol/fixtures/cartridge_bell_hash.json),
// or from a copy of it changed by one field and re-hashed with node:crypto over sorted-key
// JSON.stringify (the canonical form for these values). Ids and the state hash are Python's
// hashlib over the IdSource input and the canonical state, never the kernel's; decisions, lists
// and codes are hand-written from the rule's and actions.ts's headers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { apply, type ActionSet } from '../src/actions.ts';
import { hash } from '../src/canonical.ts';
import type { Command } from '../src/contracts.gen.ts';
import { accepted, allocator } from '../src/decision.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { describe } from '../src/rules/description_variant.ts';
import { admit, adopt, gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_bell_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9'; // ordinal 0
const BELFRY = '1a7c3699-2844-8a55-b29f-eac079c7bf50'; // 2: rooms in ref order
const BELL = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b'; // 4: the belfry's details in key order
const ROPE = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2'; // 5
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const IDS = [
  'e2870386-6797-8a1b-8e1a-b2c028c16c49', // IdSource [context, CMD, 0], Python
  '2ed1ae6f-befe-8e6a-a5b1-bce1b3d1e5d9', // 1
  'dc69e85d-a2c1-815e-a631-9c6b94c780d3', // 2
];
const SEED = [1, 2, 3, 4];
const RECIPE = 'ashmere_bell@0.0.1:recipe/ring_bell';
const ROOM = 'ashmere_bell@0.0.1:room/belfry';

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
// The bell known answer with `f` applied, loaded (re-hashed when changed).
const load = (f: (c: any) => void = () => {}, from = kat) => {
  const c = structuredClone(from.value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    INSTALLED,
  );
};
const world = (f?: (c: any) => void) => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], SEED);
};
// Plain prototypes: the loader's decoded values have none (cartridge.test.ts).
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
const cmd = (payload: object): Command =>
  ({ id: CMD, world_context_id: CONTEXT, payload: { actor_id: CHARACTER, ...payload } }) as Command;
const ring = (target_id?: string) => cmd({ type: 'perform', action: 'ring_bell', target_id });
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_bell',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const instance = { kind: 'instance', world_context_id: CONTEXT };
const base = (id: string, position: number) => ({
  id,
  world_context_id: CONTEXT,
  scope: { kind: 'player', character_id: CHARACTER },
  actor_id: CHARACTER,
  logical_time: 0,
  position,
  causation_id: CMD,
  correlation_id: CMD,
});
const bellRung = (id: string, position: number) => ({
  ...base(id, position),
  payload: { type: 'custom_event', event: ref('event', 'bell_rung'), subject_id: BELL },
});
const completed = (id: string, position: number) => ({
  ...base(id, position),
  payload: { type: 'action_completed', action: 'ring_bell', subject_id: BELL },
});
const factChanged = (id: string, position: number) => ({
  ...base(id, position),
  scope: instance,
  payload: { type: 'fact_changed', fact: ref('fact', 'chapel_bell_rung'), old: false, new: true },
});
const assign = (expected: unknown, value: unknown) => ({
  op: 'fact.assign',
  writer_group: 0,
  fact: ref('fact', 'chapel_bell_rung'),
  scope: instance,
  expected,
  value,
});

// Breaks: an operation swapped for another, union letting the contribution win, override
// keeping the old definition, or subtract and intersect inverted (ADR-016).
test('the five ActionSet operations compose by stable key', () => {
  const set = { a: 'a1', b: 'b1' } as unknown as ActionSet;
  const c = { b: 'b2', c: 'c2' } as unknown as ActionSet;
  const rows: [string, object][] = [
    ['union', { a: 'a1', b: 'b1', c: 'c2' }],
    ['override', { a: 'a1', b: 'b2', c: 'c2' }],
    ['replace', { b: 'b2', c: 'c2' }],
    ['subtract', { a: 'a1' }],
    ['intersect', { b: 'b1' }],
  ];
  for (const [op, expected] of rows) assert.deepEqual(apply(set, op as never, c), expected, op);
});

// Breaks (04 §5.2 steps 4-5; S4 review F1): fact_changed after the recipe's own event, the
// assign not proposed or its change not adopted, a missing event, action_completed missing or
// not last (review F2), no narration, or the S3 variants not following the committed fact.
test('ring bell assigns the fact, then fact_changed, then the custom event, and narrates', () => {
  const { decision, world: w } = step(world(), ring(BELL));
  assert.deepEqual(plain(decision), {
    kind: 'accepted',
    outcome: 'performed',
    delta: { ops: [assign(false, true)] },
    events: [factChanged(IDS[2], 1), bellRung(IDS[0], 2), completed(IDS[1], 3)],
    effects: [],
    rng: SEED,
    narration: [{ key: 'narration.ring_bell.actor' }],
  });
  assert.equal(
    hash(w.state as never),
    '4515fefee611442664c82e76ece4666f879a6c26bde807fcff4fb687d20c6f5e',
  );
  assert.equal(gameView(w).place.description.key, 'room.belfry.rung');
  assert.equal(describe(w, w.character, w.details[BELL]), 'detail.bell.rung');
  assert.deepEqual(plain(step(world(), ring()).decision), plain(decision)); // the recipe's own target
});

// Breaks: an assign that keeps its value emits fact_changed, the second assign's expected value
// read from committed state instead of the sequence so far, or positions left with a gap.
test('an assign that keeps its value takes no position and emits no fact_changed', () => {
  const w = world((c) => {
    const r = c.recipes[RECIPE];
    r.policy.root = { op: 'all', items: [] };
    r.outcomes.success.sequence.splice(1, 0, r.outcomes.success.sequence[0]);
  });
  const { decision } = step(w, ring());
  assert.ok(decision.kind === 'accepted');
  assert.deepEqual(plain(decision.delta.ops), [assign(false, true), assign(true, true)]);
  assert.deepEqual(plain(decision.events), [
    factChanged(IDS[2], 1),
    bellRung(IDS[0], 2),
    completed(IDS[1], 3),
  ]);
});

// Breaks: the authority trusting the invocation (06 §20: it re-resolves the action), a
// rejection that still commits, or the policy not re-evaluated after the bell is rung.
test('perform is rejected for another target, key or room, and once its policy fails', () => {
  const w = world();
  const rung = step(w, ring()).world;
  const down = step(w, cmd({ type: 'move', direction: 'down' })).world;
  const gone = world((c) => (c.rooms[ROOM].actions = [{ op: 'subtract', actions: ['ring_bell'] }]));
  const rows: [World, Command, string][] = [
    [w, ring(ROPE), 'invalid_target'],
    [w, cmd({ type: 'perform', action: 'ring_rope' }), 'not_found'],
    [gone, ring(), 'unsupported_capability'], // exists, not offered here (review N2)
    [down, ring(), 'not_present'],
    [rung, ring(), 'invalid_state'],
  ];
  for (const [before, c, code] of rows) {
    const r = step(before, c);
    assert.deepEqual(r.decision, { kind: 'rejected', error: { code } }, code);
    assert.equal(r.world, before);
  }
});

// Breaks (brief item 7): a recipe commits a value its FactSpec does not allow, or part of the
// sequence commits before the fault.
test('a recipe assigning a wrongly typed value faults with nothing committed', () => {
  const w = world((c) => (c.recipes[RECIPE].outcomes.success.sequence[0].value = 'yes'));
  const r = step(w, ring());
  assert.deepEqual(plain(r.decision), {
    kind: 'fault',
    code: 'precondition_failed',
    target: { kind: 'fact', fact: ref('fact', 'chapel_bell_rung'), scope: instance },
  });
  assert.equal(r.world, w);
});

const shown = (key: string, label: string, available = true) => ({
  available,
  action_key: key,
  label,
  target: { kind: 'none' },
  input: key === 'move' ? ['direction'] : [],
  ...(available ? {} : { reason: { code: 'invalid_state' } }),
});
const places = (w: World) => gameView(w).actions.map((a) => a.action_key);

// Breaks: a recipe listed away from its detail or not greyed once its policy fails, the lists
// not by priority then key, or engine verbs of capabilities the cartridge does not lock (take).
test("the place's actions: the recipe first while its detail is here, then the verbs", () => {
  const w = world();
  const ringBell = shown('ring_bell', 'actions.ring_bell');
  const verbs = [shown('look', 'action.look'), shown('move', 'action.move')];
  assert.deepEqual(plain(gameView(w).actions), [ringBell, ...verbs]);
  const rung = step(w, ring()).world;
  const greyed = shown('ring_bell', 'actions.ring_bell', false);
  assert.deepEqual(plain(gameView(rung).actions), [greyed, ...verbs]);
  assert.deepEqual(places(step(w, cmd({ type: 'move', direction: 'down' })).world), [
    'look',
    'move',
  ]);
});

// Breaks: a room's contribution ignored, applied with the wrong operation or out of order, or
// the authority accepting a command its ActionSet no longer offers (04 §19; ACT-09).
test("a room's contributions shape its actions, and step admits only what they offer", () => {
  const with_ = (...actions: object[]) => world((c) => (c.rooms[ROOM].actions = actions));
  const look = cmd({ type: 'look' });
  const rows: [object[], string[]][] = [
    [[{ op: 'subtract', actions: ['look'] }], ['ring_bell', 'move']],
    [[{ op: 'intersect', actions: ['ring_bell', 'take'] }], ['ring_bell']],
    [[{ op: 'replace', actions: ['move'] }], ['move']],
    [
      [
        { op: 'replace', actions: ['move'] },
        { op: 'union', actions: ['look'] },
      ],
      ['look', 'move'],
    ],
    [
      [
        { op: 'subtract', actions: ['look'] },
        { op: 'override', actions: ['look'] },
      ],
      ['ring_bell', 'look', 'move'],
    ],
  ];
  for (const [actions, expected] of rows) {
    const w = with_(...actions);
    assert.deepEqual(places(w), expected, JSON.stringify(actions));
    const code = step(w, look).decision.kind === 'accepted' ? 'accepted' : 'rejected';
    assert.equal(code, expected.includes('look') ? 'accepted' : 'rejected');
  }
  const refused = step(with_({ op: 'subtract', actions: ['look'] }), look).decision;
  assert.deepEqual(refused, { kind: 'rejected', error: { code: 'unsupported_capability' } });
});

// Breaks: a cartridge action not overriding the engine verb of its key (06 §19 override), its
// TargetSpec none admitting a target (Astra A1), or a verb whose policy fails still admitted.
test('a cartridge action overrides the engine verb of its key, policy included', () => {
  const w = world((c) => {
    c.actions['ashmere_bell@0.0.1:action/look'] = {
      key: 'look',
      label: 'actions.ring_bell',
      target: { kind: 'none' },
      command: 'look',
      priority: 20,
      input: [],
      policy: c.recipes[RECIPE].policy,
      accessibility: 'actions.ring_bell',
    };
  });
  assert.deepEqual(plain(gameView(w).actions[0]), shown('look', 'actions.ring_bell'));
  assert.equal(step(w, cmd({ type: 'look' })).decision.kind, 'accepted');
  assert.deepEqual(step(w, cmd({ type: 'look', target_id: BELL })).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' }, // its target is none: no examine
  });
  const rung = step(w, ring()).world;
  assert.deepEqual(step(rung, cmd({ type: 'look' })).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
});

// Breaks (S4 review N3): the output budget checked before the host's fact_changed events are
// added, so a result grows past output_bytes (1 MiB) after admission.
test('the output budget counts the fact_changed events adopt adds', () => {
  const w = world();
  const SET = { id: CMD, payload: { actor_id: CHARACTER } } as never;
  const toggles = (n: number) =>
    Array.from({ length: n }, (_, i) => assign(i % 2 === 1, i % 2 === 0)) as never;
  const under = accepted(w, 'x', toggles(2000), []);
  assert.ok(Buffer.byteLength(JSON.stringify(under)) < 1048576); // the rule's own result fits
  const r = adopt(w, admit('fact', under as never), SET, allocator(w, SET));
  assert.deepEqual(r.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(r.world, w);
  const small = adopt(
    w,
    admit('fact', accepted(w, 'x', toggles(2), []) as never),
    SET,
    allocator(w, SET),
  );
  assert.equal(small.decision.kind, 'accepted');
});

// Astra A1. Breaks: admission matching only the Command type, so an action narrowed to held items
// authorizes a look at nothing or at a room's detail, or a move without the input it requires.
test("a command no offered action's target or input accepts is refused like an unoffered one", () => {
  const w = world((c) => {
    const action = (key: string, command: string, target: object, input: string[]) => ({
      key,
      label: 'actions.ring_bell',
      target,
      command,
      priority: 0,
      input,
      policy: c.recipes[RECIPE].policy,
      accessibility: 'actions.ring_bell',
    });
    const inventory = { kind: 'entity', scopes: ['inventory'] };
    c.actions['ashmere_bell@0.0.1:action/inspect_inventory'] = action(
      'inspect_inventory',
      'look',
      inventory,
      [],
    );
    c.actions['ashmere_bell@0.0.1:action/walk'] = action('walk', 'move', { kind: 'none' }, []);
    c.rooms[ROOM].actions = [{ op: 'replace', actions: ['inspect_inventory', 'walk'] }];
  });
  const refused = { kind: 'rejected', error: { code: 'unsupported_capability' } };
  for (const c of [
    cmd({ type: 'look' }),
    cmd({ type: 'look', target_id: BELL }),
    cmd({ type: 'move', direction: 'down' }),
  ])
    assert.deepEqual(step(w, c).decision, refused, JSON.stringify(c));
});

// Breaks: an entity TargetSpec that accepts nothing, or its scope read from the wrong container
// (items known answer: the satchel starts at the ferry landing, a detail is the mooring post).
test("an entity target in the action's scope is admitted", () => {
  const items = read('protocol/fixtures/cartridge_items_hash.json');
  const SATCHEL = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
  const POST = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b';
  const loaded = load((c) => {
    c.actions['ashmere_items@0.0.1:action/inspect_inventory'] = {
      key: 'inspect_inventory',
      label: 'item.satchel.short',
      target: { kind: 'entity', scopes: ['inventory'] },
      command: 'look',
      priority: 0,
      input: [],
      policy: { policy_version: 1, root: { op: 'all', items: [] } },
      accessibility: 'item.satchel.short',
    };
    c.manifest.requires.capabilities.policy = c.lock.capabilities.policy = 1;
    const ferry = c.rooms['ashmere_items@0.0.1:room/ferry_landing'];
    ferry.actions = [{ op: 'replace', actions: ['inspect_inventory', 'take'] }];
  }, items);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const w = newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], SEED);
  const look = (target_id: string) => cmd({ type: 'look', target_id });
  const refused = { kind: 'rejected', error: { code: 'unsupported_capability' } };
  assert.deepEqual(step(w, look(SATCHEL)).decision, refused); // in the room, not held
  const held = step(w, cmd({ type: 'take', item_id: SATCHEL })).world;
  assert.equal(step(held, look(SATCHEL)).decision.kind, 'accepted');
  assert.deepEqual(step(held, look(POST)).decision, refused);
});
