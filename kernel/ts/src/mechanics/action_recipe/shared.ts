// Toolbox row G4: a use recipe (RecipeTarget kind use, action.schema.json) applies a held tool to
// another item on the floor or carried, both chosen by the invocation (perform item_id, target_id). The recipe is
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
import { holds } from '../policy.ts';
import { folded } from '../speech/shared.ts';

export type UseTarget = Extract<RecipeTarget, { kind: 'use' }>;

/**
 * Why `body` may not use `tool` on `target` now, before the recipe's policy, shared by the rule,
 * step's admission and the GameView: invalid_target unless both are distinct items; not_present
 * unless the tool is held (in the body, directly or in an open container) and the target is on the
 * room's floor or directly in the body (the offer's target scopes, room_contents and inventory,
 * commands/actions.ts cartridge); invalid_target when the tool lacks the UseTool's tag or liquid. A reach fault code
 * (budget_exceeded, containment_cycle) on the tool is returned as is.
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
  const held = reach(world, body, tool!, steps, true);
  if (held !== true) return held || ('not_present' as const);
  const at = world.state.containers[target!];
  if (at !== body && at !== world.state.containers[body]) return 'not_present' as const;
  return fits(world, tool!, t.tool) ? undefined : ('invalid_target' as const);
}

/** The tool has the UseTool's tag and holds some of its liquid. */
export function fits(world: World, tool: EntityId, { tag, liquid }: UseTool) {
  const e = world.entities[tool]!;
  const row = world.state.liquids?.[tool];
  return (
    (!tag || (e.kind === 'item' && !!e.tags?.includes(tag))) &&
    (!liquid || (!!row?.kind && refString(row.kind) === refString(liquid))) // empty: kind null
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

/** Toolbox row 29a: the spell recipe whose word is `word`, case-folded (speech/shared.ts folded). */
export const spellOf = (world: World, word: unknown) => {
  const w = folded(word);
  return Object.values(world.cartridge.recipes ?? {}).find(
    (r) => r.target.kind === 'spell' && r.target.word === w,
  );
};

/**
 * step's admission of a cast (commands/actions.ts refusal), before the spell's costs: invalid_state
 * for an unknown word and for a spell whose policy fails alike, so a refusal never tells which
 * words are spells.
 */
export function castAdmission(world: World, payload: CommandPayload, steps: Steps) {
  if (payload.type !== 'cast') return undefined;
  const spell = spellOf(world, payload.word);
  return spell && holds(world, payload.actor_id, spell.policy.root, { steps })
    ? undefined
    : ('invalid_state' as const);
}
