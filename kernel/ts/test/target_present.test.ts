// target_resolution@1's target_present (06 §20-21; 21 §7; 04 §5.4) and the talk paths it shares
// with dialogue@1 (PM decision D1; https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/reviews/2026-10-01-r78-d1-review.md, R2-2). Worlds are
// the ferry known answer (protocol/fixtures/cartridge_ferry_hash.json: 06:00, the player, Bram,
// the lantern and the mooring post at the landing; Bram's talk while the quest is active) locking
// target_resolution@1, plus NPCs ada (the landing, no dialogue) and cole (the green), re-hashed
// with node:crypto. Expected values are hand-written literals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EntityId } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { resolve } from '../src/commands/invocation.ts';
import { holds } from '../src/mechanics/policy.ts';
import { gameView } from '../src/runtime/world.ts';
import { accept, after, at, chat, CID, F, PRESENT, shown, stepped, world } from './ferry_probe.ts';

// The talk invocation of `action_key` on `target`, resolved (commands/invocation.ts) and stepped.
const invoked = (w: World, action_key: string, target: EntityId) => {
  const invocation = { action_key, actor_id: w.character, target_ids: [target], input: {} };
  const c = resolve(w, { invocation, command_id: CID } as never);
  return 'payload' in c ? stepped(w, c.payload) : c.error.code;
};

// Breaks: the leaf missing ("not installed") or the install entry dropped (the load fails
// CAPABILITY_NOT_INSTALLED), a scope other than resolve's (the item held, the room's detail, an
// NPC elsewhere), or the leaf holding with no target.
test('target_present holds for a target in reach and never without one', () => {
  const w = after(world(), { type: 'take', item_id: at(world(), 'item/lantern') });
  const post = Object.keys(w.details).find((d) => w.details[d].key === 'mooring_post');
  const rows: [string, string | undefined, boolean][] = [
    ['Bram in the room', at(w, 'npc/bram'), true],
    ['the lantern held', at(w, 'item/lantern'), true],
    ["the room's detail", post, true],
    ['cole in the green', at(w, 'npc/cole'), false],
    ['no target', undefined, false],
  ];
  for (const [name, target, expected] of rows) {
    const ctx = { target: target as EntityId | undefined, steps: { n: 0 } };
    assert.equal(holds(w, w.character, PRESENT, ctx), expected, name);
  }
});

// Breaks: admission evaluating the action's policy without its target (an alias, a recipe or a
// take whose policy is target_present refused invalid_state by step though the GameView lists
// it), notably a Command that names its target item_id rather than target_id.
test('the target reaches admission for a talk alias, a recipe and a take', () => {
  const w = after(
    world((c) => {
      c.actions[`${F}:action/chat`] = chat(PRESENT);
      c.recipes[`${F}:recipe/coil_rope`].policy.root = PRESENT;
      // Overrides the engine take (ALWAYS), so only this policy admits a take.
      c.actions[`${F}:action/take`] = { ...chat(PRESENT), key: 'take', command: 'take' };
      c.actions[`${F}:action/take`].target.scopes = ['room_contents'];
    }),
    accept,
  );
  const bram = at(w, 'npc/bram');
  assert.deepEqual(
    [
      shown(w, 'chat', bram),
      stepped(w, { type: 'talk', target_id: bram }),
      invoked(w, 'chat', bram),
    ],
    ['available', 'accepted', 'accepted'],
  );
  const coil = gameView(w).actions.find((a) => a.action_key === 'coil_rope');
  assert.deepEqual(
    [coil?.available, stepped(w, { type: 'perform', action: 'coil_rope' })],
    [true, 'accepted'],
  );
  const lantern = at(w, 'item/lantern');
  assert.deepEqual(
    [shown(w, 'take', lantern), stepped(w, { type: 'take', item_id: lantern })],
    ['available', 'accepted'],
  );
});

// Breaks: the GameView and step disagreeing on any talk path (STATE lesson), notably an alias on
// an NPC with no dialogue listed available while step answers not_found (R2-2), or the alias's
// own policy checked after the dialogue lookup.
test('every talk path gives the same code in the GameView and in step', () => {
  const active = after(
    world((c) => (c.actions[`${F}:action/chat`] = chat(PRESENT))),
    accept,
  );
  const before = world((c) => (c.actions[`${F}:action/chat`] = chat(PRESENT)));
  const failing = after(
    world((c) => (c.actions[`${F}:action/chat`] = chat({ op: 'not', item: PRESENT }))),
    accept,
  );
  const pending = after(active, { type: 'talk', target_id: at(active, 'npc/bram') });
  const plain = after(world(), accept);
  // Bram's dialogue's own policy is target_present (its talk's and talkRefused's).
  const own = world((c) => (c.dialogues[`${F}:dialogue/bram`].policy.root = PRESENT));
  const rows: [string, World, string, string, string, string][] = [
    ["Bram's talk, policy holding", active, 'bram', 'bram', 'available', 'accepted'],
    ["Bram's talk, policy failing", before, 'bram', 'bram', 'invalid_state', 'invalid_state'],
    ['chat on Bram', active, 'chat', 'bram', 'available', 'accepted'],
    ['chat on ada, no dialogue', active, 'chat', 'ada', 'not_found', 'not_found'],
    [
      "chat on ada, chat's policy failing",
      failing,
      'chat',
      'ada',
      'invalid_state',
      'invalid_state',
    ],
    ["Bram's talk, a choice pending", pending, 'bram', 'bram', 'invalid_state', 'invalid_state'],
    ['chat, a choice pending', pending, 'chat', 'bram', 'invalid_state', 'invalid_state'],
    [
      "Bram's talk, the dialogue's policy target_present",
      own,
      'bram',
      'bram',
      'available',
      'accepted',
    ],
    ["Bram's talk on ada", plain, 'bram', 'ada', 'not listed', 'unsupported_capability'],
  ];
  for (const [name, w, key, npc, view, code] of rows) {
    const id = at(w, `npc/${npc}`);
    assert.deepEqual(
      [shown(w, key, id), stepped(w, { type: 'talk', target_id: id }), invoked(w, key, id)],
      [view, code, code],
      name,
    );
  }
});
