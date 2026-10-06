import { read } from './read.ts';
import { loadCartridge, INSTALLED, newWorld, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';

// Provisional input artifact; literal HP/time answers below are independent of its compiler.
const artifact = read('kernel/ts/test/fixtures/c5-provisional-artifact.json');
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const cartridge = loaded.cartridge as Cartridge;
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const run = 'aaaaaaaa-0000-4000-8000-000000000010' as never;
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;

export function fixture(chance = 100, hp = 10) {
  const fresh = newWorld(cartridge, context, [1, 2, 3, 4]);
  const hounds = Object.entries(fresh.state.created ?? {}).filter(
    ([, e]) => e.origin?.kind === 'spawned' && e.origin.role === 'hound',
  );
  const target = hounds[0]![0] as never;
  const room = fresh.state.containers[target];
  const entities = { ...fresh.entities } as Record<string, any>;
  for (const [member] of hounds)
    entities[member] = { ...entities[member], attack: { ...entities[member].attack, chance } };
  const combat = fresh.cartridge.world!.combat!;
  const world: World = {
    ...fresh,
    entities,
    cartridge: {
      ...fresh.cartridge,
      world: {
        ...fresh.cartridge.world!,
        combat: {
          ...combat,
          player_attack: { chance: 0, damage_min: 1, damage_max: 1 },
          dodge: undefined,
        },
      },
    },
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [fresh.body]: room },
      resources: {
        ...fresh.state.resources,
        [key({ kind: 'resource', entity_id: fresh.body, resource: resourceRef(fresh, 'hp') })]: {
          value: hp,
          at: 64800,
        },
      },
    },
  };
  return { world, target, room };
}

export function command(world: World, n: number, payload: object, revision: number) {
  return step(
    world,
    {
      id: id(n),
      world_context_id: world.context,
      payload: { ...payload, actor_id: world.character },
    } as never,
    revision,
  );
}

export function elapsed(world: World, until: number, revision: number) {
  return stepElapsed(
    world,
    {
      id: elapsedCommandId(run, world.context, world.state.clock, until) as never,
      world_context_id: world.context,
      payload: {
        type: 'elapsed',
        actor_id: world.character,
        run_id: run,
        from: world.state.clock,
        until,
      },
    },
    revision,
  );
}

export const hp = (world: World) => level(world, world.body, resourceRef(world, 'hp'));
