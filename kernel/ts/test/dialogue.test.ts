// size: allow 730, dialogue@1's rule and loader checks, story points included, share the ferry harness
// dialogue@1 (Early R7/R8 D1, D2; 06 §17, §33, §37, §43; 04 §5.3; 23 §3): talk, choose and
// close_choice, the pending choice in the GameView, the opened_revision stamp, the story point a
// choice reaches, and the loader's dialogue and story point checks.
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
import { encode } from '../src/foundation/canonical.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { decide } from '../play/run.ts';
import { key } from '../src/foundation/compose.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
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
// admitted for another NPC (commands/actions.ts accepts; the rule would then answer invalid_state).
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
// resolution read after the transfer (quest_requirement), or narration re-resolved by name; the
// story point (23 §3) missing, of another outcome, or not last (its id minted before another's).
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
    [5, 'story_point_reached'],
  ]);
  // IdSource ordinals under OTHER in Python hashlib: the rule mints 0-3 in emission order (the
  // story point last), then the host its fact_changed (mechanics/fact.ts factChanged), 4.
  assert.deepEqual(
    decision.events.map((e: { id: string }) => e.id),
    [
      '4fa65c39-f532-826c-ad99-19fc63e103cd',
      '904c0c14-d8a7-8010-afd3-8ac607a3e5a1',
      '6fa10ef7-a7f3-872b-ad50-6b1193bf75d5',
      '0d013d13-0a92-89c3-965c-75d8ea4c4f08',
      '7084fb06-0d81-8d3f-81c2-62fd46f06db2',
    ],
  );
  assert.deepEqual(
    [0, 2, 3, 4].map((i) => decision.events[i]!.payload),
    [
      { type: 'item_acquired', item_id: LANTERN, holder_id: BRAM },
      {
        type: 'quest_resolved',
        quest: ref('quest', 'lantern'),
        instance_id: INSTANCE,
        outcome: 'leave',
      },
      { type: 'choice_resolved', continuation_id: C, choice_id: 'leave' },
      {
        type: 'story_point_reached',
        story_point: ref('story_point', 'lantern_resolved'),
        outcome: 'leave',
      },
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

// Breaks: the story point's outcome taken from the first declared outcome, not the choice's.
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
  assert.deepEqual(decision.events.at(-1)!.payload, {
    type: 'story_point_reached',
    story_point: ref('story_point', 'lantern_resolved'),
    outcome: 'carry',
  });
  assert.equal(w.state.containers[LANTERN], BODY);
  assert.equal(quest(w), 'resolved');
});

// Breaks (23 §3, Decision 8): the story point's outcome taken from the choice id rather than its
// declared key, or emitted before choice_resolved when no fact change re-sorts the events.
test('a story point reports its declared outcome key, after choice_resolved', () => {
  const w = world((c) => {
    delete bram(c).choices.carry.sequence;
    const { outcomes } = point(c);
    outcomes.kept = outcomes.carry;
    delete outcomes.carry;
  });
  const t = ok(ok(ok(w, accept, 1, ACCEPT).world, take, 2, TAKE).world, talk, 3, TALK).world;
  const { decision } = ok(t, choose('carry'), 4);
  assert.deepEqual(events(decision), [
    [1, 'quest_resolved'],
    [2, 'choice_resolved'],
    [3, 'story_point_reached'],
  ]);
  assert.deepEqual(decision.events[2]!.payload, {
    type: 'story_point_reached',
    story_point: ref('story_point', 'lantern_resolved'),
    outcome: 'kept',
  });
});

// Breaks (23 §3): a trigger matched on the choice alone, so a like-named choice of another
// dialogue reaches the story point (the world is built past the loader, which needs the dialogue).
test('a choice reaches only a story point naming its own dialogue', () => {
  const w = talked();
  const trigger = { dialogue: ref('dialogue', 'other'), choice: 'leave' };
  const story_points = { [`${F}:story_point/x`]: { key: 'x', outcomes: { leave: trigger } } };
  const other = { ...w, cartridge: { ...w.cartridge, story_points } } as unknown as World;
  assert.deepEqual(events(ok(other, choose('leave'), 4).decision).at(-1), [4, 'choice_resolved']);
});

