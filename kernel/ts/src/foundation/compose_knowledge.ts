import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same } from './compose.ts';

/** Portable row identity and monotonicity. Entry/visibility evidence belongs to the runtime. */
export function recordKnowledge(
  op: Extract<DeltaOp, { op: 'visit.record' | 'observation.record' }>,
  row: Json | undefined,
  horizon: number,
) {
  const value = op.value;
  let valid = row !== null && value.actor_id === op.actor_id;
  if (op.op === 'visit.record') valid &&= op.value.room_id === op.room_id && counted(op, row);
  else {
    const before = row as typeof op.from | undefined;
    valid &&=
      same(before, op.from) &&
      op.value.npc_id === op.npc_id &&
      op.value.at <= horizon &&
      (before == null || op.value.at >= before.at);
  }
  return valid ? { value: value as unknown as Json } : { code: 'precondition_failed' as const };
}

// A first visit has no `from` and no count; a later one (variety@1) names the current row in
// `from` and counts it plus one, so a replayed, stale or skipped count is refused.
function counted(op: Extract<DeltaOp, { op: 'visit.record' }>, row: Json | undefined) {
  if (row === undefined) return op.from === undefined && op.value.count === undefined;
  const before = row as typeof op.from;
  return same(before, op.from) && op.value.count === (before!.count ?? 1) + 1;
}
