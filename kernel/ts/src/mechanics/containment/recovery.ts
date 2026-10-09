import type { CharacterId, Command, EntityId } from '../../contracts.gen.ts';
import {
  bodyOf,
  refString,
  accepted,
  rejected,
  type World,
  type Steps,
} from '../../runtime/decision.ts';
import { level, resourceRef } from '../resource.ts';
import { LIMITS } from '../../contracts.gen.ts';

export function recovery(world: World, actor: CharacterId, corpse: EntityId, steps: Steps) {
  const body = bodyOf(world, actor),
    settings = world.cartridge.world?.water;
  if (
    !body ||
    !settings ||
    !(level(world, body, resourceRef(world, 'hp'))! > 0) ||
    world.state.containers[body] !== world.roomIds[refString(world.cartridge.world!.death!.shrine)]
  )
    return 'invalid_state' as const;
  const identity = world.state.created?.[corpse];
  if (
    identity?.origin.kind !== 'death' ||
    identity.origin.owner_id !== actor ||
    identity.origin.victim_id !== body ||
    world.entities[corpse]?.kind !== 'item' ||
    refString(identity.definition) !== refString(world.cartridge.world!.death!.player_corpse)
  )
    return 'not_owned' as const;
  const room_id = world.state.containers[corpse];
  if (!settings.routes.some((r) => world.roomIds[refString(r.bottom)] === room_id))
    return 'not_present' as const;
  const roots: EntityId[] = [];
  for (const [id, holder] of Object.entries(world.state.containers)) {
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
    if (holder === corpse) {
      if (world.entities[id]?.kind !== 'item') return 'precondition_failed' as const;
      roots.push(id as EntityId);
    }
  }
  roots.sort();
  return roots.length ? { body, room_id, roots } : ('invalid_state' as const);
}

export function recover(
  world: World,
  p: Extract<Command['payload'], { type: 'recover_corpse' }>,
  steps: Steps,
) {
  const plan = recovery(world, p.actor_id, p.corpse_id, steps);
  if (plan === 'budget_exceeded' || plan === 'precondition_failed')
    return { kind: 'fault' as const, code: plan };
  if (typeof plan === 'string') return rejected(plan);
  return accepted<never>(
    world,
    'corpse_recovered',
    plan.roots.map((entity_id) => ({
      op: 'entity.transfer',
      writer_group: 0,
      entity_id,
      source_id: p.corpse_id,
      destination_id: plan.body,
    })),
    [],
    plan.roots.map((id) => ({
      key: 'item.recovered' as never,
      bindings: { item: world.entities[id].short },
    })),
  );
}
