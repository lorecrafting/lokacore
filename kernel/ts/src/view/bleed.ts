import type { AdvertisedAction, CharacterId, EntityId, TextKey } from '../contracts.gen.ts';
import type { ActionSet } from '../commands/actions.ts';
import { bodyOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { availability } from '../mechanics/bleed/rule.ts';
import { currentBleed } from '../mechanics/bleed/shared.ts';

/** Only a directly held, currently legal bandage gets a projected treatment. */
export function bandageActions(
  world: World,
  actor: CharacterId,
  id: string,
  set: ActionSet,
  steps: Steps,
): AdvertisedAction[] {
  const body = bodyOf(world, actor);
  const row = body && currentBleed(world, body);
  const item = world.entities[id];
  if (!row || item?.kind !== 'item' || !item.bandage || world.state.containers[id] !== body)
    return [];
  const p = {
    type: 'bandage' as const,
    actor_id: actor,
    item_id: id as EntityId,
    effect_generation: row.generation,
  };
  return Object.values(set)
    .filter((a) => a.command === 'bandage')
    .flatMap((a) => {
      const result = availability(world, p, steps, a.key);
      return 'code' in result
        ? []
        : [
            {
              action_key: a.key,
              command: a.command,
              label: a.label,
              target: a.target,
              input: a.input,
              target_ids: [id as EntityId],
              available: true,
            },
          ];
    });
}

export function bleedingView(world: World, bleed: NonNullable<ReturnType<typeof currentBleed>>) {
  const spec = world.cartridge.bleeds![refString(bleed.effect!)];
  return {
    label: 'condition.bleeding' as TextKey,
    generation: bleed.generation,
    ends_at: bleed.ends_at!,
    next_tick_at: bleed.next_tick_at!,
    hp_loss: spec.hp_loss,
    tick_every: spec.tick_every,
  };
}
