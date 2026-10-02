import { compose, type Fault } from './compose.ts';
import type { DeltaOp } from './contracts.gen.ts';
import { row, type State, type World } from './decision.ts';

// The state after composing `ops` over the world's state, the fact defaults, the declared
// capacities, the resource specs and the barriers' initial states, or composition's fault. Only
// written sections join the state, so a world that never sets a fact, resource, cooldown,
// barrier or job keeps its earlier state hash.
export function apply(world: World, ops: readonly DeltaOp[]): { state: State } | { fault: Fault } {
  const base = {
    ...world.state,
    fact_defaults: world.factDefaults,
    capacities: world.capacities,
    resource_specs: world.resourceSpecs,
    barrier_initial: world.barrierInitial,
  };
  const result = compose(base as unknown as Parameters<typeof compose>[0], { ops });
  if ('fault' in result) return result;
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
