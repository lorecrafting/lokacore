// Toolbox row G4: a use recipe (RecipeTarget kind use, action.schema.json) applies a held tool to
// another item on the floor or carried, both chosen by the invocation (perform item_id, target_id). The recipe is
// keyed by the tool's properties (UseTool) and, through its policy, the target's; never by ids.
import type {
  ActionRecipe,
  CharacterId,
  CommandPayload,
  DeltaOp,
  EntityId,
  RecipeTarget,
  UnavailableReason,
  UseTool,
  Word,
} from '../../contracts.gen.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { carryingExchange, giveRefused } from '../containment/shared.ts';
import { free, holder } from '../containment/job.ts';
import { selected } from '../containment/stock.ts';
import { value as factValue } from '../fact.ts';
import { toolHeld } from '../lookups.ts';
import { holds } from '../policy.ts';
import { unbuildable } from '../service/build.ts';
import { folded } from '../speech/shared.ts';
import { living } from '../death/shared.ts';
import { held } from '../light/shared.ts';

export type UseTarget = Extract<RecipeTarget, { kind: 'use' }>;

/**
 * Why `body` may not use `tool` on `target` now, before the recipe's policy, shared by the rule,
 * step's admission and the GameView: invalid_target unless both are distinct items; not_present
 * unless the tool is held (lookups.ts toolHeld, the held-tool rule) and the target is on the
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
  const held = toolHeld(world, body, tool!, steps);
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
  return body
    ? useRefused(world, recipe.target, body, item_id, target_id, steps)
    : ('not_found' as const);
}

/**
 * Toolbox row 29a: the spell recipe whose word is `word`, case-folded (speech/shared.ts folded),
 * while `actor` has learned it (word bar S2: its learned fact reads true); an unlearned spell is
 * no spell to its caster.
 */
export const spellOf = (world: World, actor: CharacterId, word: unknown) => {
  const w = folded(word);
  return Object.values(world.cartridge.recipes ?? {}).find(
    (r) =>
      r.target.kind === 'spell' &&
      r.target.word === w &&
      factValue(world, actor, r.target.learned) === true,
  );
};

/**
 * step's admission of a cast (commands/actions.ts refusal), before the spell's costs: invalid_state
 * for an unknown or unlearned word and for a spell whose policy fails alike, so a refusal never tells which
 * words are spells; in a fight, also for a spell with a duration (row 29b: its time.advance would
 * run the round job inside the cast).
 */
export function castAdmission(
  world: World,
  payload: CommandPayload,
  steps: Steps,
): UnavailableReason | undefined {
  if (payload.type !== 'cast') return undefined;
  const spell = spellOf(world, payload.actor_id, payload.word);
  // no `!body` guard: step refuses a foreign (bodiless) actor not_found before admission
  const body = bodyOf(world, payload.actor_id);
  const busy = !!spell?.duration && !!body && !!engaged(world, body);
  if (!spell || busy) return { code: 'invalid_state' };
  const id = payload.target_id;
  const aimed = spell.target.kind === 'spell' ? spell.target.aimed : undefined;
  if (aimed ? !aimedAt(world, body!, id, aimed.scopes) : id) return { code: 'invalid_target' };
  return holds(world, payload.actor_id, spell.policy.root, { target: id, steps })
    ? undefined
    : policyRefusal(spell);
}

/** An aimed spell's target (loka-x6t.109): held by the caster (its light slot too), or a living npc or an item in its room. */
const aimedAt = (
  world: World,
  body: EntityId,
  id: EntityId | undefined,
  scopes: readonly string[],
) => {
  if (!id || !living(world, id)) return false;
  const at = world.state.containers[id];
  const kind = world.entities[id]?.kind;
  return scopes.some((s) =>
    s === 'inventory'
      ? held(world, body, id)
      : at === world.state.containers[body] && kind === (s === 'room_occupants' ? 'npc' : 'item'),
  );
};

/** Whether a view hides aimed spell `recipe` on `id` (loka-x6t.109): its cast there is refused. */
export const aimedRefused = (
  world: World,
  actor: CharacterId,
  recipe: ActionRecipe | undefined,
  id: string,
  steps: Steps,
) =>
  recipe?.target.kind === 'spell' &&
  !!castAdmission(
    world,
    {
      type: 'cast',
      actor_id: actor,
      word: recipe.target.word as string as Word,
      target_id: id as EntityId,
    },
    steps,
  );

/** A failed policy's refusal, carrying the recipe's authored `reason` text when it has one (loka-j64e). */
export const policyRefusal = (recipe?: ActionRecipe): UnavailableReason =>
  recipe?.reason
    ? { code: 'invalid_state', message: { key: recipe.reason } }
    : { code: 'invalid_state' };

export type Transfer = Extract<DeltaOp, { op: 'entity.transfer' }>;
const transfer = (
  entity_id: EntityId,
  source_id: EntityId,
  destination_id: EntityId,
): Transfer => ({
  op: 'entity.transfer',
  writer_group: 0,
  entity_id,
  source_id,
  destination_id,
});

/**
 * Homestead hs-10: a station recipe's craft, read before any draw. The first `quantity` consume
 * items held directly in the body (lowest EntityId, each one Give would let go) move to `to`, and
 * one yield item directly in `from` moves to the body; fewer held refuses invalid_state with the
 * consume reason, a full `to` or an empty `from` without one, a body that cannot carry the
 * exchange too_heavy.
 */
export function crafted(
  world: World,
  recipe: ActionRecipe,
  body: EntityId,
  steps: Steps,
): UnavailableReason | { consumed: Transfer[]; made: Transfer[] } {
  const { consume, yield: made } = recipe.craft ?? {};
  const ids = consume ? selected(world, consume.items, body, consume.quantity, steps) : [];
  if (typeof ids === 'string') return { code: ids };
  if (consume && ids.length < consume.quantity)
    return consume.reason
      ? { code: 'invalid_state', message: { key: consume.reason } }
      : { code: 'invalid_state' };
  for (const id of ids) {
    const code = giveRefused(world, id, steps);
    if (code) return { code };
  }
  const to = consume && holder(world, consume.to);
  const left = to ? free(world, to, steps) : Infinity; // a full `to` refuses as a full put does
  if (typeof left === 'string') return { code: left };
  if (left < ids.length) return { code: 'invalid_state' };
  const from = made && holder(world, made.from);
  const out = made ? selected(world, made.items, from!, 1, steps) : [];
  if (typeof out === 'string') return { code: out };
  if (made && !out.length) return { code: 'invalid_state' };
  const code = carryingExchange(world, body, ids, out, steps);
  if (code) return { code };
  return {
    consumed: ids.map((id) => transfer(id, body, to!)),
    made: out.map((id) => transfer(id, from!, body)),
  };
}

/** A craft's refusal for the command (commands/actions.ts) and its offer (view/action_lists.ts):
 * (Built rooms S6) its build step's first, as the build service's (service/build.ts unbuildable),
 * so a taken site shows site_taken, not the spent inputs. */
export const craftRefused = (
  world: World,
  recipe: ActionRecipe | undefined,
  actor: CharacterId,
  steps: Steps,
) => {
  const s = recipe?.outcomes.success.sequence.find((x) => x.op === 'build');
  const b =
    s &&
    recipe!.target.kind === 'detail' &&
    unbuildable(
      world,
      { blueprint: s.blueprint, site: recipe!.target.room, direction: s.direction },
      actor,
    );
  if (b) return b;
  const body = bodyOf(world, actor);
  const c = recipe?.craft && body && crafted(world, recipe, body, steps);
  return c && 'code' in c ? c : undefined;
};
