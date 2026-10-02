// target_resolution@1's target_present (06 §20-21; 21 §7; 04 §5.4) and the talk paths it shares
// with dialogue@1 (PM decision D1; docs/reviews/2026-10-01-r78-d1-review.md, R2-2). Worlds are
// the ferry known answer (protocol/fixtures/cartridge_ferry_hash.json: 06:00, the player, Bram,
// the lantern and the mooring post at the landing; Bram's talk while the quest is active) locking
// target_resolution@1, plus NPCs ada (the landing, no dialogue) and cole (the green), re-hashed
// with node:crypto. Expected values are hand-written literals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { resolve } from '../src/invocation.ts';
import { holds } from '../src/policy.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CID = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a91';
const F = 'ashmere_ferry@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_ferry', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const PRESENT = { op: 'target_present' } as const;
const chat = (root: object) => ({
  key: 'chat',
  label: 'action.talk',
  accessibility: 'action.talk',
  target: { kind: 'entity', scopes: ['room_occupants'] },
  command: 'talk',
  priority: 0,
  input: [],
  policy: { policy_version: 1, root },
});

// Loaded against the real INSTALLED, so dropping target_resolution from it fails every test here.
const world = (edit: (c: any) => void = () => {}): World => {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities])
    caps.target_resolution = 1;
  for (const [key, room] of [
    ['ada', 'ferry_landing'],
    ['cole', 'village_green'],
  ]) {
    const npc = { ...c.npcs[`${F}:npc/bram`], key, keywords: [key], room: ref('room', room) };
    delete npc.daily_schedule;
    c.npcs[`${F}:npc/${key}`] = npc;
  }
  edit(c);
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const at = (w: World, key: string) => w.entityIds[`${F}:${key}`] as EntityId;
const command = (w: World, payload: object) =>
  ({
    id: CID,
    world_context_id: CONTEXT,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
// The code step answers `payload` with, or accepted.
const stepped = (w: World, payload: object) => {
  const d = step(w, command(w, payload), 9).decision;
  return d.kind === 'accepted' ? d.kind : 'error' in d ? d.error.code : d.kind;
};
const after = (w: World, payload: object) => {
  const s = step(w, command(w, payload), 1);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
};
// The talk invocation of `action_key` on `target`, resolved (invocation.ts) and stepped.
const invoked = (w: World, action_key: string, target: EntityId) => {
  const invocation = { action_key, actor_id: w.character, target_ids: [target], input: {} };
  const c = resolve(w, { invocation, command_id: CID } as never);
  return 'payload' in c ? stepped(w, c.payload) : c.error.code;
};
// What the GameView shows for `action_key` on entity `id`: available, its code, or not listed.
const shown = (w: World, action_key: string, id: EntityId) => {
  const a = gameView(w)
    .entities.find((e) => e.id === id)!
    .actions.find((x) => x.action_key === action_key);
  return !a ? 'not listed' : 'reason' in a ? a.reason.code : 'available';
};
const accept = { type: 'accept_quest', quest: ref('quest', 'lantern') };

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

// Breaks: admission evaluating the action's policy without its target (an alias or recipe whose
// policy is target_present refused invalid_state by step though the GameView lists it).
test('the target reaches admission for a talk alias and a recipe', () => {
  const w = after(
    world((c) => {
      c.actions[`${F}:action/chat`] = chat(PRESENT);
      c.recipes[`${F}:recipe/coil_rope`].policy.root = PRESENT;
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
