// Toolbox row W24 load check (docs/system/save.md, Quest deadline recovery): a job row with a quest
// instance names a quest with a deadline; a generic deadline's row belongs to the save's character
// and, while its instance row exists (gone only after retirement), to that instance's quest and actor.
import { refString, type JobRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';

export function foreignDeadlineJob(world: World, job: JobRow) {
  const deadline = world.cartridge.quests?.[refString(job.job)]?.deadline;
  const q = world.state.quests?.[job.quest_instance_id!];
  if (!deadline) return true;
  return (
    !deadline.fact &&
    (job.actor_id !== world.character ||
      (!!q &&
        (refString(q.quest) !== refString(job.job) ||
          q.scope.kind !== 'player' ||
          q.scope.character_id !== job.actor_id)))
  );
}
