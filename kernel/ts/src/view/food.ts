import type { AdvertisedAction, CharacterId, EntityId, TextKey } from '../contracts.gen.ts';
import type { ActionSet } from '../commands/actions.ts';
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';
import { availability } from '../mechanics/food/shared.ts';
import { KernelError } from '../foundation/error.ts';
import { vesselUsable } from '../mechanics/liquid/shared.ts';

const FAULTS: readonly string[] = ['budget_exceeded', 'precondition_failed', 'containment_cycle'];

function drinkable(world: World, body: EntityId, id: EntityId, steps: Steps) {
  if (!world.cartridge.lock.capabilities.liquid) return false;
  const code = vesselUsable(world, body, id, steps);
  if (code && FAULTS.includes(code)) throw new KernelError(code);
  return !code;
}

export function foodActions(
  world: World,
  actor: CharacterId,
  id: string,
  set: ActionSet,
  steps: Steps,
): AdvertisedAction[] {
  const e = world.entities[id],
    body = bodyOf(world, actor);
  if (e?.kind !== 'item' || !body) return [];
  // A carried vessel offers Consume as Drink (loka-kgd.209); an edible only in the hand.
  if (
    e.vessel
      ? !drinkable(world, body, id as EntityId, steps)
      : !e.edible || world.state.containers[id] !== body
  )
    return [];
  return Object.values(set)
    .filter((a) => a.command === 'consume')
    .map((a) => {
      const result = availability(
        world,
        { type: 'consume', actor_id: actor, item_id: id as EntityId },
        steps,
        a.key,
      );
      if ('code' in result && FAULTS.includes(result.code)) throw new KernelError(result.code);
      const shown = {
        action_key: a.key,
        command: a.command,
        label: !a.engine ? a.label : e.vessel ? ('action.drink' as TextKey) : e.edible!.label,
        target: a.target,
        input: a.input,
        target_ids: [id as EntityId],
      };
      return 'code' in result
        ? { ...shown, available: false, reason: { code: result.code } }
        : { ...shown, available: true };
    });
}
