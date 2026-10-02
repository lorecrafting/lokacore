// quest@1 delivery in the proposal (Early R7/R8 D1, carry a; 04 §5.2 steps 5-6; 06 §5, §43): a
// queued event delivers to the quest instances it earned at its emission position (active there),
// at its FIFO position, each its own writer group, only to those still active in the proposal so far.
// Worlds are the errand known answer (protocol/fixtures/cartridge_errand_hash.json, quest lantern
// made strict, post_activation_event) with an instance fact and one reaction added, re-hashed
// with node:crypto over their canonical bytes. Writer groups and op order are hand-derived from
// 04 §5.2; ids are IdSource ids over the literal inputs, computed with Python hashlib.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { adopt, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const CMD2 = 'f6a7b8c9-d0e1-8f2a-9b3c-5d6e7f8a9b0c';
const E = 'ashmere_errand@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_errand', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const QUEST = ref('quest', 'lantern');
// IdSource ordinal 0 under CMD in CONTEXT: the instance an accept or a hand-built activation makes.
const ID = 'e2870386-6797-8a1b-8e1a-b2c028c16c49';
const world = (f: (c: any) => void): World => {
  const c = structuredClone(read('protocol/fixtures/cartridge_errand_hash.json').value);
  f(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const quest = (c: any) => c.quests[`${E}:quest/lantern`];
const cmd = (w: World, payload: object): Command =>
  ({
    id: CMD,
    world_context_id: CONTEXT,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
const lantern = (w: World) => w.entityIds[`${E}:item/lantern`];

// A strict errand world with an instance fact `flag` and a reaction setting `seen` when flag
// changes, and a hand-built root of `ops` and its events at the given positions (position 1 left
// free for the fact_changed of a changing assign, as a rule leaves it).
function reacting(f: (c: any) => void = () => {}) {
  const fact = (key: string) => ({
    key,
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['instance'],
    meaning: key,
  });
  return world((c) => {
    quest(c).objective = {
      evidence: 'post_activation_event',
      item_acquired: ref('item', 'lantern'),
    };
    for (const cap of ['fact', 'reaction']) {
      c.lock.capabilities[cap] = 1;
      c.manifest.requires.capabilities[cap] = 1;
    }
    c.facts = { [`${E}:fact/flag`]: fact('flag'), [`${E}:fact/seen`]: fact('seen') };
    c.reactions = {
      [`${E}:reaction/notice`]: {
        key: 'notice',
        on: { event: 'fact_changed', fact: ref('fact', 'flag') },
        apply: [{ op: 'fact.assign', fact: ref('fact', 'seen'), value: true }],
      },
    };
    f(c);
  });
}
const instance = { kind: 'instance', world_context_id: CONTEXT };
const flag = { op: 'fact.assign', writer_group: 0, fact: ref('fact', 'flag'), scope: instance };
const handed = (w: World) => ({
  op: 'entity.transfer',
  writer_group: 0,
  entity_id: lantern(w),
  source_id: w.state.containers[lantern(w)],
  destination_id: w.body,
});
function root(w: World, ops: object[], events: [number, object][]) {
  const ev = events.map(([position, payload]) => ({
    id: `${CMD.slice(0, -1)}${position}`,
    world_context_id: CONTEXT,
    scope: { kind: 'player', character_id: w.character },
    actor_id: w.character,
    logical_time: w.state.clock,
    position,
    causation_id: CMD,
    correlation_id: CMD,
    payload,
  }));
  const d = {
    kind: 'accepted',
    outcome: 'x',
    delta: { ops },
    events: ev,
    effects: [],
    rng: w.state.rng,
  };
  return adopt(w, d as never, cmd(w, {}) as never, () => CMD2, 0).decision as any;
}
const acquired = (w: World) => ({ type: 'item_acquired', item_id: lantern(w), holder_id: w.body });
const groups = (d: any) => d.delta.ops.map((o: any) => [o.op, o.writer_group]);

// Breaks: quest delivery folded at the root again (its group before the reaction's), eligibility
// read before the decision (the acquisition at 2 of an instance activated at 1 not delivered),
// an acquisition before the activation in the same sequence credited, or delivery moving an
// instance the root already resolved (conflicting_write).
test('quest delivery runs in FIFO order, to instances active at emission and still active', () => {
  const accepted = step(reacting(), cmd(reacting(), { type: 'accept_quest', quest: QUEST }), 1);
  const w = accepted.world;
  const fifo = root(w, [{ ...flag, expected: false, value: true }, handed(w)], [[2, acquired(w)]]);
  assert.deepEqual(groups(fifo), [
    ['fact.assign', 0],
    ['entity.transfer', 0],
    ['fact.assign', 1], // notice, delivered flag's fact_changed at position 1
    ['quest.transition', 2], // the lantern instance, delivered item_acquired at position 2
  ]);

  const fresh = reacting();
  const scope = { kind: 'player', character_id: fresh.character };
  const activate = { op: 'quest.activate', writer_group: 0, quest: QUEST, scope, instance_id: ID };
  const activated = { type: 'quest_activated', quest: QUEST, instance_id: ID };
  const both = root(
    fresh,
    [activate, handed(fresh)],
    [
      [1, activated],
      [2, acquired(fresh)],
    ],
  );
  // Delivered, its transition (group 1) conflicts with the root's activation (group 0) of the same
  // row (compose: one writer group per target). Open question to the PM: fault, or widen the rule.
  assert.deepEqual(both, {
    kind: 'fault',
    code: 'conflicting_write',
    target: { kind: 'quest', instance_id: ID },
  });
  const early = root(
    fresh,
    [activate, handed(fresh)],
    [
      [1, acquired(fresh)],
      [2, activated],
    ],
  );
  assert.deepEqual(groups(early), [
    ['quest.activate', 0],
    ['entity.transfer', 0],
  ]);

  const id = Object.keys(w.state.quests!)[0];
  const t = { op: 'quest.transition', writer_group: 0, instance_id: id };
  const resolve = [
    { ...t, from: 'active', to: 'objectives_complete' },
    { ...t, from: 'objectives_complete', to: 'resolved', outcome: 'carry' },
  ];
  const resolved_ = { type: 'quest_resolved', quest: QUEST, instance_id: id, outcome: 'carry' };
  const done = root(
    w,
    [...resolve, handed(w)],
    [
      [1, resolved_],
      [2, acquired(w)],
    ],
  );
  assert.equal(done.kind, 'accepted', JSON.stringify(done));
  assert.deepEqual(groups(done), [
    ['quest.transition', 0],
    ['quest.transition', 0],
    ['entity.transfer', 0],
  ]);
});

// Breaks (04 §5.4): quest deliveries not counted toward the deliveries budget. 1024 flag changes
// each delivered to 8 empty rules are 8192 deliveries, the limit; the lantern's one more exceeds it.
test('a quest delivery counts toward the deliveries budget', () => {
  const w0 = reacting((c) => {
    c.reactions = {};
    for (let i = 0; i < 8; i++)
      c.reactions[`${E}:reaction/r${i}`] = {
        key: `r${i}`,
        on: { event: 'fact_changed', fact: ref('fact', 'flag') },
        apply: [],
      };
  });
  const w = step(w0, cmd(w0, { type: 'accept_quest', quest: QUEST }), 1).world;
  const changed = { type: 'fact_changed', fact: ref('fact', 'flag'), old: false, new: true };
  const flags = Array.from({ length: 1024 }, (_, i) => [i + 1, changed] as [number, object]);
  assert.equal(root(w, [], flags).kind, 'accepted');
  const over = root(w, [handed(w)], [...flags, [1025, acquired(w)]]);
  assert.deepEqual([over.kind, over.code], ['fault', 'budget_exceeded']);
});

// Breaks (04 §5.2 step 5, §5.4): a delivery charged only when its instance is still active, or
// eligibility read after the root's ops instead of at the event's position. Nine strict quests
// active; the root resolves the lantern's. Resolved at 1, then 1024 acquisitions: 8 × 1024 = 8192
// deliveries, the limit. An acquisition at 1 (all nine eligible), resolved at 2, then 1023 more:
// 9 + 8 × 1023 = 8193, over it.
test('every delivery eligible at emission counts toward the deliveries budget', () => {
  const w0 = reacting((c) => {
    for (let i = 1; i < 9; i++) c.quests[`${E}:quest/q${i}`] = { ...quest(c), key: `q${i}` };
  });
  const keys = ['lantern', ...Array.from({ length: 8 }, (_, i) => `q${i + 1}`)];
  const w = keys.reduce((w, key, i) => {
    const accept = {
      ...cmd(w, { type: 'accept_quest', quest: ref('quest', key) }),
      id: `${CMD.slice(0, -1)}${i}`,
    };
    return step(w, accept as Command, i + 1).world;
  }, w0);
  assert.equal(Object.values(w.state.quests!).filter((q) => q.state === 'active').length, 9);
  const id = Object.keys(w.state.quests!).find((i) => w.state.quests![i]!.quest.key === 'lantern');
  const t = { op: 'quest.transition', writer_group: 0, instance_id: id };
  const resolve = [
    { ...t, from: 'active', to: 'objectives_complete' },
    { ...t, from: 'objectives_complete', to: 'resolved', outcome: 'carry' },
  ];
  const resolved_ = { type: 'quest_resolved', quest: QUEST, instance_id: id, outcome: 'carry' };
  const acq = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => [from + i, acquired(w)] as [number, object]);
  const at = root(w, resolve, [[1, resolved_], ...acq(2, 1024)]);
  assert.equal(at.kind, 'accepted', JSON.stringify(at.code));
  const over = root(w, resolve, [[1, acquired(w)], [2, resolved_], ...acq(3, 1023)]);
  assert.deepEqual([over.kind, over.code], ['fault', 'budget_exceeded']);
});
