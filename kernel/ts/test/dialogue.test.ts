// dialogue@1 (Early R7/R8 D1; 06 §17, §33, §37, §43; 04 §5.3): talk, choose and close_choice, the
// pending choice in the GameView, the opened_revision stamp, and the loader's dialogue checks.
// Worlds are the ferry known answer (protocol/fixtures/cartridge_ferry_hash.json: 06:00, the
// player, Bram and the lantern at the landing; Bram to the green at 19:00; quest lantern with a
// current_state has_item objective; Bram's dialogue, talk while the quest is active, roles bram
// and lantern, carry setting search_plan player_led, leave setting party_led and handing the
// lantern to Bram), variants re-hashed with node:crypto over their canonical bytes. Ids are
// IdSource ids over the literal inputs, computed with Python hashlib (numeric profile); codes and
// outcomes are the frozen Lantern answers (docs/spec/conformance/adverse-cases.json) or the brief.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DecisionResult, DefinitionRef } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { decide } from '../play/run.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const F = 'ashmere_ferry@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_ferry', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
// Fresh-world ids under the nil CommandId: ordinal 0 the actor, 1 its body, 3 the green, 5 Bram,
// 6 the lantern.
const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157';
const GREEN = '91fde0fc-dd14-846f-826e-245e45d16ec7';
const BRAM = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const LANTERN = '6a70d262-b6ea-8b64-9809-ec7f79d1521e';
// Commands, and ordinal 0 under ACCEPT (the quest instance), TALK and TALK2 (the continuations).
const id = (n: number) => `e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9${n}`;
const [ACCEPT, TAKE, TALK, TALK2, OTHER] = [1, 2, 3, 4, 5].map(id);
const INSTANCE = '10c2c79a-682c-8231-ba2f-73718902f211';
const C = '5cbbbaa2-df2b-868e-bbe9-9a2ba820064b';
const C2 = 'cdcfdf14-cd24-88f6-8101-205b26292a0d';

