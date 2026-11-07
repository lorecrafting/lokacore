// Quest from dialogue (M1; docs/system/mechanics.md quest@1 and dialogue@1): a choice's accept
// activates its quest in the choose's decision, a speaker may have several dialogues, its talk
// opening the first in key order whose own policy holds, and the loader's accept checks. Worlds
// are the ferry known answer (protocol/fixtures/cartridge_ferry_hash.json: quest lantern with an
// offer; Bram's dialogue bram, talk while the quest is active) plus a dialogue bram_offer of
// Bram's (role bram, one choice accept of the quest lantern), re-hashed with node:crypto.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { check } from '../src/runtime/invariants.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const F = 'ferry_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ferry_sampler', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const load = (f: (c: any) => void = () => {}) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  c.dialogues[`${F}:dialogue/bram_offer`] = {
    key: 'bram_offer',
    npc: ref('npc', 'bram'),
    prompt: 'dialogue.bram.prompt',
    roles: { bram: { role: 'npc', npc: ref('npc', 'bram') } },
    choices: {
      accept: {
        label: 'quest.lantern.accept',
        narration: 'narration.bram.carry',
        accept: ref('quest', 'lantern'),
      },
    },
  };
  f(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  const artifact = `{"cartridge":${text},"content_hash":"${h}"}`;
  return loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
};
const world = (f?: (c: any) => void): World => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
let n = 0;
const run = (w: World, payload: object) => {
  const id = `e5f6a7b8-c9d0-8e1f-8a2b-${String(++n).padStart(12, '0')}`;
  const command = { id, world_context_id: CONTEXT, payload: { actor_id: w.character, ...payload } };
  return step(w, command as Command, n);
};
const bram = (w: World) => gameView(w).entities.find((e) => e.kind === 'npc')!.id;
// Talks to Bram; returns the world and the key of the dialogue the choice opened.
const talk = (w: World) => {
  const s = run(w, { type: 'talk', target_id: bram(w) });
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  const pending = Object.values(s.world.state.choices!).find((c) => c.status === 'pending')!;
  return [s.world, pending.source.key] as const;
};
const REFUSED = {
  available: false,
  choice_id: 'accept',
  label: 'quest.lantern.accept',
  reason: { code: 'invalid_state' },
};
const accept = (w: World) =>
  run(w, {
    type: 'choose',
    choice_id: 'accept',
    continuation_id: gameView(w).choice!.continuation_id,
  });

// Breaks: a talk opening the speaker's first dialogue whatever its policy (bram's fails before the
// quest is active), or not the first in key order when both hold (bram before bram_offer); a
// choice's accept not activating its quest, outcome other than the choice id, quest_activated
// missing or out of order, or the narration not pinning the actor and Bram.
test('an accept choice activates its quest; the talk opens the first dialogue that holds', () => {
  let [w, opened] = talk(world());
  assert.equal(opened, 'bram_offer');
  const s = accept(w);
  assert.ok(s.decision.kind === 'accepted', JSON.stringify(s.decision));
  assert.equal(s.decision.outcome, 'accept');
  assert.deepEqual(
    s.decision.events.map((e) => e.payload.type),
    ['quest_activated', 'choice_resolved'],
  );
  assert.deepEqual(s.decision.narration, [
    {
      key: 'narration.bram.carry',
      participants: { actor: w.body, bram: bram(w), speaker: bram(w) },
    },
  ]);
  assert.deepEqual(
    gameView(s.world).journal.map((q) => [q.quest.key, q.state]),
    [['lantern', 'active']],
  );
  [w, opened] = talk(s.world);
  assert.equal(opened, 'bram');
});

