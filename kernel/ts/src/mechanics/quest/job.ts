// Toolbox row W24: the engine job of a generic quest deadline (quest.schema.json deadline;
// lifecycle.ts begun schedules it at activation). At expiry it fails the open instance with the
// authored outcome and emits quest@1's quest_failed, so penalties are reactions; an instance
// already closed or retired (resolved earlier, a repeatable re-run) only completes the job; an
// instance of another quest or actor is a corrupt row (precondition_failed, as the legacy job).
import type { Command, JobId } from '../../contracts.gen.ts';
import { accepted, event, refString } from '../../runtime/decision.ts';
import type { JobRow, Mint, World } from '../../runtime/decision.ts';

export function expire(
  world: World,
  command: Pick<Command, 'id'>,
  jobId: JobId,
  row: JobRow,
  mint: Mint,
) {
  const done = { op: 'job.complete', writer_group: 0, job_id: jobId } as const;
  const instance_id = row.quest_instance_id!;
  const quest = world.state.quests?.[instance_id];
  if (!quest) return accepted<never>(world, 'job_ran', [done], []);
  if (
    refString(quest.quest) !== refString(row.job) ||
    quest.scope.kind !== 'player' ||
    quest.scope.character_id !== row.actor_id
  )
    return { kind: 'fault', code: 'precondition_failed' } as const;
  if (!['active', 'objectives_complete'].includes(quest.state))
    return accepted<never>(world, 'job_ran', [done], []);
  const outcome = world.cartridge.quests![refString(row.job)]!.deadline!.outcome;
  const failed = { type: 'quest_failed', quest: quest.quest, instance_id, outcome } as const;
  const by = { id: command.id, payload: { actor_id: row.actor_id! } };
  const visit = { ...world, state: { ...world.state, clock: row.due_time } };
  return accepted(
    world,
    'job_ran',
    [
      {
        op: 'quest.transition',
        writer_group: 0,
        instance_id,
        from: quest.state,
        to: 'failed',
        outcome,
      },
      done,
    ],
    [event(visit, by, mint, 1, failed)],
  );
}