const load = (f: (c: any) => void) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  f(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  return loadCartridge(new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`), {
    ...INSTALLED,
  });
};
const world = (f: (c: any) => void = () => {}): World => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const cmd = (payload: object, cid = OTHER): Command =>
  ({ id: cid, world_context_id: CONTEXT, payload: { actor_id: ACTOR, ...payload } }) as Command;
const accept = { type: 'accept_quest', quest: ref('quest', 'lantern') };
const take = { type: 'take', item_id: LANTERN };
const drop = { type: 'drop', item_id: LANTERN };
const talk = { type: 'talk', target_id: BRAM };
const choose = (choice_id: string, continuation_id = C) => ({
  type: 'choose',
  choice_id,
  continuation_id,
});
const close = (continuation_id = C) => ({ type: 'close_choice', continuation_id });
const wait = { type: 'wait', until: 19 * 3600 };
// Steps `payload` as the commit at `revision`; asserts it accepted.
const ok = (w: World, payload: object, revision: number, cid = OTHER) => {
  const s = step(w, cmd(payload, cid), revision);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s as { world: World; decision: Extract<DecisionResult, { kind: 'accepted' }> };
};
const refused = (w: World, payload: object, code: string) => {
  const s = step(w, cmd(payload), 9);
  assert.deepEqual(s.decision, { kind: 'rejected', error: { code } }, JSON.stringify(payload));
  assert.equal(s.world, w);
};
// The ferry after accept (revision 1), take (2) and talk (3).
const held = () => ok(ok(world(), accept, 1, ACCEPT).world, take, 2, TAKE).world;
const talked = () => ok(held(), talk, 3, TALK).world;
const quest = (w: World) => w.state.quests![INSTANCE]!.state;
const events = (d: Extract<DecisionResult, { kind: 'accepted' }>) =>
  d.events.map((e) => [e.position, e.payload.type]);

// Breaks: talk opening no continuation, another occurrence id than the command's ordinal 0,
// roles by another order or re-resolved later, or a talk with no stamp of the revision it commits
// at (choose would then fault precondition_failed).
test('talk opens one pending choice bound to EntityIds, stamped with its revision', () => {
  const { decision, world: w } = ok(held(), talk, 3, TALK);
  assert.equal(decision.outcome, 'choice_opened');
  assert.deepEqual(decision.delta.ops, [
    {
      op: 'choice.open',
      writer_group: 0,
      continuation_id: C,
      actor_id: ACTOR,
      source: ref('dialogue', 'bram'),
      beat: 'bram',
      roles: [
        { role: 'bram', entity_id: BRAM },
        { role: 'lantern', entity_id: LANTERN },
      ],
      choice_ids: ['carry', 'leave'],
    },
  ]);
  assert.deepEqual(
    decision.events.map((e) => e.payload),
    [{ type: 'choice_opened', continuation_id: C }],
  );
  assert.deepEqual(decision.narration ?? [], []);
  assert.equal(w.state.choices![C]!.opened_revision, 3);
});

// Breaks: every accepted action copying the choices map (O(choice history) per step).
test('an action that opens no choice shares the choices map', () => {
  const w = talked();
  assert.equal(ok(w, { type: 'look' }, 4).world.state.choices, w.state.choices);
});

// Breaks: loka play's host not passing the revision its commit takes (its choose would fault).
test('under loka play the stamp is the run revision and choose is accepted', () => {
  const r = {
    ids: { content_hash: '', kernel_version: '', seed: [1, 2, 3, 4], run_id: '' },
    world: world(),
    ordinal: 0,
    revision: 0,
  };
  for (const [p, cid] of [
    [accept, ACCEPT],
    [take, TAKE],
    [talk, TALK],
  ] as const)
    decide(r, cmd(p, cid));
  assert.equal(r.world.state.choices![C]!.opened_revision, 3);
  assert.equal(decide(r, cmd(choose('carry'))).decision.kind, 'accepted');
});

// Breaks: the view and choose disagreeing on custody (06 §43), or a choice unseen while pending.
test('the GameView shows the pending choice; a dropped lantern makes both options unavailable', () => {
  const w = talked();
  const labels = (available: boolean, extra = {}) =>
    ['carry', 'leave'].map((choice_id) => ({
      available,
      choice_id,
      label: `dialogue.bram.${choice_id}`,
      ...extra,
    }));
  assert.deepEqual(gameView(w).choice, {
    continuation_id: C,
    speaker_id: BRAM,
    prompt: { key: 'dialogue.bram.prompt' },
    closable: true,
    choices: labels(true),
  });
  const dropped = ok(w, drop, 4).world;
  assert.deepEqual(
    gameView(dropped).choice?.choices,
    labels(false, { reason: { code: 'not_owned' } }),
  );
  assert.ok(!gameView(w).actions.some((a) => ['choose', 'close_choice'].includes(a.action_key)));
});

// Breaks: a talk advertised on every NPC in the room though it accepts only its speaker, or
// admitted for another NPC (actions.ts accepts; the rule would then answer invalid_state).
test('the talk is listed on and accepts its speaker only', () => {
  const w = world((c) => {
    const npc = c.npcs[`${F}:npc/bram`];
    c.npcs[`${F}:npc/ada`] = { ...npc, key: 'ada', keywords: ['ada'] };
    delete c.npcs[`${F}:npc/ada`].daily_schedule;
  });
  const talks = (name: string) =>
    gameView(w)
      .entities.filter((e) => e.kind === 'npc' && e.id === w.entityIds[`${F}:npc/${name}`])
      .flatMap((e) => e.actions.map((a) => a.action_key));
  assert.deepEqual([talks('bram'), talks('ada')], [['bram'], []]);
  refused(w, { type: 'talk', target_id: w.entityIds[`${F}:npc/ada`] }, 'unsupported_capability');
});

const talkView = (w: World, key = 'bram') =>
  gameView(w)
    .entities.find((e) => e.id === BRAM)!
    .actions.filter((a) => a.action_key === key)
    .map((a) => ('reason' in a ? [a.available, a.reason] : [a.available]));
const unavailable = [[false, { code: 'invalid_state' }]];

// Breaks (Decision 9): Bram's talk offered, or a choice opened, before the quest is accepted or
// after it resolves (the talk's policy ignored in the ActionSet and the view).
test('talk is unavailable and refused before accepting and after resolving', () => {
  const resolved = ok(talked(), choose('leave'), 4).world;
  for (const w of [world(), resolved]) {
    assert.deepEqual(talkView(w), unavailable);
    refused(w, talk, 'invalid_state');
  }
  assert.deepEqual(talkView(held()), [[true]]);
});

// Breaks: a talk admitted through another offered talk (Bram's, or a cartridge talk action
// whose own policy holds) opening a dialogue whose policy fails; the rule must enforce it, and
// the view must list such an alias unavailable while the step would refuse it.
test("the rule enforces the target's dialogue policy whatever talk admitted it", () => {
  const ada = world((c) => {
    const npc = c.npcs[`${F}:npc/bram`];
    c.npcs[`${F}:npc/ada`] = { ...npc, key: 'ada', keywords: ['ada'] };
    delete c.npcs[`${F}:npc/ada`].daily_schedule;
    const d = structuredClone(c.dialogues[`${F}:dialogue/bram`]);
    d.key = 'ada';
    d.npc = d.roles.bram.npc = ref('npc', 'ada');
    d.policy.root.state = 'resolved';
    c.dialogues[`${F}:dialogue/ada`] = d;
  });
  const active = ok(ada, accept, 1, ACCEPT).world;
  refused(active, { type: 'talk', target_id: ada.entityIds[`${F}:npc/ada`] }, 'invalid_state');
  const alias = world((c) => {
    c.actions[`${F}:action/chat`] = {
      key: 'chat',
      label: 'action.talk',
      accessibility: 'action.talk',
      target: { kind: 'entity', scopes: ['room_occupants'] },
      command: 'talk',
      priority: 0,
      input: [],
      policy: { policy_version: 1, root: { op: 'all', items: [] } },
    };
  });
  refused(alias, talk, 'invalid_state');
  assert.deepEqual(talkView(alias, 'chat'), unavailable);
  assert.deepEqual(talkView(ok(alias, accept, 1, ACCEPT).world, 'chat'), [[true]]);
});

// Breaks: a room contribution naming a dialogue's talk unresolved by the loader, though its key
// is an ActionSet identity (test/loka/content_ferry_test.exs compiles the same).
test("a room contribution may subtract a dialogue's talk", () => {
  const w = world((c) => {
    c.rooms[`${F}:room/ferry_landing`].actions = [{ op: 'subtract', actions: ['bram'] }];
  });
  assert.deepEqual(talkView(ok(w, accept, 1, ACCEPT).world), []);
});

// Breaks: a consequence, the hand-over, the quest or the choice applied apart (21 §20, 04 §5.3),
// resolution read after the transfer (quest_requirement), or narration re-resolved by name.
test('leave hands the lantern to Bram, sets party_led and resolves quest and choice at once', () => {
  const { decision: d, world: w } = ok(talked(), choose('leave'), 4);
  const decision = JSON.parse(JSON.stringify(d)); // plain objects, as the literals below
  assert.equal(decision.outcome, 'leave');
  const t = { op: 'quest.transition', writer_group: 0, instance_id: INSTANCE };
  assert.deepEqual(decision.delta.ops, [
    {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: LANTERN,
      source_id: BODY,
      destination_id: BRAM,
    },
    {
      op: 'fact.assign',
      writer_group: 0,
      fact: ref('fact', 'search_plan'),
      scope: { kind: 'player', character_id: ACTOR },
      expected: 'undecided',
      value: 'party_led',
    },
    { ...t, from: 'active', to: 'objectives_complete' },
    { ...t, from: 'objectives_complete', to: 'resolved', outcome: 'leave' },
    {
      op: 'choice.resolve',
      writer_group: 0,
      continuation_id: C,
      choice_id: 'leave',
      expected_revision: 3,
    },
  ]);
  assert.deepEqual(events(decision), [
    [1, 'item_acquired'],
    [2, 'fact_changed'],
    [3, 'quest_resolved'],
    [4, 'choice_resolved'],
  ]);
  assert.deepEqual(
    [0, 2, 3].map((i) => decision.events[i]!.payload),
    [
      { type: 'item_acquired', item_id: LANTERN, holder_id: BRAM },
      {
        type: 'quest_resolved',
        quest: ref('quest', 'lantern'),
        instance_id: INSTANCE,
        outcome: 'leave',
      },
      { type: 'choice_resolved', continuation_id: C, choice_id: 'leave' },
    ],
  );
  assert.deepEqual(decision.narration, [
    {
      key: 'narration.bram.leave',
      participants: { actor: BODY, bram: BRAM, lantern: LANTERN },
    },
  ]);
  assert.equal(w.state.containers[LANTERN], BRAM);
  assert.equal(gameView(w).choice, undefined);
});

test('carry keeps the lantern, sets player_led and resolves with outcome carry', () => {
  const { decision, world: w } = ok(talked(), choose('carry'), 4);
  assert.equal(decision.outcome, 'carry');
  assert.deepEqual(
    decision.delta.ops.map((o) => [o.op, 'value' in o ? o.value : 'outcome' in o ? o.outcome : '']),
    [
      ['fact.assign', 'player_led'],
      ['quest.transition', ''],
      ['quest.transition', 'carry'],
      ['choice.resolve', ''],
    ],
  );
  assert.equal(w.state.containers[LANTERN], BODY);
  assert.equal(quest(w), 'resolved');
});

// Breaks (06 §37, §43): close mutating the outcome, or a re-talk reusing the closed occurrence.
test('close changes no outcome; a second talk opens another occurrence', () => {
  const { decision, world: w } = ok(talked(), close(), 4);
  assert.equal(decision.outcome, 'choice_closed');
  assert.deepEqual(decision.delta.ops, [
    { op: 'choice.close', writer_group: 0, continuation_id: C },
  ]);
  assert.equal(quest(w), 'active');
  assert.equal(ok(w, talk, 5, TALK2).decision.delta.ops[0]!.op, 'choice.open');
  assert.equal(gameView(ok(w, talk, 5, TALK2).world).choice?.continuation_id, C2);
});

// Breaks (adverse-cases.json drop-after-choice-opened, moved-bram-rejects-new-choice): choose
// trusting the historical acquisition or Bram's place at talk time, either check missing, or the
// player trapped in the choice.
test('a stale choice revalidates custody and presence; close still works', () => {
  const dropped = ok(talked(), drop, 4).world;
  refused(dropped, choose('leave'), 'not_owned');
  assert.equal(quest(ok(dropped, close(), 5).world), 'active');
  const moved = ok(talked(), wait, 4).world;
  assert.equal(moved.state.containers[BRAM], GREEN);
  refused(moved, choose('leave'), 'not_present');
  refused(moved, choose('carry'), 'not_present');
  ok(moved, close(), 5);
});

// Breaks: a second pending choice, a consumed choice resurrected (06 §43), another actor's or an
// unoffered option chosen, or close of nothing.
test('talk while pending, and choose or close of no pending continuation, are invalid_state', () => {
  const w = talked();
  refused(w, talk, 'invalid_state');
  refused(w, choose('stay'), 'invalid_state');
  refused(w, choose('leave', C2), 'invalid_state');
  const done = ok(w, choose('leave'), 4).world;
  refused(done, choose('leave'), 'invalid_state');
  refused(done, choose('carry'), 'invalid_state');
  refused(done, close(), 'unsupported_capability'); // no pending choice: nothing to close
});

// Breaks (adverse-cases.json early-possession): leave needing an acquisition after acceptance.
test('a lantern taken before accepting still lets leave resolve', () => {
  const w = ok(ok(world(), take, 1, TAKE).world, accept, 2, ACCEPT).world;
  const opened = ok(w, talk, 3, TALK).world;
  assert.equal(quest(ok(opened, choose('leave'), 4).world), 'resolved');
});

// Breaks (06 §43, §33: no silent rebinding): choose resolving a role's entity by its definition
// instead of the row, so a world whose Bram definition now names another entity pins that one.
test('choose pins the row bindings even if the definition would resolve elsewhere', () => {
  const w = talked();
  const rebound = { ...w, entityIds: { ...w.entityIds, [`${F}:npc/bram`]: GREEN as never } };
  const { decision } = ok(rebound, choose('carry'), 4);
  assert.deepEqual(decision.narration?.[0]?.participants, {
    actor: BODY,
    bram: BRAM,
    lantern: LANTERN,
  });
});

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
const D = `.cartridge.dialogues["${F}:dialogue/bram"]`;
const bram = (c: any) => c.dialogues[`${F}:dialogue/bram`];

// Breaks: the loader admitting what the compiler rejects (test/loka/content_ferry_test.exs): the
// kernel would bind a role, speaker or quest that does not exist, hand over through a role of the
// wrong kind, show a missing text, assign an undeclared fact or a wrong value, run a dialogue its
// capability is not locked for, shadow the actor participant, open a choice with no option, list
// a talk under another action's key, or give one NPC two dialogues (talk names only its target).
test('the loader checks dialogue references, roles, texts, facts, keys and the lock', () => {
  const missing = (kind: string) => ({ target: `${F}:${kind}/missing` });
  fails(
    (c) => (bram(c).npc = ref('npc', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${D}.npc`,
    missing('npc'),
  );
  fails(
    (c) => (bram(c).roles.lantern.item = ref('item', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${D}.roles.lantern.item`,
    missing('item'),
  );
  fails(
    (c) => (bram(c).quest = ref('quest', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${D}.quest`,
    missing('quest'),
  );
  fails(
    (c) => (bram(c).policy.root.quest = ref('quest', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${D}.policy.root.quest`,
    missing('quest'),
  );
  fails(
    (c) => {
      bram(c).roles.bram = { role: 'item', item: ref('item', 'lantern') };
      delete bram(c).choices.leave.hand_over;
    },
    'UNRESOLVED_REFERENCE',
    `${D}.npc`,
    { target: `${F}:npc/bram` },
  );
  fails(
    (c) => (bram(c).choices.leave.hand_over.item = 'bram'),
    'UNRESOLVED_REFERENCE',
    `${D}.choices.leave.hand_over.item`,
    { target: 'bram' },
  );
  fails(
    (c) => (bram(c).choices.leave.hand_over.to = 'lantern'),
    'UNRESOLVED_REFERENCE',
    `${D}.choices.leave.hand_over.to`,
    { target: 'lantern' },
  );
  fails((c) => (bram(c).prompt = 'dialogue.none'), 'UNRESOLVED_REFERENCE', `${D}.prompt`, {
    target: 'dialogue.none',
  });
  fails(
    (c) => (bram(c).choices.carry.narration = 'dialogue.none'),
    'UNRESOLVED_REFERENCE',
    `${D}.choices.carry.narration`,
    { target: 'dialogue.none' },
  );
  fails(
    (c) => (bram(c).choices.carry.sequence[0].fact = ref('fact', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${D}.choices.carry.sequence[0].fact`,
    missing('fact'),
  );
  fails(
    (c) => (bram(c).choices.carry.sequence[0].value = 'lost'),
    'FACT_TYPE_MISMATCH',
    `${D}.choices.carry.sequence[0].value`,
  );
  fails(
    (c) => (bram(c).roles.actor = { role: 'npc', npc: ref('npc', 'bram') }),
    'DUPLICATE_DEFINITION',
    `${D}.roles.actor`,
  );
  fails((c) => (bram(c).choices = {}), 'SCHEMA_VIOLATION', `${D}.choices`, {
    error: 'too_few_items',
  });
  fails(
    (c) => {
      c.dialogues = { [`${F}:dialogue/lantern`]: { ...bram(c), key: 'lantern' } };
    },
    'DUPLICATE_DEFINITION',
    `.cartridge.dialogues["${F}:dialogue/lantern"]`,
  );
  fails(
    (c) => (c.dialogues[`${F}:dialogue/bram_two`] = { ...bram(c), key: 'bram_two' }),
    'DUPLICATE_DEFINITION',
    `${D}.npc`,
  );
  fails(
    (c) => {
      delete c.manifest.requires.capabilities.dialogue;
      delete c.lock.capabilities.dialogue;
    },
    'UNDECLARED_CAPABILITY',
    D,
    { capability: 'dialogue' },
    ['dialogue@1'],
  );
});
