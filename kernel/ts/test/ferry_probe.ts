// T's probe world (06 §20-21; PM decision D1): the ferry known answer
// (protocol/fixtures/cartridge_ferry_hash.json) locking target_resolution@1, plus NPCs ada (the
// landing, no dialogue) and cole (the green), re-hashed with node:crypto.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Command, DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

export const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
export const CID = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a91';
export const F = 'ashmere_ferry@0.0.1';
export const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_ferry', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
export const PRESENT = { op: 'target_present' } as const;
export const chat = (root: object) => ({
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
export const world = (edit: (c: any) => void = () => {}): World => {
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
export const at = (w: World, key: string) => w.entityIds[`${F}:${key}`] as EntityId;
export const command = (w: World, payload: object) =>
  ({
    id: CID,
    world_context_id: CONTEXT,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
// The code step answers `payload` with, or accepted.
export const stepped = (w: World, payload: object) => {
  const d = step(w, command(w, payload), 9).decision;
  return d.kind === 'accepted' ? d.kind : 'error' in d ? d.error.code : d.kind;
};
export const after = (w: World, payload: object) => {
  const s = step(w, command(w, payload), 1);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
};
// What the GameView shows for `action_key` on entity `id`: available, its code, or not listed.
export const shown = (w: World, action_key: string, id: EntityId) => {
  const a = gameView(w)
    .entities.find((e) => e.id === id)!
    .actions.find((x) => x.action_key === action_key);
  return !a ? 'not listed' : 'reason' in a ? a.reason.code : 'available';
};
export const accept = { type: 'accept_quest', quest: ref('quest', 'lantern') };
