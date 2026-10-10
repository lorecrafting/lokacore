import type {
  Command,
  DialogueChoice,
  DialogueDefinition,
  DeltaOp,
  EntityId,
} from '../../contracts.gen.ts';
import { KernelError } from '../../foundation/error.ts';
import {
  accepted,
  event,
  type Accepted,
  type ChoiceRow,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { continuationId } from './shared.ts';
import { reopens } from './selection.ts';

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

/**
 * The dialogue hub (mechanics.md dialogue@1; owner OK in Beads loka-x6t.5): `decided` plus a fresh
 * pending row of the same sitting (`choice.open` of the row's own bound fields, never rebound) and
 * its `choice_opened` after `choice_resolved`, unless the answer ends the conversation: its
 * dialogue resolves a quest or declares a riddle, it sets a patrol leg off, it was checked (row 14:
 * a pass may not be re-chosen for free uses), or it was the only choice.
 */
export function hub<T extends { kind: string }>(
  world: World,
  command: Parameters<typeof event>[1],
  mint: Mint,
  row: ChoiceRow,
  d: DialogueDefinition,
  option: DialogueChoice,
  decided: T,
): T {
  if (decided.kind !== 'accepted' || !reopens(d) || option.patrol || option.check) return decided;
  const a = decided as unknown as Accepted;
  const continuation_id = continuationId(mint);
  const { actor_id, source, beat, roles, choice_ids } = row;
  const op = {
    op: 'choice.open',
    writer_group: 0,
    continuation_id,
    actor_id,
    source,
    beat,
    roles,
    choice_ids,
  } as const;
  const at = a.events.find((e) => e.payload.type === 'choice_resolved')!.position + 1;
  const opened = event(world, command, mint, at, { type: 'choice_opened', continuation_id });
  return {
    ...a,
    delta: { ops: [...a.delta.ops, op] },
    events: [...a.events, opened],
  } as unknown as T;
}
