// Toolbox row G4: each use recipe offered on a held tool, once per item it is admitted on, by
// step's own admission (commands/actions.ts refusal, mechanics/action_recipe/shared.ts useRefused, the recipe's policy) and
// the recipe's cooldown and costs; target_ids [target, tool] fill perform's target_id, item_id.
import { LIMITS } from '../contracts.gen.ts';
import type { AdvertisedAction, CharacterId, EntityId, Key } from '../contracts.gen.ts';
import { admission, refusal, type ActionSet } from '../commands/actions.ts';
import { bodyOf, type Steps, type World } from '../runtime/decision.ts';
import { reach } from '../mechanics/lookups.ts';
import { cmp } from '../foundation/validate.ts';

export function useActions(
  world: World,
  actor: CharacterId,
  tool: string,
  set: ActionSet,
  steps: Steps,
): AdvertisedAction[] {
  const body = bodyOf(world, actor);
  if (!body || reach(world, body, tool as EntityId, steps, true) !== true) return [];
  return Object.values(set)
    .filter((a) => a.recipe?.target.kind === 'use')
    .sort((a, b) => b.priority - a.priority || cmp(a.key, b.key))
    .flatMap((a) => {
      const shown = { action_key: a.key, label: a.label, target: a.target, input: a.input };
      const pairs: AdvertisedAction[] = [];
      for (const id of Object.keys(world.entities)) {
        if (++steps.n > LIMITS.query_steps)
          return [{ ...shown, available: false, reason: { code: 'budget_exceeded' } }];
        if (id === tool || world.entities[id]!.kind !== 'item') continue;
        const ids = { target_id: id as EntityId, item_id: tool as EntityId };
        const payload = { type: 'perform', actor_id: actor, action: a.key as Key, ...ids } as const;
        const code = refusal(world, payload, steps, a.key, set);
        if (code === 'budget_exceeded') return [{ ...shown, available: false, reason: { code } }];
        if (code) continue;
        const admitted = admission(world, a.recipe!, actor, body);
        const listed = { ...shown, target_ids: [ids.target_id, ids.item_id] };
        pairs.push(
          typeof admitted === 'string'
            ? { ...listed, available: false, reason: { code: admitted } }
            : { ...listed, available: true },
        );
      }
      return pairs;
    });
}
