// Same-plan population deadline pairing for due-job delivery (runtime/proposal.ts jobs): the
// resume job at the deadline and the plan's current job, when one advance runs both.
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
      b.due_time <= until && // both run in this advance, crossed sub-steps included (loka-dto9)
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
