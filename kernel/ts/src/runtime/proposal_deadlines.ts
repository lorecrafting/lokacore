// Same-plan population deadline pairing for due-job delivery (runtime/proposal.ts jobs).
import { encode } from '../foundation/canonical.ts';
import type { World } from './decision.ts';

export function populationDeadlinePairs(world: World, until: number) {
  const pairs = new Map<string, string>();
  for (const [plan, control] of Object.entries(world.state.population_plans ?? {})) {
    const resume = control.suppression?.job_id;
    const regular = control.job_id;
    const a = resume && world.state.jobs?.[resume];
    const b = world.state.jobs?.[regular];
    if (
      resume &&
      a?.status === 'pending' &&
      b?.status === 'pending' &&
      a.due_time === b.due_time &&
      a.due_time === control.suppression?.ends_at &&
      a.due_time <= until &&
      encode(a.job) === plan &&
      encode(b.job) === plan
    ) {
      pairs.set(resume, regular);
      pairs.set(regular, resume);
    }
  }
  return pairs;
}
