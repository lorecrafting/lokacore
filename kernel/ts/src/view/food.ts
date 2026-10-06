import type { AdvertisedAction, CharacterId, EntityId } from '../contracts.gen.ts';
import type { ActionSet } from '../commands/actions.ts';
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';
import { availability } from '../mechanics/food/shared.ts';
import { KernelError } from '../foundation/error.ts';

export function foodActions(
  world: World,
  actor: CharacterId,
  id: string,
  set: ActionSet,
  steps: Steps,
): AdvertisedAction[] {
  const e = world.entities[id];
  if (e?.kind !== 'item' || !e.edible || world.state.containers[id] !== bodyOf(world, actor))
    return [];
  return Object.values(set)
    .filter((a) => a.command === 'eat')
    .map((a) => {
      const result = availability(
        world,
        { type: 'eat', actor_id: actor, item_id: id as EntityId },
        steps,
        a.key,
      );
      if ('code' in result && ['budget_exceeded', 'precondition_failed'].includes(result.code))
        throw new KernelError(result.code);
      const shown = {
        action_key: a.key,
        command: a.command,
        label: a.engine ? e.edible!.label : a.label,
        target: a.target,
        input: a.input,
        target_ids: [id as EntityId],
      };
      return 'code' in result
        ? { ...shown, available: false, reason: { code: result.code } }
        : { ...shown, available: true };
    });
}
