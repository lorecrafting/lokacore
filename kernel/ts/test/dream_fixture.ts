// Controlled B9 inputs; expected phases and resource answers are literal in the tests.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { encode } from '../src/foundation/canonical.ts';
import { value } from '../src/mechanics/fact.ts';
import { level } from '../src/mechanics/resource.ts';
import {
  loadCartridge,
  newWorld,
  step,
  INSTALLED,
  type World,
  type Cartridge,
} from '../src/index.ts';
import type { Command, DefinitionRef, Key } from '../src/contracts.gen.ts';
export const prefix = 'ashmere_missing_child@0.0.26';
export const ref = (kind: string, key: string): DefinitionRef => ({
  cartridge_id: 'ashmere_missing_child' as never,
  cartridge_version: '0.0.26' as never,
  kind,
  key: key as never,
});
export function bundle(change: (c: any) => void = () => {}) {
  const c = structuredClone(read('protocol/fixtures/missing_child_b9_hash.json').value);
  c.entry.key = 'drowned_lantern';
  c.calendar.start = 0;
  c.resources[`${prefix}:resource/mv`].start = 51;
  change(c);
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export function fresh(change: (c: any) => void = () => {}) {
  const b = bundle(change),
    loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
}
export const entity = (w: World, kind: string, key: string) =>
  w.entityIds[`${prefix}:${kind}/${key}`];
export const sceneRef = ref('scene', 'dream_of_the_fen');
export const phase = (w: World) => ({
  slept: value(w, w.character, ref('fact', 'slept_at_lantern')),
  seen: value(w, w.character, ref('fact', 'dream_seen')),
  cursor: value(w, w.character, ref('fact', 'scene_dream_of_the_fen')),
  quest:
    Object.values(w.state.quests ?? {}).find((q) => q.quest.key === 'a_room_at_the_lantern')
      ?.state ?? null,
});
export const mv = (w: World) => level(w, w.body, ref('resource', 'mv'));
export function command(w: World, n: number, payload: object): Command {
  return {
    id: `cccccccc-2222-4333-8444-${String(n).padStart(12, '0')}`,
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  } as Command;
}
export function route(w: World) {
  let n = 100;
  const invoke = (p: any, key?: string) => {
    const result = step(w, command(w, ++n, p), n, key as Key | undefined);
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    w = result.world;
    return result;
  };
  invoke(
    {
      type: 'use_service',
      provider_id: entity(w, 'npc', 'maud'),
      service: ref('service', 'lantern_room'),
      quoted_price: 3,
    },
    'rent_lantern_room',
  );
  invoke({ type: 'move', direction: 'up' }, 'move');
  return {
    get world() {
      return w;
    },
    invoke,
  };
}
