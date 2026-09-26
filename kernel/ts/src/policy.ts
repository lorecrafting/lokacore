// The policy evaluator (policy@1, fact@1's fact_compare, containment@1's has_item, schedule@1's
// time_window, barrier@1's barrier_state; 21 §3.2, §4 Policy; 06 §21): pure, over committed state, for one actor. Every other op belongs to a
// capability this kernel does not install, so the loader rejects a cartridge that uses one
// (CAPABILITY_NOT_INSTALLED).
import type { CharacterId, Policy } from './contracts.gen.ts';
import { barrierState, bodyOf, refString, type World } from './decision.ts';
import { value } from './fact.ts';

/** True when the condition tree holds for `actor` in `world`. */
export function holds(world: World, actor: CharacterId, p: Policy): boolean {
  switch (p.op) {
    case 'all':
      return p.items.every((i) => holds(world, actor, i));
    case 'any':
      return p.items.some((i) => holds(world, actor, i));
    case 'not':
      return !holds(world, actor, p.item);
    case 'fact_compare':
      return value(world, actor, p.fact) === p.equals;
    case 'has_item':
      return held(world, world.entityIds[refString(p.item)], bodyOf(world, actor));
    case 'barrier_state':
      return barrierState(world, p.barrier) === p.equals;
    case 'time_window': {
      // One unit is one second and time 0 is midnight (command.schema.json LogicalTime).
      const hour = Math.floor(world.state.clock / 3600) % 24;
      return p.from < p.to ? p.from <= hour && hour < p.to : hour >= p.from || hour < p.to;
    }
    default:
      throw new Error(`policy op ${p.op} is not installed`);
  }
}

// `item` is inside `holder`, directly or through the items it is in (the loader and compose
// keep containers acyclic, so the climb ends at a room).
function held(world: World, item: string, holder: string | undefined): boolean {
  for (let at = world.state.containers[item]; at !== undefined; at = world.state.containers[at])
    if (at === holder) return true;
  return false;
}
