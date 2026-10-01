// quest@1 (Early R7/R8 Q; 06 §1-§5, §43; 04 §5.2): accept_quest through the offer, the two
// evidence policies, delivery, resolution, quest_state, the journal and the loader's quest
// checks. Worlds are the errand known answer (protocol/fixtures/cartridge_errand_hash.json: Bram
// and the player at the ferry landing, the lantern on the village green to the north, quest
// lantern with a current_state has_item objective, the landing's description variant on
// quest_state active), variants re-hashed with node:crypto over sorted-key JSON.stringify.
// Outcome codes and quest states are the frozen Lantern answers
// (docs/spec/conformance/lantern-traces.json, adverse-cases.json early-possession) or
// hand-derived from 06 §1 and the module headers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DecisionResult, DefinitionRef } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { decode, encode } from '../src/canonical.ts';
import { identify, resolve } from '../src/invocation.ts';
import { holds } from '../src/policy.ts';
import { resolution } from '../src/quest.ts';
import { admit, adopt, gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const E = 'ashmere_errand@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_errand', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const QUEST = ref('quest', 'lantern');
const STRICT = { evidence: 'post_activation_event', item_acquired: ref('item', 'lantern') };

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
const load = (f: (c: any) => void, installed = INSTALLED) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_errand_hash.json').value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  return loadCartridge(bytes, installed);
};
const world = (f: (c: any) => void = () => {}): World => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const quest = (c: any) => c.quests[`${E}:quest/lantern`];
const strict = () => world((c) => (c.quests[`${E}:quest/lantern`].objective = STRICT));
const cmd = (w: World, payload: object, id = CMD): Command =>
  ({
    id,
    world_context_id: CONTEXT,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
const ACCEPT = { type: 'accept_quest', quest: QUEST };
// IdSource ordinal 0 of the accept under CMD (and CMD2) in CONTEXT: the first 16 bytes of SHA-256
// over ["loka-id-v1",CONTEXT,CMD,0] as a UUIDv8, computed with Python hashlib (numeric profile).
const ID = 'e2870386-6797-8a1b-8e1a-b2c028c16c49';
const CMD2 = 'f6a7b8c9-d0e1-8f2a-9b3c-5d6e7f8a9b0c';
const ID2 = 'c90fc0ec-5e30-89fa-a48a-1f45508f8e05';
const lantern = (w: World) => w.entityIds[`${E}:item/lantern`];
const take = (w: World) => ({ type: 'take', item_id: lantern(w) });
const drop = (w: World) => ({ type: 'drop', item_id: lantern(w) });
const move = (direction: string) => ({ type: 'move', direction });
const give = (w: World) => ({
  type: 'give',
  item_id: lantern(w),
  recipient_id: w.entityIds[`${E}:npc/bram`],
});
// Runs payloads (or a function of the world before it) in order, each accepted; returns the
// last world and decision.
const run = (w: World, ...ps: (object | ((w: World) => object))[]) =>
  ps.reduce(
    ({ world: at }: { world: World; decision?: DecisionResult }, p) => {
      const s = step(at, cmd(at, typeof p === 'function' ? p(at) : p), 0);
      assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
      return s;
    },
    { world: w },
  );
const after = (w: World, ...ps: (object | ((w: World) => object))[]) => run(w, ...ps).world;
const refused = (w: World, p: object, code: string) => {
  const s = step(w, cmd(w, p), 0);
  assert.deepEqual(s.decision, { kind: 'rejected', error: { code } }, JSON.stringify(p));
  assert.equal(s.world, w);
};
const state = (w: World) => Object.values(w.state.quests ?? {}).map((q) => q.state);
const is = (w: World, s: string) =>
  holds(w, w.character, { op: 'quest_state', quest: QUEST, state: s as never });
const outcome = (d?: DecisionResult) => (d?.kind === 'accepted' ? d.outcome : d?.kind);
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

// Breaks: accept without its quest.activate or its quest_activated (or with two instance ids),
// the instance at a scope other than the actor's, or quest_state ignoring the state it asks for.
test('accept activates the quest: one quest.activate and its quest_activated', () => {
  const w = world();
  assert.deepEqual(state(w), []);
  for (const s of ['active', 'objectives_complete', 'resolved']) assert.equal(is(w, s), false);
  const { world: next, decision: d } = run(w, ACCEPT);
  assert.ok(d?.kind === 'accepted');
  assert.equal(d.outcome, 'activated'); // lantern-traces.json step accept
  const scope = { kind: 'player', character_id: w.character };
  assert.deepEqual(plain(d.delta.ops), [
    { op: 'quest.activate', writer_group: 0, quest: QUEST, scope, instance_id: ID },
  ]);
  assert.deepEqual(plain(d.events.map((e) => [e.position, e.payload])), [
    [1, { type: 'quest_activated', quest: QUEST, instance_id: ID }],
  ]);
  assert.deepEqual(plain(next.state.quests), {
    [ID]: { quest: QUEST, scope, state: 'active' },
  });
  assert.equal(is(next, 'active'), true);
  assert.equal(is(next, 'resolved'), false);
});

// Breaks: a second activation admitted (or faulting instead of refused), or a forged accept of a
// quest the cartridge does not declare reaching the rule or refused as anything but not_found
// (perform's code for a recipe it does not declare).
test('a second accept and an accept of an undeclared quest are refused', () => {
  const accepted = after(world(), ACCEPT);
  refused(accepted, ACCEPT, 'unsupported_capability');
  refused(world(), { ...ACCEPT, quest: ref('quest', 'missing') }, 'not_found');
  refused(world(), { ...ACCEPT, quest: ref('item', 'lantern') }, 'not_found');
});

// Breaks: the offer not resolving to accept_quest of its quest (the frozen accept request carries
// no input), or still offered once the actor has an instance.
test('the offer is a place action that resolves to accept_quest and is withdrawn after', () => {
  const w = world();
  const offer = { action_key: 'lantern', label: 'quest.lantern.accept', target: { kind: 'none' } };
  assert.deepEqual(plain(gameView(w).actions.find((a) => a.action_key === 'lantern')), {
    available: true,
    ...offer,
    input: [],
  });
  const value = {
    invocation_id: CMD,
    actor_id: w.character,
    action_key: 'lantern',
    target_ids: [],
    input: {},
  };
  const id = identify('scope', w.character, value);
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') return;
  const c = resolve(w, id) as Command;
  assert.deepEqual(plain(c.payload), { type: 'accept_quest', actor_id: w.character, quest: QUEST });
  const next = step(w, c, 0).world;
  assert.equal(
    gameView(next).actions.some((a) => a.action_key === 'lantern'),
    false,
  );
  assert.deepEqual(resolve(next, id), {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
});

// Breaks: the offer's policy ignored by admission or by the GameView.
test('an offer whose policy fails is listed unavailable and accept is invalid_state', () => {
  const never = { policy_version: 1, root: { op: 'not', item: { op: 'all', items: [] } } };
  const w = world((c) => (c.quests[`${E}:quest/lantern`].offer.policy = never));
  const listed = gameView(w).actions.find((a) => a.action_key === 'lantern');
  assert.deepEqual(plain(listed && 'reason' in listed && listed.reason), { code: 'invalid_state' });
  refused(w, ACCEPT, 'invalid_state');
});

// Breaks: the wrong evidence policy at activation: a current_state objective not credited for a
// lantern already held, or a post_activation_event one credited for an acquisition before it.
test('activation credits current possession under current_state only', () => {
  const holding = (w: World) => after(w, move('north'), take, move('south'));
  const current = run(holding(world()), ACCEPT);
  assert.equal(outcome(current.decision), 'activated_with_possession'); // early-possession
  assert.deepEqual(state(current.world), ['active']);
  const strictly = run(holding(strict()), ACCEPT);
  assert.equal(outcome(strictly.decision), 'activated'); // Tiny preactivation-event-credit
  assert.deepEqual(state(strictly.world), ['active']);
});

// Breaks: a current_state objective stored as objectives_complete (the frozen traces keep the
// quest active with the lantern held), or a post_activation_event one not completed by the
// actor's acquisition after activation in that same decision.
test('a post-activation acquisition completes a strict objective; current state stores nothing', () => {
  const current = after(world(), ACCEPT, move('north'), take);
  assert.deepEqual(state(current), ['active']); // lantern-traces.json steps take to talk
  const { world: done, decision } = run(after(strict(), ACCEPT, move('north')), take);
  assert.deepEqual(state(done), ['objectives_complete']);
  assert.equal(is(done, 'objectives_complete'), true);
  const [, transition] = (decision as any).delta.ops;
  assert.deepEqual(plain(transition), {
    op: 'quest.transition',
    writer_group: 1,
    instance_id: ID,
    from: 'active',
    to: 'objectives_complete',
  });
});

// Breaks: an acquisition before activation replayed into progress, or another holder's
// item_acquired (a give to Bram) credited to the actor.
test('neither an earlier acquisition nor a give to someone else completes a strict objective', () => {
  const early = after(strict(), move('north'), take, move('south'), ACCEPT);
  assert.deepEqual(state(early), ['active']);
  assert.deepEqual(state(after(early, give)), ['active']);
  assert.deepEqual(state(after(early, drop, take)), ['objectives_complete']);
});

// Resolves the actor's lantern quest with `outcome` as the resolving rule would (quest.ts
// resolution; a choice in slice D): its ops and quest_resolved, admitted and composed.
function resolved(w: World, out = 'carry') {
  const r = resolution(w, w.character, QUEST, out as never, 0);
  if (typeof r === 'string') return r;
  const c = cmd(w, ACCEPT);
  const ev = {
    id: CMD,
    world_context_id: CONTEXT,
    scope: { kind: 'player', character_id: w.character },
    actor_id: w.character,
    logical_time: 0,
    position: 1,
    causation_id: CMD,
    correlation_id: CMD,
    payload: r.payload,
  };
  const d = {
    kind: 'accepted',
    outcome: out,
    delta: { ops: r.ops },
    events: [ev],
    effects: [],
    rng: w.state.rng,
  };
  const s = adopt(w, admit('quest', d as never), c as never, () => CMD, 0);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
}

// Breaks: resolution without the objective re-checked now (06 §43: a historical acquisition never
// authorizes giving an item no longer held), from an absent or already resolved instance, or a
// sequence that does not compose (06 §1 has no active -> resolved).
test('resolution re-checks current possession and resolves an open instance once', () => {
  assert.equal(resolved(world()), 'invalid_state'); // no instance
  const accepted = after(world(), ACCEPT, move('north'));
  assert.equal(resolved(accepted), 'quest_requirement');
  assert.equal(resolved(after(accepted, take, drop)), 'quest_requirement');
  const done = resolved(after(accepted, take)) as World;
  assert.deepEqual(plain(Object.values(done.state.quests!)), [
    {
      quest: QUEST,
      scope: { kind: 'player', character_id: done.character },
      state: 'resolved',
      outcome: 'carry',
    },
  ]);
  assert.equal(is(done, 'resolved'), true);
  assert.equal(is(done, 'active'), false);
  assert.equal(resolved(done, 'leave'), 'invalid_state');
  refused(done, ACCEPT, 'unsupported_capability');
});

// Breaks: a strict objective resolved while only active (the lantern held since before
// activation), or one completed by its event not resolvable; delivery to an instance no longer
// active (a re-take after objectives_complete or resolved then faults precondition_failed).
test('a strict objective resolves only once its event completed it', () => {
  const early = after(strict(), move('north'), take, ACCEPT);
  assert.equal(resolved(early), 'quest_requirement');
  const complete = after(early, drop, take, drop, take);
  assert.deepEqual(state(complete), ['objectives_complete']);
  assert.deepEqual(state(after(resolved(complete) as World, drop, take)), ['resolved']);
  // The current contract: a strict objective stays met once complete, custody lost or not; the
  // resolving rule (slice D) checks custody and presence before it calls resolution.
  assert.equal(
    typeof resolution(after(complete, drop), early.character, QUEST, 'carry' as never, 0),
    'object',
  );
  const r = resolution(after(early, drop, take), early.character, QUEST, 'carry' as never, 0);
  assert.equal(
    typeof r === 'string'
      ? r
      : plain(r.ops)
          .map((o: any) => [o.from, o.to])
          .join(),
    'objectives_complete,resolved',
  );
});

// Breaks (the brief's trap): quest@1 installed without its quest_state leaf (the GameView throws)
// or the leaf without the rule (the cartridge does not load), or the variant ignoring the state.
test('a cartridge using quest_state loads and its description follows the quest', () => {
  const w = world();
  assert.equal(gameView(w).place.description.key, 'room.ferry_landing.description');
  const accepted = after(w, ACCEPT);
  assert.equal(gameView(accepted).place.description.key, 'room.ferry_landing.waiting');
  assert.equal(
    gameView(resolved(after(accepted, move('north'), take, move('south'))) as World).place
      .description.key,
    'room.ferry_landing.description',
  );
});

// Breaks: the journal missing an instance, its state or its title, or listing another actor's.
test('the journal lists the player quest with its state and title', () => {
  const entry = (s: string) => [{ quest: QUEST, state: s, title: 'quest.lantern.title' }];
  assert.deepEqual(gameView(world()).journal, []);
  const w = after(world(), ACCEPT);
  assert.deepEqual(plain(gameView(w).journal), entry('active'));
  const other = { ...w, character: CMD as World['character'] };
  assert.deepEqual(gameView(other).journal, []);
});

const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
  suggested: string[] = [],
  installed = INSTALLED,
) =>
  assert.deepEqual(load(f, installed), {
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
const Q = `.cartridge.quests["${E}:quest/lantern"]`;
const unlock = (c: any, cap: string) => {
  delete c.manifest.requires.capabilities[cap];
  delete c.lock.capabilities[cap];
};

// Breaks: the loader admitting what the compiler rejects (test/loka/content_errand_test.exs):
// the kernel would read a quest, item or text that does not exist, run a quest whose capability
// is not locked or not installed, or list an offer under another action's key.
test('the loader checks quest references, texts, keys and the lock', () => {
  const variant = `.cartridge.rooms["${E}:room/ferry_landing"].variants[0].when.root.quest`;
  const missing = `${E}:quest/missing`;
  fails(
    (c) => (c.rooms[`${E}:room/ferry_landing`].variants[0].when.root.quest.key = 'missing'),
    'UNRESOLVED_REFERENCE',
    variant,
    { target: missing },
  );
  fails(
    (c) => (quest(c).objective = { ...STRICT, item_acquired: ref('item', 'oil') }),
    'UNRESOLVED_REFERENCE',
    `${Q}.objective.item_acquired`,
    { target: `${E}:item/oil` },
  );
  fails(
    (c) => (quest(c).objective.policy.root.item.key = 'oil'),
    'UNRESOLVED_REFERENCE',
    `${Q}.objective.policy.root.item`,
    { target: `${E}:item/oil` },
  );
  fails(
    (c) => (quest(c).offer.policy.root = { op: 'has_item', item: ref('item', 'oil') }),
    'UNRESOLVED_REFERENCE',
    `${Q}.offer.policy.root.item`,
    { target: `${E}:item/oil` },
  );
  fails((c) => (quest(c).title = 'quest.none'), 'UNRESOLVED_REFERENCE', `${Q}.title`, {
    target: 'quest.none',
  });
  fails((c) => (quest(c).offer.label = 'quest.none'), 'UNRESOLVED_REFERENCE', `${Q}.offer.label`, {
    target: 'quest.none',
  });
  const renamed = (key: string) => (c: any) => {
    c.quests = { [`${E}:quest/${key}`]: { ...quest(c), key } };
    c.rooms[`${E}:room/ferry_landing`].variants[0].when.root.quest.key = key;
  };
  fails(renamed('take'), 'DUPLICATE_DEFINITION', `.cartridge.quests["${E}:quest/take"]`);
  const look = { target: { kind: 'none' }, command: 'look', priority: 0, input: [] };
  const always = { policy_version: 1, root: { op: 'all', items: [] } };
  const label = { label: 'quest.lantern.accept', accessibility: 'quest.lantern.accept' };
  const action = { key: 'lantern', ...label, ...look, policy: always };
  fails((c) => (c.actions[`${E}:action/lantern`] = action), 'DUPLICATE_DEFINITION', Q);
  const recipe = (c: any) => {
    for (const m of [c.manifest.requires.capabilities, c.lock.capabilities])
      Object.assign(m, { action_recipe: 1, inspectable_detail: 1 });
    const landing = c.rooms[`${E}:room/ferry_landing`];
    landing.details = { post: { aliases: ['post'], description: 'quest.lantern.title' } };
    const target = { kind: 'detail', room: ref('room', 'ferry_landing'), detail: 'post' };
    const success = {
      sequence: [{ op: 'event.emit', event: 'rang' }],
      narration: { actor: 'quest.lantern.title' },
    };
    const r = { key: 'lantern', label: 'quest.lantern.accept', aliases: ['lantern'], target };
    c.recipes = {
      [`${E}:recipe/lantern`]: { ...r, priority: 0, policy: always, outcomes: { success } },
    };
  };
  fails(recipe, 'DUPLICATE_DEFINITION', Q);
  fails((c) => unlock(c, 'quest'), 'UNDECLARED_CAPABILITY', `${Q}`, { capability: 'quest' }, [
    'quest@1',
  ]);
  const without = { ...INSTALLED, capabilities: { ...INSTALLED.capabilities } };
  delete without.capabilities.quest;
  fails(
    () => {},
    'CAPABILITY_NOT_INSTALLED',
    '.cartridge.lock.capabilities.quest',
    {
      capability: 'quest@1',
    },
    [],
    without,
  );
  const contributed = world((c) => {
    c.rooms[`${E}:room/ferry_landing`].actions = [{ op: 'replace', actions: ['lantern'] }];
  });
  assert.deepEqual(
    gameView(contributed).actions.map((a) => a.action_key),
    ['lantern'],
  );
});

// Breaks (04 §5.2 step 6): deliveries ordered by stored row order, so the same canonical state
// restored from a save (rows in instance-id order) gives other writer groups.
test('two strict quests on one item complete in quest order, also after a restore', () => {
  const w = world((c) => {
    quest(c).objective = STRICT;
    c.quests[`${E}:quest/shed`] = { ...quest(c), key: 'shed' };
  });
  const accepted = after(w, ACCEPT, move('north'));
  const both = step(
    accepted,
    cmd(accepted, { ...ACCEPT, quest: ref('quest', 'shed') }, CMD2),
    0,
  ).world;
  const restored = {
    ...both,
    state: decode(encode(both.state as never)) as unknown as World['state'],
  };
  for (const at of [both, restored]) {
    const d = step(at, cmd(at, take(at)), 0).decision as any;
    assert.deepEqual(
      d.delta.ops.slice(1).map((o: any) => [o.instance_id, o.writer_group]),
      [
        [ID, 1], // quest/lantern
        [ID2, 2], // quest/shed
      ],
    );
  }
});

// A strict errand world with an instance fact `flag` and a reaction setting `seen` when flag
// changes, and a hand-built root of `ops` and its events at the given positions (position 1 left
// free for the fact_changed of a changing assign, as a rule leaves it).
function reacting() {
  const fact = (key: string) => ({
    key,
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['instance'],
    meaning: key,
  });
  return world((c) => {
    quest(c).objective = STRICT;
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

// Breaks: quest delivery folded at the root again (its group before the reaction's), delivery
// crediting an instance this decision activated (the p.world half dropped), or delivery moving an
// instance the root already resolved (the now half dropped: conflicting_write).
test('quest delivery runs in FIFO order after the root, only to instances active before and now', () => {
  const w = after(reacting(), ACCEPT);
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
  assert.deepEqual(groups(both), [
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
