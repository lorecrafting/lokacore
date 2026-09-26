// The policy evaluator (policy@1 and fact@1's fact_compare; 21 §3.2, §4 Policy; 06 §21): pure,
// over committed state, for one actor. Every other op belongs to a capability this kernel does
// not install, so the loader rejects a cartridge that uses one (CAPABILITY_NOT_INSTALLED).
import type { CharacterId, Policy } from './contracts.gen.ts';
import type { World } from './decision.ts';
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
    default:
      throw new Error(`policy op ${p.op} is not installed`);
  }
}