// Bram's dialogue without its quest (and the story point only a quest dialogue may reach): a hub.
const hub = (f: (d: any, c: any) => void = () => {}) =>
  world((c) => {
    delete c.dialogues[`${F}:dialogue/bram`].quest;
    delete c.story_points;
    f(c.dialogues[`${F}:dialogue/bram`], c);
  });
const open = (w: World) =>
  ok(ok(ok(w, accept, 1, ACCEPT).world, take, 2, TAKE).world, talk, 3, TALK).world;
// Independent Python SHA-256 of ["loka-id-v1", CONTEXT, OTHER, 1]: the choose's next id after its
// choice_resolved event (ordinal 0).
const NEXT = '6fa10ef7-a7f3-872b-ad50-6b1193bf75d5';

// Breaks (loka-x6t.5): an answer ending the conversation instead of returning to its hub, the
// hub row rebinding or reordering roles or choices, or its choice_opened before choice_resolved.
test('an answer returns to the hub: a fresh pending row re-offers the same choices', () => {
  const { decision, world: w } = ok(open(hub()), choose('carry'), 4);
  assert.deepEqual(decision.delta.ops.slice(-2), [
    {
      op: 'choice.resolve',
      writer_group: 0,
      continuation_id: C,
      choice_id: 'carry',
      expected_revision: 3,
    },
    {
      op: 'choice.open',
      writer_group: 0,
      continuation_id: NEXT,
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
  assert.deepEqual(events(decision), [
    [1, 'fact_changed'],
    [2, 'choice_resolved'],
    [3, 'choice_opened'],
  ]);
  // With no fact_changed (sorted by position) the array order shows: an answer that sets no fact.
  const bare = ok(open(hub((d) => delete d.choices.carry.sequence)), choose('carry'), 4).decision;
  assert.deepEqual(events(bare), [
    [1, 'choice_resolved'],
    [2, 'choice_opened'],
  ]);
  assert.equal(w.state.choices![C]!.status, 'resolved');
  const view = gameView(w).choice!;
  assert.deepEqual(
    [view.continuation_id, view.closable, view.choices.map((o) => [o.choice_id, o.available])],
    [
      NEXT,
      true,
      [
        ['carry', true],
        ['leave', true],
      ],
    ],
  );
  refused(w, talk, 'invalid_state');
  assert.equal(gameView(ok(w, close(NEXT), 5).world).choice, undefined);
});

// Breaks (loka-x6t.5 ruling): an open hub outliving the speaker leaving the room (Bram's
// scheduled walk to the green), the player's or the speaker's death; the close another op than Leave's.
test('a hub conversation ends as Leave would once the speaker or the player leaves', () => {
  const left = ok(open(hub()), wait, 4).world;
  assert.equal(left.state.containers[BRAM], GREEN);
  assert.equal(left.state.choices![C]!.status, 'closed');
  const { decision, world: away } = ok(open(hub()), { type: 'move', direction: 'north' }, 4);
  assert.deepEqual(decision.delta.ops.at(-1), {
    op: 'choice.close',
    writer_group: 1,
    continuation_id: C,
  });
  assert.equal(gameView(away).choice, undefined);
  // Bram dies where he stands (controlled: HP-bearing, HP row at 0); the next action ends it.
  const w = open(hub());
  const hp = key({ kind: 'resource', entity_id: BRAM, resource: resourceRef(w, 'hp') } as never);
  const dead = structuredClone(w) as any;
  dead.entities[BRAM].hp = w.cartridge.resources![`${F}:resource/hp`];
  dead.state.resources[hp] = { value: 0, at: w.state.clock };
  const { decision: d, world: after } = ok(dead, drop, 4);
  assert.equal(after.state.containers[BRAM], after.state.containers[BODY]);
  assert.deepEqual(d.delta.ops.at(-1), { op: 'choice.close', writer_group: 1, continuation_id: C });
  assert.equal(gameView(after).choice, undefined);
});

// Breaks (loka-x6t.5): a hub reopened after an answer that ends the conversation: the dialogue's
// only choice, or a riddle's solved answer.
test('a single-choice or riddle dialogue ends at its answer', () => {
  for (const [name, w, answer] of [
    ['single', hub((d) => delete d.choices.leave), undefined],
    [
      'riddle',
      hub((d, c) => {
        c.manifest.requires.kernel_api.at_least = '1.9';
        d.riddle = {
          choice_id: 'carry',
          answer: 'lamp',
          bank: ['L', 'A', 'M', 'P'],
          wrong: d.prompt,
        };
      }),
      'lamp',
    ],
  ] as const) {
    const { decision, world: after } = ok(
      open(w),
      { ...choose('carry'), ...(answer && { answer }) },
      4,
    );
    assert.equal(decision.delta.ops.at(-1)!.op, 'choice.resolve', name);
    assert.equal(gameView(after).choice, undefined, name);
  }
});

// Breaks (06 §37, §43): close mutating the outcome or reaching a story point, or a re-talk
// reusing the closed occurrence.
test('close changes no outcome; a second talk opens another occurrence', () => {
  const { decision, world: w } = ok(talked(), close(), 4);
  assert.equal(decision.outcome, 'choice_closed');
  assert.deepEqual(decision.delta.ops, [
    { op: 'choice.close', writer_group: 0, continuation_id: C },
  ]);
  assert.deepEqual(decision.events, []);
  assert.equal(quest(w), 'active');
  assert.equal(ok(w, talk, 5, TALK2).decision.delta.ops[0]!.op, 'choice.open');
  assert.equal(gameView(ok(w, talk, 5, TALK2).world).choice?.continuation_id, C2);
});

// Breaks (adverse-cases.json drop-after-choice-opened; NPC-moves-away variant of walked-away-rejects-new-choice):
// choose trusting the historical acquisition or Bram's place at talk time, either check missing, or the
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

// Breaks: a second pending choice (or one listed available), a consumed choice resurrected
// (06 §43), another actor's or an unoffered option chosen, or close of nothing.
test('talk while pending, and choose or close of no pending continuation, are invalid_state', () => {
  const w = talked();
  refused(w, talk, 'invalid_state');
  assert.deepEqual([talkView(w), talkView(ok(w, close(), 4).world)], [unavailable, [[true]]]);
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
// a talk under another action's key.
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

const P = `.cartridge.story_points["${F}:story_point/lantern_resolved"]`;
const point = (c: any) => c.story_points[`${F}:story_point/lantern_resolved`];

// Breaks (23 §3: the loader admitting what the compiler rejects, test/loka/content_ferry_test.exs):
// a trigger naming no dialogue or a choice it lacks, one choice feeding two outcomes (it would
// emit twice), a dialogue without a quest (its choice repeatable), a story point with no outcome,
// a story point loaded without dialogue@1, its event's owner, in the lock, or keyed apart from
// its key (the map's kind story_point has an underscore).
test('the loader checks story point triggers, outcomes, keys and the lock', () => {
  fails((c) => (point(c).key = 'other'), 'ARTIFACT_DEFINITION_KEY_MISMATCH', P, {
    field: 'key',
    declared: 'lantern_resolved',
    expected: 'other',
  });
  fails(
    (c) => (point(c).outcomes.carry.dialogue = ref('dialogue', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${P}.outcomes.carry.dialogue`,
    { target: `${F}:dialogue/missing` },
  );
  fails(
    (c) => (point(c).outcomes.carry.choice = 'wave'),
    'UNRESOLVED_REFERENCE',
    `${P}.outcomes.carry.choice`,
    { target: 'wave' },
  );
  fails(
    (c) => (point(c).outcomes.leave.choice = 'carry'),
    'DUPLICATE_DEFINITION',
    `${P}.outcomes.carry`,
  );
  fails((c) => delete bram(c).quest, 'OUTCOME_MISMATCH', `${P}.outcomes.carry`);
  fails((c) => (point(c).outcomes = {}), 'SCHEMA_VIOLATION', `${P}.outcomes`, {
    error: 'too_few_items',
  });
  fails(
    (c) => {
      delete c.dialogues;
      delete c.manifest.requires.capabilities.dialogue;
      delete c.lock.capabilities.dialogue;
    },
    'UNDECLARED_CAPABILITY',
    P,
    { capability: 'dialogue' },
    ['dialogue@1'],
  );
});
