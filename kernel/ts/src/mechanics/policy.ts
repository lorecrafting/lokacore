import { illuminated } from './light/shared.ts';
// The policy evaluator (policy@1, fact@1's fact_compare, containment@1's has_item, schedule@1's
// time_window, barrier@1's barrier_state, quest@1's quest_state, target_resolution@1's
// target_present, attributes@1's stat_compare and resource_compare, tags@1's has_tag; 21 §3.2,
// §4 Policy; 06 §20-21): pure, over committed state, for one actor and the target of the action
// evaluated, if any.
import type { CharacterId, EntityId, Policy, Tag } from '../contracts.gen.ts';
import { bodyOf, refString, type World } from '../runtime/decision.ts';
import { barrierState, questOf } from './lookups.ts';
import { key } from '../foundation/compose.ts';
import { value } from './fact.ts';
import { level } from './resource.ts';
import { stateIs } from './escort/shared.ts';
import { present } from '../commands/target.ts';
import { hourOf } from './calendar.ts';
import { value as attributeValue } from './attributes/shared.ts';

/**
 * True when the condition tree holds for `actor` in `world`, `ctx.target` the action's target
 * (target_present is false without one); each leaf it evaluates adds one to `ctx.steps.n`
 * (04 §5.4 query_steps).
 */
// size: allow 60, one case per policy leaf (mechanics.md policy leaf set, toolbox row G1)
export function holds(
  world: World,
  actor: CharacterId,
  p: Policy,
  ctx: { target?: EntityId; steps: { n: number } } = { steps: { n: 0 } },
): boolean {
  switch (p.op) {
    case 'all':
      return p.items.every((i) => holds(world, actor, i, ctx));
    case 'any':
      return p.items.some((i) => holds(world, actor, i, ctx));
    case 'not':
      return !holds(world, actor, p.item, ctx);
  }
  ctx.steps.n++;
  switch (p.op) {
    case 'fact_compare':
      return value(world, actor, p.fact) === p.equals;
    case 'has_item':
      return held(world, world.entityIds[refString(p.item)], bodyOf(world, actor));
    case 'barrier_state':
      return barrierState(world, p.barrier) === p.equals;
    case 'escort_state':
      return stateIs(world, actor, p.quest, p.state);
    case 'quest_state': // false in every state while the actor has no instance
      return questOf(world, actor, p.quest)?.[1].state === p.state;
    case 'time_window': {
      const hour = hourOf(world.cartridge, world.state.clock);
      return p.from < p.to ? p.from <= hour && hour < p.to : hour >= p.from || hour < p.to;
    }
    case 'target_present':
      return ctx.target !== undefined && present(world, actor, ctx.target, ctx.steps);
    case 'light_off':
    case 'stat_compare':
    case 'resource_compare':
      return atLeast(world, actor, p, ctx.steps);
    case 'has_tag':
      return tagsOf(world, actor, p, ctx.target)?.includes(p.tag) === true;
    default: {
      const leaf: never = p; // a schema leaf without its case here fails tsc
      throw new Error(`policy op ${(leaf as Policy).op} is not installed`);
    }
  }
}

// attributes@1's leaves: the actor's saved value or definition start, or the current body pool.
function atLeast(
  world: World,
  actor: CharacterId,
  p: Extract<Policy, { op: 'stat_compare' | 'resource_compare' | 'light_off' }>,
  steps: { n: number },
): boolean {
  if (p.op === 'light_off') return !illuminated(world, actor, steps);
  if (p.op === 'stat_compare') return attributeValue(world, actor, p.attribute) >= p.at_least;
  const body = bodyOf(world, actor);
  return body !== undefined && level(world, body, p.resource)! >= p.at_least;
}

// tags@1's subjects: a named definition (a constant), the target item's or the actor's room's.
function tagsOf(
  world: World,
  actor: CharacterId,
  p: Extract<Policy, { op: 'has_tag' }>,
  target: EntityId | undefined,
): readonly Tag[] | undefined {
  if (p.item) return world.cartridge.items?.[refString(p.item)]?.tags;
  if (p.barrier) return world.cartridge.barriers?.[refString(p.barrier)]?.tags;
  if (p.room) return world.rooms[world.roomIds[refString(p.room)]!]?.tags;
  if (p.subject === 'room')
    return world.rooms[world.state.containers[bodyOf(world, actor)!]!]?.tags;
  const entity = target === undefined ? undefined : world.entities[target];
  return entity?.kind === 'item' ? entity.tags : undefined;
}

// `item` is inside `holder`, directly or through the items it is in (the loader and compose
// keep containers acyclic, so the climb ends at a room).
function held(world: World, item: string, holder: string | undefined): boolean {
  for (let at = world.state.containers[item]; at !== undefined; at = world.state.containers[at])
    if (at === holder) return true;
  return false;
}
