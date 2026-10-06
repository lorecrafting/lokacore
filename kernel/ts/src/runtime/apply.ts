import { hydrate } from './created.ts';
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
): { state: State; world: World } | { fault: Fault; limit?: Limit } {
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
    if (target.kind === 'quest' && value === null) delete written[name][at!];
    else written[name][at!] = value;
  }
  const state = { ...world.state, ...written, clock } as State;
  const hydrated = hydrate(world, state);
  return hydrated
    ? { state, world: hydrated }
    : { fault: { kind: 'fault', code: 'precondition_failed' } };
}

/** What compose reads for `world`: its state, the fact defaults, capacities, resource specs and
 * the barriers' initial states. */
export const base = (world: World) =>
  ({
    ...world.state,
    fuel_specs: world.fuelSpecs,
    known_entities: world.knownEntities,
    corpse_templates: world.corpseTemplates,
    population_specs: world.populationSpecs,
    fact_defaults: world.factDefaults,
    capacities: world.capacities,
    liquid_specs: world.liquidSpecs,
    resource_specs: world.resourceSpecs,
    entity_resource_specs: world.entityResourceSpecs,
    barrier_initial: world.barrierInitial,
  }) as unknown as Parameters<typeof compose>[0];
