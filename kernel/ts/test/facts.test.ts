// Typed facts, conditions and description variants (R5 S3; 03 §7, §13; 21 §3.2, §6; 06 §21).
// The world is built from the facts known answer (protocol/fixtures/cartridge_facts_hash.json).
// Ids, fact keys and the state hash are computed in Python (hashlib over the canonical JSON the
// numeric profile defines), never by the kernel; conditions' answers are hand-written. Facts
// are set only through the delta path (admit, then adopt), as a rule will set them.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { hash } from '../src/canonical.ts';
import { key } from '../src/compose.ts';
import type { CharacterId, Command, Policy } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { holds as condition } from '../src/policy.ts';
import { describe } from '../src/rules/description_variant.ts';
import { accepted, allocator, event } from '../src/decision.ts';
import { admit, adopt, gameView, holds, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_facts_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9' as CharacterId; // ordinal 0
const OTHER = 'a7b8c9d0-e1f2-4a3b-9c4d-6e7f8a9b0c1d' as CharacterId; // not in this world
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // 1
const FERRY = '1a7c3699-2844-8a55-b29f-eac079c7bf50'; // 2: rooms in ref order
const MUD = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2'; // 5: the reed path's detail
const SEED = [1, 2, 3, 4];

const bytes = (c: string, h: string) =>
  new TextEncoder().encode(`{"cartridge":${c},"content_hash":"${h}"}`);
const loaded = loadCartridge(bytes(kat.canonical, kat.sha256), INSTALLED);
assert.ok(loaded.ok);
const cartridge = loaded.cartridge as Cartridge;
const fresh = () => newWorld(cartridge, CONTEXT as World['context'], SEED);
const fact = (key: string) => ({
  cartridge_id: 'ashmere_facts',
  cartridge_version: '0.0.1',
  kind: 'fact',
  key,
});
const instance = { kind: 'instance', world_context_id: CONTEXT };
const player = (character_id: string) => ({ kind: 'player', character_id });

const SET = {
  id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
  payload: { actor_id: CHARACTER },
} as never;

// Sets facts as a rule will: an accepted decision with fact.assign ops, admitted, composed and
// adopted (world.ts adopt).
type Assign = [key: string, scope: object, expected: unknown, value: unknown];
function set(w: World, ...assigns: Assign[]): World {
  const ops = assigns.map(([key, scope, expected, value]) => ({
    op: 'fact.assign',
    writer_group: 0,
    fact: fact(key),
    scope,
    expected,
    value,
  }));
  const decision = admit('fact', accepted(w, 'set', ops as never, []) as never);
  const { decision: d, world } = adopt(w, decision, SET, allocator(w, SET));
  assert.equal(d.kind, 'accepted', JSON.stringify(d));
  return world;
}
const rescued = (w: World) => set(w, ['village_child_status', instance, 'missing', 'rescued']);
const rung = (w: World) => set(w, ['chapel_bell_rung', instance, false, true]);
const cmd = (payload: object): Command =>
  ({
    id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    world_context_id: CONTEXT,
    payload: { actor_id: CHARACTER, ...payload },
  }) as Command;
const walk = (w: World, ...dirs: string[]) =>
  dirs.reduce((x, direction) => step(x, cmd({ type: 'move', direction })).world, w);
const place = (w: World) => gameView(w).place.description.key;

// Breaks: defaults keyed other than by canonical DefinitionRef text, or a facts section in a
// fresh state (it would change every pre-fact state hash).
test('a fresh world holds each fact default and no fact record', () => {
  const w = fresh();
  assert.deepEqual(w.state, { clock: 0, containers: { [BODY]: FERRY }, rng: SEED });
  const k = (key: string) =>
    `{"cartridge_id":"ashmere_facts","cartridge_version":"0.0.1","key":"${key}","kind":"fact"}`;
  assert.deepEqual(w.factDefaults, {
    [k('chapel_bell_rung')]: false,
    [k('fen_tracks_found')]: false,
    [k('village_child_status')]: 'missing',
  });
});

// Breaks: a fact change not adopted, adopted under another key, or a wrong expected value
// committed instead of faulting (04 §5.1).
test('fact.assign through the delta path commits one record, at the Python state hash', () => {
  const w = rescued(fresh());
  const key =
    '{"fact":{"cartridge_id":"ashmere_facts","cartridge_version":"0.0.1","key":"village_child_status","kind":"fact"},"kind":"fact","scope":{"kind":"instance","world_context_id":"0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f"}}';
  assert.deepEqual(w.state.facts, { [key]: 'rescued' });
  assert.equal(
    hash(w.state as never),
    '66ad4b52f39664f6631b4d1b7310bb9e51d254c9f47aaee114df8e7563c38de3',
  );
  const ops = [
    {
      op: 'fact.assign',
      writer_group: 0,
      fact: fact('chapel_bell_rung'),
      scope: instance,
      expected: true, // the default is false
      value: false,
    },
  ] as never;
  const stale = adopt(
    w,
    admit('fact', accepted(w, 'set', ops, []) as never),
    SET,
    allocator(w, SET),
  );
  assert.deepEqual(stale.decision, {
    kind: 'fault',
    code: 'precondition_failed',
    target: { kind: 'fact', fact: fact('chapel_bell_rung'), scope: instance },
  });
  assert.equal(stale.world, w);
});

const cmp = (key: string, equals: unknown) => ({ op: 'fact_compare', fact: fact(key), equals });
const T = cmp('chapel_bell_rung', true); // holds once rung
const F = cmp('chapel_bell_rung', false); // holds at the default

// Breaks: an operator inverted or short-circuited wrongly, an empty all not true, or a fact
// read from the wrong record or not defaulted.
test('conditions evaluate all, any, not and fact_compare over committed facts', () => {
  const rows: [string, object, boolean, boolean][] = [
    // name, policy, fresh world, after rescued + rung
    ['empty all', { op: 'all', items: [] }, true, true],
    ['all true false', { op: 'all', items: [F, T] }, false, false],
    ['all true', { op: 'all', items: [T] }, false, true],
    ['any', { op: 'any', items: [T, F] }, true, true],
    ['any false', { op: 'any', items: [T] }, false, true],
    ['not', { op: 'not', item: T }, true, false],
    ['enum default', cmp('village_child_status', 'missing'), true, false],
    ['enum set', cmp('village_child_status', 'rescued'), false, true],
    ['enum other', cmp('village_child_status', 'lost'), false, false],
    ['wrong type', cmp('chapel_bell_rung', 'true'), false, false],
  ];
  const [a, b] = [fresh(), rung(rescued(fresh()))];
  for (const [name, p, before, after] of rows)
    assert.deepEqual(
      [condition(a, CHARACTER, p as Policy), condition(b, CHARACTER, p as Policy)],
      [before, after],
      name,
    );
  assert.throws(() => condition(a, CHARACTER, { op: 'target_present' }), /not installed/);
});

// Breaks: variants tried in another order, the last match taken, or no fallback to the base.
test('describe shows the first variant whose condition holds, else the base', () => {
  const v = (root: object, description: string) => ({
    when: { policy_version: 1, root },
    description,
  });
  const of = (...variants: object[]) => ({ description: 'base', variants }) as never;
  const w = fresh();
  assert.equal(describe(w, CHARACTER, of(v(F, 'first'), v(F, 'second'))), 'first');
  assert.equal(describe(w, CHARACTER, of(v(T, 'first'), v(F, 'second'))), 'second');
  assert.equal(describe(w, CHARACTER, of(v(T, 'first'))), 'base');
  assert.equal(describe(w, CHARACTER, { description: 'base' } as never), 'base');
});

// Breaks: the GameView keeps the base description, or does not follow a committed fact.
test("the green's and reed path's descriptions change with the facts", () => {
  const green = (w: World) => place(walk(w, 'north'));
  assert.equal(green(fresh()), 'room.village_green.worried');
  assert.equal(green(rescued(fresh())), 'room.village_green.description');
  assert.equal(green(rung(rescued(fresh()))), 'room.village_green.celebration');
  assert.equal(place(walk(fresh(), 'south')), 'room.reed_path.description');
  assert.equal(place(walk(rung(fresh()), 'south')), 'room.reed_path.flooded');
});

// Breaks: a player fact read at world.character instead of the given actor, or at the instance
// (contract lessons: the actor comes from the command).
test("a player-scoped fact is read at the actor's own scope", () => {
  const w = set(fresh(), ['fen_tracks_found', player(OTHER), false, true]);
  assert.equal(describe(w, CHARACTER, w.details[MUD]), 'detail.mud');
  assert.equal(describe(w, OTHER, w.details[MUD]), 'detail.mud.tracks');
});

// Breaks: facts_typed passes a value of the wrong type, a scope the fact does not allow, or an
// undeclared fact, which composition itself does not check.
test('facts_typed holds for typed facts and fails on each kind of bad record', () => {
  assert.ok(holds('facts_typed', rung(rescued(fresh()))));
  const bad: Assign[] = [
    ['chapel_bell_rung', instance, false, 'yes'],
    ['village_child_status', instance, 'missing', 'found'],
    ['chapel_bell_rung', player(CHARACTER), false, true],
  ];
  for (const [k, scope, , v] of bad) {
    const w = fresh();
    const facts = { [key({ kind: 'fact', fact: fact(k), scope })]: v as never };
    assert.equal(holds('facts_typed', { ...w, state: { ...w.state, facts } }), false);
  }
  const w = rung(fresh());
  const facts = { ...w.cartridge.facts };
  delete facts['ashmere_facts@0.0.1:fact/chapel_bell_rung'];
  assert.equal(holds('facts_typed', { ...w, cartridge: { ...w.cartridge, facts } }), false);
});

// Breaks: an untyped fact committed (03 §7; 04 §5.1: validated before persistence), or a
// partial commit of a decision with one bad assign.
test('a fact.assign its FactSpec does not allow faults precondition_failed', () => {
  const w = fresh();
  const ok = ['village_child_status', instance, 'missing', 'rescued'];
  for (const bad of [
    ['chapel_bell_rung', instance, false, 'yes'],
    ['village_child_status', instance, 'missing', 'found'],
    ['chapel_bell_rung', player(CHARACTER), false, true],
    ['no_such_fact', instance, false, true],
  ]) {
    const ops = [ok, bad].map(([k, scope, expected, value]) => ({
      op: 'fact.assign',
      writer_group: 0,
      fact: fact(k as string),
      scope,
      expected,
      value,
    }));
    const r = adopt(
      w,
      admit('fact', accepted(w, 'set', ops as never, []) as never),
      SET,
      allocator(w, SET),
    );
    const target = { kind: 'fact', fact: fact(bad[0] as string), scope: bad[1] };
    assert.deepEqual(r.decision, { kind: 'fault', code: 'precondition_failed', target });
    assert.equal(r.world, w);
  }
});

// R5 S4, owner decision Q2. Breaks: fact_changed not appended, appended for an assign that
// keeps the value, once per fact instead of per assign, with ids that reuse the rule's
// ordinals, or in the actor's scope instead of the fact's.
test('each fact.assign that changes its fact appends fact_changed after the rule events', () => {
  const w = fresh();
  const assign = (k: string, expected: unknown, value: unknown) => ({
    op: 'fact.assign',
    writer_group: 0,
    fact: fact(k),
    scope: instance,
    expected,
    value,
  });
  const ops = [
    assign('chapel_bell_rung', false, true),
    assign('village_child_status', 'missing', 'missing'),
    assign('chapel_bell_rung', true, false),
  ];
  const mint = allocator(w, SET);
  const own = event(w, SET, mint, 1, {
    type: 'item_acquired',
    item_id: MUD,
    holder_id: BODY,
  } as never);
  const decision = admit('containment', accepted(w, 'x', ops as never, [own]) as never);
  const { decision: d } = adopt(w, decision, SET, mint);
  const changed = (id: string, position: number, old: boolean) => ({
    id,
    world_context_id: CONTEXT,
    scope: instance,
    actor_id: CHARACTER,
    logical_time: 0,
    position,
    causation_id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    correlation_id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    payload: { type: 'fact_changed', fact: fact('chapel_bell_rung'), old, new: !old },
  });
  assert.ok(d.kind === 'accepted');
  assert.deepEqual(d.events, [
    own,
    changed('2ed1ae6f-befe-8e6a-a5b1-bce1b3d1e5d9', 2, false), // ordinal 1, Python
    changed('dc69e85d-a2c1-815e-a631-9c6b94c780d3', 3, true), // ordinal 2
  ]);
});

// The loader on facts and variants (protocol/cartridge.schema.json DiagnosticCode). Mutants
// are re-hashed with node:crypto over sorted-key JSON.stringify (the canonical form for these
// values), never by the kernel; expected diagnostics are hand-written.
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
const load = (f: (c: any) => void) => {
  const c = structuredClone(kat.value);
  f(c);
  const text = JSON.stringify(sorted(c));
  return loadCartridge(bytes(text, createHash('sha256').update(text).digest('hex')), INSTALLED);
};
const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
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
const GREEN = '.cartridge.rooms["ashmere_facts@0.0.1:room/village_green"]';
const REED = '.cartridge.rooms["ashmere_facts@0.0.1:room/reed_path"]';
const room = (c: any, key: string) => c.rooms[`ashmere_facts@0.0.1:room/${key}`];

// Breaks: the kernel would read a fact the cartridge does not declare, or show a raw key.
test("a variant's unknown fact or missing text is UNRESOLVED_REFERENCE", () => {
  fails(
    (c) => (room(c, 'reed_path').details.mud.variants[0].when.root.items[0].fact.key = 'nope'),
    'UNRESOLVED_REFERENCE',
    `${REED}.details.mud.variants[0].when.root.items[0].fact`,
    { target: 'ashmere_facts@0.0.1:fact/nope' },
  );
  fails(
    (c) => (room(c, 'village_green').variants[0].when.root.items[1].fact.kind = 'item'),
    'UNRESOLVED_REFERENCE',
    `${GREEN}.variants[0].when.root.items[1].fact`,
    { target: 'ashmere_facts@0.0.1:item/chapel_bell_rung' },
  );
  fails(
    (c) => delete c.text['room.village_green.worried'],
    'UNRESOLVED_REFERENCE',
    `${GREEN}.variants[1].description`,
    { target: 'room.village_green.worried' },
  );
  fails(
    (c) => delete c.text['detail.mud.tracks'],
    'UNRESOLVED_REFERENCE',
    `${REED}.details.mud.variants[0].description`,
    { target: 'detail.mud.tracks' },
  );
});

// Breaks: a detail, a variant or a variant condition's op loads without its owner locked.
test('details, variants and their ops without their owners locked are UNDECLARED_CAPABILITY', () => {
  const cases = [
    ['inspectable_detail', `${REED}.details.mud`],
    ['description_variant', `${REED}.details.mud.variants[0]`],
    ['policy', `${REED}.details.mud.variants[0].when.root.op`],
    ['fact', `${REED}.details.mud.variants[0].when.root.items[0].op`],
  ];
  for (const [key, path] of cases) {
    const without = (c: any) => {
      delete c.manifest.requires.capabilities[key];
      delete c.lock.capabilities[key];
    };
    fails(without, 'UNDECLARED_CAPABILITY', path, { capability: key }, [`${key}@1`]);
  }
});

// Breaks: this kernel loads a fact it cannot read at one private-world scope.
test('a fact of any scope other than exactly player or instance is FACT_SCOPE_UNSUPPORTED', () => {
  const bell = 'ashmere_facts@0.0.1:fact/chapel_bell_rung';
  for (const scopes of [['party'], ['realm'], ['player', 'instance']])
    fails(
      (c) => (c.facts[bell].scopes = scopes),
      'FACT_SCOPE_UNSUPPORTED',
      `.cartridge.facts["${bell}"].scopes`,
    );
  for (const scopes of [['player'], ['instance', 'instance']])
    assert.ok(load((c) => (c.facts[bell].scopes = scopes)).ok, scopes.join());
});
