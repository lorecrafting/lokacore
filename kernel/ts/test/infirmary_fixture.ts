import assert from 'node:assert/strict';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  step,
  gameView,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { read } from './read.ts';
import { value } from '../src/mechanics/fact.ts';
export const bundle = read('protocol/fixtures/missing_child_v021_hash.json');
export const answers = read('protocol/fixtures/missing_child_v021_ids.json');
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
export const id = (kind: string, k: string) =>
  answers[`${kind}/${k}`] as import('../src/contracts.gen.ts').EntityId;
export const herbs = Array.from({ length: 12 }, (_, i) =>
  id('item', `fenwort_${String(i + 1).padStart(2, '0')}`),
).sort();
export const bandages = Array.from({ length: 12 }, (_, i) =>
  id('item', `bandage_${String(i + 1).padStart(2, '0')}`),
).sort();
export const wick = id('npc', 'wick'),
  patch = id('detail', 'willow_shade/fenwort_patch'),
  ledger = id('item', 'tithe_ledger');
export const ref = (kind: string, k: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.21',
    kind,
    key: k,
  }) as import('../src/contracts.gen.ts').DefinitionRef;
export const standing = (held: readonly string[] = [], mass = 0): World => ({
  ...fresh,
  entities: {
    ...fresh.entities,
    [ledger]: { ...fresh.entities[ledger], mass_grams: mass } as never,
  },
  state: {
    ...fresh.state,
    containers: {
      ...fresh.state.containers,
      [fresh.body]: id('room', 'infirmary'),
      [ledger]: fresh.body,
      ...Object.fromEntries(held.map((h) => [h, fresh.body])),
    },
  },
});
export function driver(initial: World) {
  let world = initial,
    n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const result = step(
      world,
      {
        id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}` as never,
        world_context_id: world.context,
        payload: { actor_id: world.character, ...payload } as never,
      },
      n,
    );
    const d = result.decision;
    assert.equal(
      d.kind === 'accepted' ? 'accepted' : d.kind === 'rejected' ? d.error.code : d.code,
      expected,
      JSON.stringify(d),
    );
    if (expected !== 'accepted') assert.equal(result.world, world);
    world = result.world;
    return d;
  };
  const talk = () => run({ type: 'talk', target_id: wick });
  const choose = (choice_id: string) =>
    run({ type: 'choose', continuation_id: gameView(world).choice!.continuation_id, choice_id });
  return {
    run,
    talk,
    choose,
    world: () => world,
    replace: (w: World) => {
      world = w;
    },
    accept: () => {
      talk();
      choose('accept');
    },
    exchange: () => {
      talk();
      choose('exchange');
    },
    axis: () => value(world, world.character, ref('fact', 'priory_fen_axis')),
    contribution: () => value(world, world.character, ref('fact', 'infirmary_contribution')),
  };
}
