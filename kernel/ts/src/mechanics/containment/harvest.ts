// A detail selects from finite authored room-held stock; Take remains the ordinary custody path.
import type { CharacterId, EntityId, Command } from '../../contracts.gen.ts';
import {
  bodyOf,
  accepted,
  rejected,
  event,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { selected } from './stock.ts';
import { carrying } from './shared.ts';

export function harvest(world: World, actor: CharacterId, target: EntityId, steps: Steps) {
  const detail = world.details[target],
    body = bodyOf(world, actor);
  if (!detail?.harvest || !body) return 'invalid_target' as const;
  if (detail.room !== world.state.containers[body]) return 'not_present' as const;
  const ids = selected(world, detail.harvest.items, detail.room, 1, steps);
  if (typeof ids === 'string') return ids;
  if (!ids.length) return 'not_found' as const;
  const code = carrying(world, body, steps)(ids[0]);
  return code ?? { item: ids[0], body, detail };
}

export function decideHarvest(
  world: World,
  command: Command & { payload: Extract<Command['payload'], { type: 'harvest' }> },
  mint: Mint,
  steps: Steps,
) {
  const p = command.payload;
  const picked = harvest(world, p.actor_id, p.target_id, steps ?? { n: 0 });
  if (typeof picked === 'string')
    return ['budget_exceeded', 'containment_cycle', 'precondition_failed'].includes(picked)
      ? {
          kind: 'fault' as const,
          code: picked as 'budget_exceeded' | 'containment_cycle' | 'precondition_failed',
        }
      : rejected(picked);
  const op = {
    op: 'entity.transfer' as const,
    writer_group: 0,
    entity_id: picked.item,
    source_id: picked.detail.room,
    destination_id: picked.body,
  };
  return accepted(
    world,
    'harvested',
    [op],
    [
      event(world, command, mint, 1, {
        type: 'item_acquired',
        item_id: picked.item,
        holder_id: picked.body,
      }),
    ],
    [{ key: picked.detail.harvest!.narration, participants: { actor: picked.body } }],
  );
}
