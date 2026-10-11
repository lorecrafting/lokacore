// A detail selects from finite authored room-held stock; Take remains the ordinary custody path.
import {
  LIMITS,
  type CharacterId,
  type EntityId,
  type Command,
  type Tag,
} from '../../contracts.gen.ts';
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
import { carryingExchange } from './shared.ts';
import { status } from '../skills.ts';
import { fits } from '../action_recipe/shared.ts';
import { toolHeld } from '../lookups.ts';

export function harvest(
  world: World,
  actor: CharacterId,
  target: EntityId,
  steps: Steps,
  method?: 'careful',
) {
  const detail = world.details[target],
    body = bodyOf(world, actor);
  if (!detail?.harvest || !body) return 'invalid_target' as const;
  if (detail.room !== world.state.containers[body]) return 'not_present' as const;
  const tool = detail.harvest.tool && tagHeld(world, body, detail.harvest.tool.tag, steps);
  if (tool === false) return 'invalid_state' as const;
  if (typeof tool === 'string') return tool;
  const careful = method && detail.harvest.careful;
  if (method && (!careful || !status(world, actor, careful.skill, steps).usable))
    return 'invalid_state' as const;
  const count = careful ? careful.count : 1;
  const ids = selected(world, detail.harvest.items, detail.room, count, steps);
  if (typeof ids === 'string') return ids;
  if (ids.length !== count) return 'not_found' as const;
  const code = carryingExchange(world, body, [], ids, steps);
  return (
    code ?? {
      items: ids,
      body,
      detail,
      narration: careful ? careful.narration : detail.harvest.narration,
    }
  );
}

// Toolbox row 19: some item declaring the tag is held (lookups.ts toolHeld, the held-tool rule);
// the walk is in EntityId order, one query step per entity.
function tagHeld(world: World, body: EntityId, tag: Tag, steps: Steps) {
  for (const id of (Object.keys(world.entities) as EntityId[]).sort()) {
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
    if (!fits(world, id, { tag })) continue;
    const held = toolHeld(world, body, id, steps);
    if (held !== false) return held;
  }
  return false;
}

export function decideHarvest(
  world: World,
  command: Command & { payload: Extract<Command['payload'], { type: 'harvest' }> },
  mint: Mint,
  steps: Steps,
) {
  const p = command.payload;
  const picked = harvest(world, p.actor_id, p.target_id, steps, p.method);
  if (typeof picked === 'string')
    return ['budget_exceeded', 'containment_cycle', 'precondition_failed'].includes(picked)
      ? {
          kind: 'fault' as const,
          code: picked as 'budget_exceeded' | 'containment_cycle' | 'precondition_failed',
        }
      : rejected(picked);
  const ops = picked.items.map((item) => ({
    op: 'entity.transfer' as const,
    writer_group: 0,
    entity_id: item,
    source_id: picked.detail.room,
    destination_id: picked.body,
  }));
  return accepted(
    world,
    'harvested',
    ops,
    picked.items.map((item, i) =>
      event(world, command, mint, i + 1, {
        type: 'item_acquired',
        item_id: item,
        holder_id: picked.body,
      }),
    ),
    [{ key: picked.narration, participants: { actor: picked.body } }],
  );
}
