// The policy evaluator (policy@1, fact@1's fact_compare, containment@1's has_item, schedule@1's
// time_window, barrier@1's barrier_state, quest@1's quest_state, target_resolution@1's
// target_present, attributes@1's stat_compare and resource_compare; 21 §3.2, §4 Policy; 06
// §20-21): pure, over committed state, for one actor and the target of the action evaluated, if any.
import type { CharacterId, EntityId, Policy } from './contracts.gen.ts';
import { barrierState, bodyOf, questOf, refString, type World } from './decision.ts';
import { key } from './compose.ts';
import { value } from './fact.ts';
import { level } from './resource.ts';
import { present } from './target.ts';

/**
 * True when the condition tree holds for `actor` in `world`, `ctx.target` the action's target
 * (target_present is false without one); each leaf it evaluates adds one to `ctx.steps.n`
 * (04 §5.4 query_steps).
 */
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
    case 'quest_state': // false in every state while the actor has no instance
      return questOf(world, actor, p.quest)?.[1].state === p.state;
    case 'time_window': {
      // One unit is one second and time 0 is midnight (command.schema.json LogicalTime).
      const hour = Math.floor(world.state.clock / 3600) % 24;
      return p.from < p.to ? p.from <= hour && hour < p.to : hour >= p.from || hour < p.to;
    }
    case 'target_present':
      return ctx.target !== undefined && present(world, actor, ctx.target);
    case 'stat_compare':
    case 'resource_compare':
      return atLeast(world, actor, p);
    default:
      throw new Error(`policy op ${(p as Policy).op} is not installed`);
  }
}

// attributes@1's leaves: the actor's value of the attribute, or the current value of the pool on
// the actor's body (none without a body), is at least at_least. ponytail: an attribute's value is
// its start for every actor; per-actor values wait for their first writer (training, ancestry).
function atLeast(
  world: World,
  actor: CharacterId,
  p: Extract<Policy, { op: 'stat_compare' | 'resource_compare' }>,
): boolean {
  if (p.op === 'stat_compare') return world.attributes[key(p.attribute)] >= p.at_least;
  const body = bodyOf(world, actor);
  return body !== undefined && level(world, body, p.resource)! >= p.at_least;
}

// `item` is inside `holder`, directly or through the items it is in (the loader and compose
// keep containers acyclic, so the climb ends at a room).
function held(world: World, item: string, holder: string | undefined): boolean {
  for (let at = world.state.containers[item]; at !== undefined; at = world.state.containers[at])
    if (at === holder) return true;
  return false;
}
