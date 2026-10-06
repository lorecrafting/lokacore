import type { Command, DialogueDefinition, DeltaOp, EntityId } from '../../contracts.gen.ts';
import { KernelError } from '../../foundation/error.ts';
import { accepted, type ChoiceRow, type World } from '../../runtime/decision.ts';

export function wrongAnswer(
  world: World,
  command: Command,
  row: ChoiceRow,
  riddle: NonNullable<DialogueDefinition['riddle']>,
  participants: Record<string, EntityId>,
) {
  const ops: DeltaOp[] = [];
  if (riddle.wrong_limit !== undefined) {
    if (
      !row.attempts ||
      row.attempts.limit !== riddle.wrong_limit ||
      !row.quest_instance_id ||
      row.attempts.count >= row.attempts.limit
    )
      throw new KernelError('precondition_failed');
    const p = command.payload as Extract<Command['payload'], { type: 'choose' }>;
    ops.push({
      op: 'choice.attempt',
      writer_group: 0,
      continuation_id: p.continuation_id,
      actor_id: p.actor_id,
      source: row.source,
      quest_instance_id: row.quest_instance_id,
      expected_revision: row.opened_revision,
      prior_count: row.attempts.count,
    });
    if (row.attempts.count + 1 === row.attempts.limit)
      ops.push({ op: 'choice.close', writer_group: 0, continuation_id: p.continuation_id });
  }
  return accepted<never>(world, 'riddle_wrong', ops, [], [{ key: riddle.wrong, participants }]);
}

export function validAttempts(row: ChoiceRow, d: DialogueDefinition) {
  if (d.riddle?.wrong_limit === undefined) return row.attempts === undefined;
  const a = row.attempts;
  return (
    !!a &&
    a.limit === d.riddle.wrong_limit &&
    Number.isSafeInteger(a.count) &&
    a.count >= 0 &&
    a.count <= a.limit &&
    (row.status !== 'pending' || a.count < a.limit)
  );
}
