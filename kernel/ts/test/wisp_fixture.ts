import assert from 'node:assert/strict';
import { read } from './read.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  gameView,
  type World,
  type Cartridge,
} from '../src/index.ts';
export const bundle = read('protocol/fixtures/missing_child_v023_hash.json');
export const ids = read('protocol/fixtures/missing_child_v023_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok);
export const cartridge = loaded.cartridge as Cartridge;
export const fresh = () =>
  newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
export const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_missing_child', cartridge_version: '0.0.23', kind, key }) as any;
export function runner(initial: World = fresh()) {
  let world = initial,
    revision = 0,
    ordinal = 0;
  const raw = (type: string, fields: object = {}, action?: string) => {
    const out = step(
      world,
      {
        id: `bbbbbbbb-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`,
        world_context_id: world.context,
        payload: { type, actor_id: world.character, ...fields },
      } as never,
      revision + 1,
      action as never,
    );
    if (out.decision.kind === 'accepted') {
      world = out.world;
      revision++;
    }
    return out.decision;
  };
  const ok = (type: string, fields: object = {}, action?: string) => {
    const d = raw(type, fields, action);
    assert.equal(d.kind, 'accepted', JSON.stringify(d));
    return d;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', { direction }));
  const seek = () => ok('perform', { action: 'seek_wisp' });
  const talk = () => ok('talk', { target_id: ids['npc/wisp'] });
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', {
      choice_id,
      continuation_id: gameView(world).choice!.continuation_id,
      ...(answer !== undefined && { answer }),
    });
  const start = () => {
    move('south', 'south', 'south', 'east');
    seek();
    talk();
    choose('accept');
    talk();
  };
  return {
    raw,
    ok,
    move,
    seek,
    talk,
    choose,
    start,
    world: () => world,
    view: () => gameView(world),
  };
}