// Breaks: choose of an accept trusting the talk-time policy alone, so a stale offer activates a
// second instance of a quest the actor already has (here accepted through its offer action while
// the offer's choice was pending).
test('a stale accept is invalid_state once the actor has an instance', () => {
  const [w] = talk(world());
  const s = run(w, { type: 'accept_quest', quest: ref('quest', 'lantern') });
  assert.equal(s.decision.kind, 'accepted');
  assert.deepEqual(gameView(s.world).choice!.choices, [REFUSED]);
  const stale = accept(s.world);
  assert.deepEqual(stale.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(stale.world, s.world);
});

// Breaks: choose of an accept skipping the quest's offer policy that accept_quest obeys, or the
// GameView advertising that accept while step refuses it.
test("an accept is invalid_state while its quest's offer policy fails", () => {
  const [w] = talk(
    world((c) => {
      c.quests[`${F}:quest/lantern`].offer.policy = {
        op: 'has_item',
        item: ref('item', 'lantern'),
      };
    }),
  );
  assert.deepEqual(gameView(w).inventory, []);
  assert.deepEqual(gameView(w).choice!.choices, [REFUSED]);
  const s = accept(w);
  assert.deepEqual(s.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(s.world, w);
});

// Quest offer target (loka-vx2v; cartridge.md Quest offer target), the fixture half.
const offerOn = (c: any, room: string, detail: string) =>
  (c.quests[`${F}:quest/lantern`].offer.target = {
    kind: 'detail',
    room: ref('room', room),
    detail,
  });
const onPost = (f: (c: any) => void = () => {}) =>
  world((c) => {
    offerOn(c, 'ferry_landing', 'mooring_post');
    f(c);
  });
const post = (w: World) => gameView(w).notices!.find((n) => n.key === 'mooring_post');
const invocation = (w: World) => {
  const id = identify('scope', w.character, {
    invocation_id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    actor_id: w.character,
    action_key: 'lantern',
    target_ids: [],
    input: {},
  });
  assert.equal(id.kind, 'identified');
  return id.kind === 'identified' ? resolve(w, id) : undefined;
};
const ACCEPT = { type: 'accept_quest', quest: ref('quest', 'lantern') };

// Breaks: the World card stays beside the fixture's, the fixture's scripted card lost, or a target
// slipping into the payload (rows 1-2).
test('an offer naming a detail is that notice card, and invokes with no target', () => {
  const w = onPost();
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  assert.equal(
    v.actions.some((a) => a.action_key === 'lantern'),
    false,
  );
  const offers = post(w)!.actions!;
  assert.ok(offers.some((a) => a.action_key === 'coil_rope'));
  assert.deepEqual(JSON.parse(JSON.stringify(offers.filter((a) => a.action_key === 'lantern'))), [
    {
      action_key: 'lantern',
      label: 'quest.lantern.accept',
      target: { kind: 'none' },
      input: [],
      available: true,
    },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify((invocation(w) as Command).payload)), {
    type: 'accept_quest',
    actor_id: w.character,
    quest: ref('quest', 'lantern'),
  });
  const s = run(w, ACCEPT);
  const types = s.decision.kind === 'accepted' ? s.decision.events.map((e) => e.payload.type) : [];
  assert.deepEqual(types, ['quest_activated']);
  assert.ok(!JSON.stringify(gameView(s.world)).includes('"action_key":"lantern"'));
  // Breaks: the invariant false on this legal accept, or blind when the page lost it.
  const command = {
    world_context_id: CONTEXT,
    payload: { actor_id: w.character, ...ACCEPT },
  };
  const agrees = (view: unknown) =>
    check('gameview_agrees_with_admission', { view, command, decision: s.decision, words: {} });
  assert.ok(agrees(v));
  assert.equal(agrees({ ...v, notices: [] }), false);
});

// Breaks: accept from another room because a lit detail is `visible` from anywhere (row 3).
test('an offer naming a detail is not offered from another room', () => {
  const w = run(onPost(), { type: 'move', direction: 'north' }).world;
  assert.deepEqual(validate('GameView', gameView(w)), []);
  assert.ok(!JSON.stringify(gameView(w)).includes('"action_key":"lantern"'));
  const refused = { kind: 'rejected', error: { code: 'unsupported_capability' } };
  assert.deepEqual(invocation(w), refused);
  assert.deepEqual(run(w, ACCEPT).decision, refused);
});

// Breaks: `here` listing a quest's detail offer the actor cannot see, or admission allowing it (row 4).
test('an offer naming an unseen detail is not listed and accept is invalid_state', () => {
  const w = onPost((c) => (c.rooms[`${F}:room/ferry_landing`].dark = true));
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  assert.ok(!JSON.stringify(v).includes('"action_key":"lantern"'));
  assert.deepEqual(run(w, ACCEPT).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
});

// Breaks: the offer's target read when a dialogue activates the quest (row 9).
test('a dialogue accept activates a quest whose offer target is elsewhere', () => {
  const w = world((c) => {
    const rooms = c.rooms;
    rooms[`${F}:room/village_green`].details = {
      well: rooms[`${F}:room/ferry_landing`].details.mooring_post,
    };
    offerOn(c, 'village_green', 'well');
  });
  assert.ok(!JSON.stringify(gameView(w).actions).includes('"action_key":"lantern"'));
  const s = accept(talk(w)[0]);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  assert.deepEqual(
    gameView(s.world).journal.map((q) => [q.quest.key, q.state]),
    [['lantern', 'active']],
  );
});

// Breaks: a fixture with no other action losing its page, the migrated offers' common case.
test('a fixture whose only action is the offer still has its notice', () => {
  const w = world((c) => {
    const { details } = c.rooms[`${F}:room/ferry_landing`];
    details.well = details.mooring_post;
    offerOn(c, 'ferry_landing', 'well');
  });
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  const cards = (v.notices ?? []).filter((n) => n.actions?.some((a) => a.action_key === 'lantern'));
  assert.deepEqual(
    cards.map((n) => n.actions?.map((a) => a.action_key)),
    [['lantern']],
  );
});
