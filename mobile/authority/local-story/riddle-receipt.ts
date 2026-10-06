import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import type { ChoiceRow } from '../../../kernel/ts/src/runtime/decision.ts';

export function attemptEvidence(
  d: Extract<DecisionResult, { kind: 'accepted' }>,
  command: Command & { payload: Extract<Command['payload'], { type: 'choose' }> },
  row: ChoiceRow,
) {
  const op = d.delta.ops[0];
  if (
    !row.attempts ||
    op?.op !== 'choice.attempt' ||
    !Number.isSafeInteger(op.prior_count) ||
    op.prior_count < 0 ||
    op.prior_count >= row.attempts.limit
  )
    return false;
  const close = op.prior_count + 1 === row.attempts.limit;
  return (
    d.outcome === 'riddle_wrong' &&
    !d.events.length &&
    !d.effects.length &&
    d.narration?.length === 1 &&
    same(op, {
      op: 'choice.attempt',
      writer_group: 0,
      continuation_id: command.payload.continuation_id,
      actor_id: command.payload.actor_id,
      source: row.source,
      quest_instance_id: row.quest_instance_id,
      expected_revision: row.opened_revision,
      prior_count: op.prior_count,
    }) &&
    d.delta.ops.length === (close ? 2 : 1) &&
    (!close ||
      same(d.delta.ops[1], {
        op: 'choice.close',
        writer_group: 0,
        continuation_id: command.payload.continuation_id,
      }))
  );
}
