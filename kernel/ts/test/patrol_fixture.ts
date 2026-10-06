import assert from 'node:assert/strict';
import { read } from './read.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';

/** Current independent full-chapter answer; source compilation is checked separately. */
export const bundle = read('protocol/fixtures/missing_child_v024_hash.json');
export const patrolBundle = () => structuredClone(bundle);
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
export const ref = (world: World, kind: string, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: kind as never,
  key: key as never,
});
export const room = (w: World, key: string) =>
  w.roomIds[`${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:room/${key}`];
export const npc = (w: World, key = 'tobin') =>
  w.entityIds[`${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:npc/${key}`];
export const patrol = (w: World) => Object.values(w.state.patrols ?? {})[0];
export function journey(world = fresh) {
  let w = world,
    n = 0;
  const run = (p: object, accept = true) => {
    const command = {
      id: `abababab-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as Command;
    const result = step(w, command, n);
    if (accept) assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    w = result.world;
    return result;
  };
  const move = (direction: string) => run({ type: 'move', direction });
  const choice = (choice_id: string, input?: object) => {
    run({ type: 'talk', target_id: npc(w), dialogue: ref(w, 'dialogue', 'tobin_watch') });
    const row = Object.entries(w.state.choices!).find(([, c]) => c.status === 'pending')!;
    const p = patrol(w);
    return run({
      type: 'choose',
      continuation_id: row[0],
      choice_id,
      ...(p && {
        patrol: {
          quest_instance_id: p.quest_instance_id,
          attempt_id: p.attempt_id,
          cursor: p.cursor,
          status: p.status,
        },
      }),
      ...input,
    });
  };
  const start = () => {
    for (const d of ['north', 'north', 'north', 'east']) move(d);
    choice('start');
  };
  return {
    run,
    move,
    choice,
    start,
    get world() {
      return w;
    },
  };
}
