// Controlled prerequisite input; shipped look never creates this fatal decision.
import assert from 'node:assert/strict';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import { accepted, allocator, type World } from '../src/runtime/decision.ts';
import type { Command, CommandId, EntityId } from '../src/contracts.gen.ts';
import { admit, adopt } from '../src/runtime/proposal.ts';
import { apply } from '../src/runtime/apply.ts';
import { adjust, resourceRef, level } from '../src/mechanics/resource.ts';
import { deathSequence } from '../src/mechanics/death/sequence.ts';
import { fact } from '../src/mechanics/position/shared.ts';
import { key } from '../src/foundation/compose.ts';
import { read } from './read.ts';

export const bundle = read('protocol/fixtures/sampler_v008_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok);
export const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
export const entity = (world: World, name: string) =>
  world.entityIds[`ashmere_sampler@0.0.8:${name}`];
export const room = (world: World, name: string) =>
  world.roomIds[`ashmere_sampler@0.0.8:room/${name}`];
export function controlled(): World {
  const bag = entity(fresh, 'item/trunk'),
    lantern = entity(fresh, 'item/lantern'),
    worn = entity(fresh, 'item/wool_cloak');
  return {
    ...fresh,
    state: {
      ...fresh.state,
      containers: {
        ...fresh.state.containers,
        [fresh.body]: room(fresh, 'lantern_cellar'),
        [bag]: fresh.body,
        [lantern]: bag,
        [worn]: fresh.slots.cloak,
        [entity(fresh, 'item/tin_whistle')]: entity(fresh, 'npc/bram'),
      },
      resources: {
        ...fresh.state.resources,
        [key({ kind: 'resource', resource: resourceRef(fresh, 'ma'), entity_id: fresh.body })]: {
          value: 7,
          at: 64800,
        },
        [key({ kind: 'resource', resource: resourceRef(fresh, 'mv'), entity_id: fresh.body })]: {
          value: 3,
          at: 64800,
          rate: 36,
          remainder: 1200,
        },
      },
      quests: {
        '00000000-0000-4000-8000-000000000077': {
          quest: {
            cartridge_id: 'ashmere_sampler' as never,
            cartridge_version: '0.0.8' as never,
            kind: 'quest',
            key: 'lantern',
          },
          scope: { kind: 'player', character_id: fresh.character },
          state: 'active',
        },
      },
      choices: {
        '00000000-0000-4000-8000-000000000078': {
          actor_id: fresh.character,
          source: {
            cartridge_id: 'ashmere_sampler' as never,
            cartridge_version: '0.0.8' as never,
            kind: 'dialogue',
            key: 'bram_offer',
          },
          beat: 'bram_offer' as never,
          roles: [{ role: 'bram' as never, entity_id: entity(fresh, 'npc/bram') }],
          choice_ids: ['accept' as never],
          status: 'pending',
          opened_revision: 0,
        },
      },
      facts: {
        [key({
          kind: 'fact',
          fact: fact(fresh),
          scope: { kind: 'player', character_id: fresh.character },
        })]: 'sleeping' as never,
      },
    },
  };
}
export function fatal(
  world: World,
  victim: EntityId = world.body,
  id = '00000000-0000-4000-8000-000000000091' as CommandId,
  revision = 1,
) {
  const command = {
    id,
    world_context_id: world.context,
    payload: { type: 'look', actor_id: world.character },
  } as const satisfies Command;
  const mint = allocator(world, command);
  mint(); // The actual producer allocates attack-result EventId first (M4-A).
  const loss = adjust(
    world,
    victim,
    resourceRef(world, 'hp'),
    -level(world, victim, resourceRef(world, 'hp'))!,
    {},
  ).op;
  const lost = apply(world, [loss]);
  assert.ok('world' in lost);
  const sequence = deathSequence(
    lost.world,
    command,
    {
      loss,
      owner_id: victim === world.body ? world.character : null,
      killer_id: victim === world.body ? entity(world, 'npc/cellar_rat_1') : world.body,
      credited_character_id: victim === world.body ? null : world.character,
    },
    mint,
  );
  const next = adopt(
    world,
    admit('death', accepted(world, 'died', [loss, ...sequence.ops], sequence.events)),
    command,
    mint,
    revision,
  );
  assert.equal(next.decision.kind, 'accepted');
  return { next, sequence, command };
}
