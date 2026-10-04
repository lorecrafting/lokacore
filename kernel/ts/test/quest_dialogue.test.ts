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
import { encode } from '../src/foundation/canonical.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/runtime/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const F = 'ashmere_ferry@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_ferry', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const ALWAYS = { policy_version: 1, root: { op: 'all', items: [] } };
const O = `.cartridge.dialogues["${F}:dialogue/bram_offer"].choices.accept`;
const load = (f: (c: any) => void = () => {}) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  c.dialogues[`${F}:dialogue/bram_offer`] = {
    key: 'bram_offer',
    npc: ref('npc', 'bram'),
    policy: ALWAYS,
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
    { key: 'narration.bram.carry', participants: { actor: w.body, bram: bram(w) } },
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
      c.quests[`${F}:quest/lantern`].offer.policy.root = {
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

const fails = (f: (c: any) => void, code: string, path: string, data = {}) =>
  assert.deepEqual(load(f), {
    ok: false,
    diagnostic: {
      severity: 'error',
      code,
      path,
      message_key: `diagnostics.${code.toLowerCase()}`,
      data,
      suggested_capabilities: [],
    },
  });
const offer = (c: any) => c.dialogues[`${F}:dialogue/bram_offer`];

// Breaks (twin of test/loka/content_ferry_test.exs:267): the loader admitting an accept of a quest
// that does not exist, an accept in a dialogue that also resolves a quest (accepting would resolve
// it at once), or an accept with a hand_over (activation and acquisition in one decision fault
// conflicting_write).
test('the loader checks each accept: a quest, no dialogue quest, no hand_over', () => {
  fails(
    (c) => (offer(c).choices.accept.accept = ref('quest', 'missing')),
    'UNRESOLVED_REFERENCE',
    `${O}.accept`,
    { target: `${F}:quest/missing` },
  );
  fails((c) => (offer(c).quest = ref('quest', 'lantern')), 'OUTCOME_MISMATCH', `${O}.accept`);
  fails(
    (c) => {
      offer(c).roles.lantern = { role: 'item', item: ref('item', 'lantern') };
      offer(c).choices.accept.hand_over = { item: 'lantern', to: 'bram' };
    },
    'OUTCOME_MISMATCH',
    `${O}.hand_over`,
  );
});
