import { compose, counts, over, type Fault, type Limit } from '../foundation/compose.ts';
import type { DeltaOp } from '../contracts.gen.ts';
import { row, type State, type World } from './decision.ts';

// The state after composing `ops` over the world's state, the fact defaults, the declared
// capacities, the resource specs and the barriers' initial states, or composition's fault. Only
// written sections join the state, so a world that never sets a fact, resource, cooldown,
// barrier or job keeps its earlier state hash. A budget fault names its limit (compose counts).
export function apply(
  world: World,
  ops: readonly DeltaOp[],
): { state: State } | { fault: Fault; limit?: Limit } {
  const result = compose(base(world), { ops });
  if ('fault' in result)
    return result.fault.code === 'budget_exceeded'
      ? { ...result, limit: over(counts(base(world), ops))! }
      : result;
  // ponytail: copies each written section per call (O(rows)); persistent maps when big.
  const written: Record<string, Record<string, unknown>> = {};
  let clock = world.state.clock;
  for (const { target, value } of result.changes) {
    if (target.kind === 'clock') clock = value as number;
    const [name, at] = row(target) ?? [];
    if (!name) continue;
    written[name] ??= { ...world.state[name] };
    written[name][at!] = value;
  }
  return { state: { ...world.state, ...written, clock } as State };
}

/** What compose reads for `world`: its state, the fact defaults, capacities, resource specs and
 * the barriers' initial states. */
export const base = (world: World) =>
  ({
    ...world.state,
    fact_defaults: world.factDefaults,
    capacities: world.capacities,
    resource_specs: world.resourceSpecs,
    entity_resource_specs: world.entityResourceSpecs,
    barrier_initial: world.barrierInitial,
  }) as unknown as Parameters<typeof compose>[0];
