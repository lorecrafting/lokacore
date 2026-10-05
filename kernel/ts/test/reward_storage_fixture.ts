import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { gameView } from '../src/runtime/world.ts';

export const bundle = read('protocol/fixtures/reward_storage_hash.json');
export const prefix = 'reward_storage@0.0.1';
export const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'reward_storage',
    cartridge_version: '0.0.1',
    kind,
    key: name,
  }) as DefinitionRef;
export function world(change: (c: any) => void = () => {}): World {
  const c = structuredClone(bundle.value);
  change(c);
  const canonical = encode(c);
  const content_hash = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'],
    [1, 2, 3, 4],
  );
}
export const fresh = world();
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];
let ordinal = 1000;
export function run(w: World, payload: object) {
  const n = ++ordinal;
  const command = {
    id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  } as Command;
  return step(w, command, n);
}
export function ok(w: World, payload: object) {
  const r = run(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
export const fact = (w: World, name: string, value: number | boolean): World => {
  const f = ref('fact', name);
  const scope =
    name === 'inn_cellar_cleared'
      ? { kind: 'instance', world_context_id: w.context }
      : { kind: 'player', character_id: w.character };
  return {
    ...w,
    state: {
      ...w.state,
      facts: { ...w.state.facts, [key({ kind: 'fact', fact: f, scope })]: value },
    },
  };
};
export const moveTo = (w: World, name: string): World => ({
  ...w,
  state: { ...w.state, containers: { ...w.state.containers, [w.body]: room(w, name) } },
});
export function ready(w = fresh, missing = 0) {
  w = moveTo(w, 'drowned_lantern');
  for (const n of [1, 2, 3, 4, 5]) w = fact(w, `rat_${n}_killed`, n !== missing);
  w = ok(w, { type: 'talk', target_id: entity(w, 'npc', 'maud') });
  w = ok(w, {
    type: 'choose',
    continuation_id: gameView(w).choice!.continuation_id,
    choice_id: 'accept',
  });
  return ok(w, { type: 'talk', target_id: entity(w, 'npc', 'maud') });
}
export const choose = (w: World) => ({
  type: 'choose',
  continuation_id: gameView(w).choice!.continuation_id,
  choice_id: 'done',
});
