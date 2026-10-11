// Toolbox row G4: a use recipe (RecipeTarget kind use, action.schema.json) applies a held tool to
// another item in reach, both chosen by the invocation (perform item_id, target_id). The recipe is
// keyed by the tool's properties (UseTool) and, through its policy, the target's; never by ids.
import type {
  ActionRecipe,
  CommandPayload,
  EntityId,
  RecipeTarget,
  UseTool,
} from '../../contracts.gen.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { reach } from '../lookups.ts';

export type UseTarget = Extract<RecipeTarget, { kind: 'use' }>;

/**
 * Why `body` may not use `tool` on `target` now, before the recipe's policy, shared by the rule,
 * step's admission and the GameView: invalid_target unless both are distinct items; not_present
 * unless the tool is held (in the body, directly or in an open container) and the target in reach;
 * invalid_target when the tool lacks the UseTool's tag or liquid. A reach fault code
 * (budget_exceeded, containment_cycle) is returned as is.
 */
export function useRefused(
  world: World,
  t: UseTarget,
  body: EntityId,
  tool: EntityId | undefined,
  target: EntityId | undefined,
  steps: Steps,
) {
  const item = (id?: EntityId) => id !== undefined && world.entities[id]?.kind === 'item';
  if (!item(tool) || !item(target) || tool === target) return 'invalid_target' as const;
  for (const reached of [
    reach(world, body, tool!, steps, true),
    reach(world, body, target!, steps),
  ])
    if (reached !== true) return reached || ('not_present' as const);
  return fits(world, tool!, t.tool) ? undefined : ('invalid_target' as const);
}

function fits(world: World, tool: EntityId, { tag, liquid }: UseTool) {
  const e = world.entities[tool]!;
  const row = world.state.liquids?.[tool];
  return (
    (!tag || (e.kind === 'item' && !!e.tags?.includes(tag))) &&
    (!liquid || (!!row?.kind && refString(row.kind) === refString(liquid) && row.quantity > 0))
  );
}

/** step's admission of a use recipe's perform (commands/actions.ts refusal): useRefused. */
export function useAdmission(
  world: World,
  recipe: ActionRecipe | undefined,
  payload: CommandPayload,
  steps: Steps,
) {
  if (recipe?.target.kind !== 'use' || payload.type !== 'perform') return undefined;
  const body = bodyOf(world, payload.actor_id);
  const { item_id, target_id } = payload;
  return body ? useRefused(world, recipe.target, body, item_id, target_id, steps) : 'not_found';
}
