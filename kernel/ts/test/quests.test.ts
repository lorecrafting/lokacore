// size: allow 545, quest@1's whole lifecycle and its offer's targets over one artifact loader
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
import { decode, encode } from '../src/foundation/canonical.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { validate } from '../src/foundation/validate.ts';
import { resolved as offered } from '../src/commands/actions.ts';
import { holds } from '../src/mechanics/policy.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import { check } from '../src/runtime/invariants.ts';
import { refString } from '../src/runtime/decision.ts';
import { offerMaps } from '../src/view/invariants_view.ts';
import { resolution } from '../src/mechanics/quest/lifecycle.ts';
import { admit, adopt, gameView, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const E = 'errand_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'errand_sampler', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
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
// (perform's code for a scripted action it does not declare).
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
  const never = { op: 'not', item: { op: 'all', items: [] } };
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

// Breaks: the kernel runs a quest whose capability is not installed, or a room's
// action contribution drops the quest offer (references, texts and keys are the compiler's:
// test/loka/content_errand_test.exs).
test('the loader checks the installed quest capability', () => {
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

// Quest offer target (loka-vx2v; cartridge.md Quest offer target), the NPC half on the errand world
// (the detail half in quest_dialogue.test.ts, on the ferry's fixture).
const onBram = (c: any) => (quest(c).offer.target = { kind: 'npc', npc: ref('npc', 'bram') });
const bramOf = (w: World) => w.entityIds[`${E}:npc/bram`]!;
const invocation = (w: World, target_ids: string[]) => {
  const id = identify('scope', w.character, {
    invocation_id: CMD,
    actor_id: w.character,
    action_key: 'lantern',
    target_ids,
    input: {},
  });
  assert.equal(id.kind, 'identified');
  return id.kind === 'identified' ? resolve(w, id) : undefined;
};
const UNOFFERED = { kind: 'rejected', error: { code: 'unsupported_capability' } };
// No listing anywhere in a valid view, and the invocation and the step refused with these codes.
const withheld = (w: World, code: string) => {
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  assert.ok(!JSON.stringify(v).includes('"action_key":"lantern"'));
  refused(w, ACCEPT, code);
};

// Breaks: an NPC-targeted offer left on the World card, its entry not on the NPC, or a target that
// slips into the invocation (rows 5-6).
test('an offer naming an NPC is on that NPC, invoked with no target and refused with one', () => {
  const w = world(onBram);
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  assert.equal(
    v.actions.some((a) => a.action_key === 'lantern'),
    false,
  );
  const held = v.entities.find((e) => e.id === bramOf(w))!.actions;
  assert.deepEqual(plain(held.filter((a) => a.action_key === 'lantern')), [
    {
      action_key: 'lantern',
      label: 'quest.lantern.accept',
      target: { kind: 'entity', scopes: ['room_occupants'] },
      target_ids: [],
      input: [],
      available: true,
    },
  ]);
  assert.deepEqual(plain((invocation(w, []) as Command).payload), {
    type: 'accept_quest',
    actor_id: w.character,
    quest: QUEST,
  });
  assert.deepEqual(invocation(w, [bramOf(w)]), {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
  const { world: next } = run(w, ACCEPT);
  assert.deepEqual(state(next), ['active']);
  assert.ok(!JSON.stringify(gameView(next).entities).includes('"action_key":"lantern"'));
});

// Breaks: an offer on an NPC who walked away or died stays open from here (row 7).
test('an offer naming an NPC elsewhere or dead is not offered', () => {
  const away = world((c) => {
    onBram(c);
    c.npcs[`${E}:npc/bram`].room = ref('room', 'village_green');
  });
  withheld(away, 'unsupported_capability');
  assert.deepEqual(invocation(away, []), UNOFFERED);
  const dead = world((c) => {
    onBram(c);
    c.npcs[`${E}:npc/bram`].hp = { gain: 0, maximum: 1, minimum: 0, start: 0 };
  });
  withheld(dead, 'unsupported_capability');
});

// Breaks: admission never asks whether the actor can see the NPC the offer is on (row 8).
test('an offer naming a concealed NPC is not listed and accept is invalid_state', () => {
  const w = world(onBram);
  const hidden = ref('status', 'hidden');
  const concealed = {
    ...w,
    cartridge: {
      ...w.cartridge,
      statuses: { [refString(hidden)]: { key: 'hidden', concealment: 'hidden' } },
    },
    state: {
      ...w.state,
      statuses: { [statusKey(bramOf(w), hidden)]: { generation: 1, active: true } },
    },
  } as World;
  withheld(concealed, 'invalid_state');
});

// Breaks: offerMaps not naming a targeted offer, so a World card for it passes the invariant.
test('world_lists_no_fixture_action refuses a targeted offer on the World card', () => {
  const w = world(onBram);
  const v = gameView(w);
  const maps = offerMaps(Object.values(offered(w, w.character)));
  assert.ok(check('world_lists_no_fixture_action', { view: v, ...maps }));
  const held = v.entities.find((e) => e.id === bramOf(w))!.actions;
  const entry = held.find((a) => a.action_key === 'lantern');
  assert.equal(
    check('world_lists_no_fixture_action', { view: { ...v, actions: [entry] }, ...maps }),
    false,
  );
});

// Breaks: gameview_agrees_with_admission false on a legal accept from the NPC's page, or blind to
// an accepted offer the view does not show anywhere.
test('an accept agrees with the view only when an offer is on the page', () => {
  const w = world(onBram);
  const view = gameView(w);
  const command = cmd(w, ACCEPT);
  const { decision } = step(w, command, 0);
  const agrees = (v: unknown) =>
    check('gameview_agrees_with_admission', { view: v, command, decision, words: {} });
  assert.equal(decision.kind, 'accepted');
  assert.ok(agrees(view));
  assert.equal(agrees({ ...view, entities: [] }), false);
});

// Breaks: a target missing a field, carrying another branch's, or an unknown kind passing the contract.
test('an offer target is one of two closed shapes', () => {
  const room = ref('room', 'shed');
  const npc = ref('npc', 'bram');
  let lantern: any;
  load((c) => (lantern = quest(c)));
  const errors = (target: unknown) =>
    validate('QuestDefinition', { ...lantern, offer: { ...lantern.offer, target } });
  assert.deepEqual(errors({ kind: 'detail', room, detail: 'post' }), []);
  assert.deepEqual(errors({ kind: 'npc', npc }), []);
  for (const bad of [
    { kind: 'detail', room },
    { kind: 'detail', detail: 'post' },
    { room, detail: 'post' },
    { kind: 'npc' },
    { npc },
    { kind: 'npc', room, detail: 'post' },
    { kind: 'detail', npc },
    { kind: 'npc', npc, room },
    { kind: 'detail', room, detail: 'post', npc },
  ])
    assert.ok(errors(bad).length, JSON.stringify(bad));
});
