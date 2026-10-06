import { LIMITS, type DefinitionRef, type EntityId } from '../../contracts.gen.ts';
import { refString, type Steps, type World } from '../../runtime/decision.ts';

/** Inspect only the authored identity set, charging the shared command query budget. */
export function selected(
  world: World,
  refs: readonly DefinitionRef[],
  holder: EntityId,
  quantity: number,
  steps: Steps,
): EntityId[] | 'budget_exceeded' {
  const ids: EntityId[] = [];
  for (const ref of refs) {
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded';
    const id = world.entityIds[refString(ref)];
    if (world.entities[id]?.kind === 'item' && world.state.containers[id] === holder) ids.push(id);
  }
  return ids.sort().slice(0, quantity);
}
