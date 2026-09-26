// schedule@1 (capability_registry.json): wait advances the logical clock to `until` as one
// explicit advance (04 §5.4; command.schema.json wait): a time.advance from now, no event. An
// `until` not later than now is invalid_state and changes nothing. run_job is not implemented:
// unsupported_capability.
// ponytail: no jobs exist yet, so the advance's due set is empty; 04 §5.4's due-job processing
// (snapshot the due set up to `until`, run each in (due_time, job_id) order in this proposal)
// joins with the schedule slice.
import { accepted, rejected, type Rule } from '../decision.ts';

export const decide: Rule<'schedule'> = (world, command) => {
  if (command.payload.type !== 'wait') return rejected('unsupported_capability');
  const from = world.state.clock;
  const to = command.payload.until;
  if (to <= from) return rejected('invalid_state');
  return accepted(world, 'waited', [{ op: 'time.advance', writer_group: 0, from, to }], []);
};
