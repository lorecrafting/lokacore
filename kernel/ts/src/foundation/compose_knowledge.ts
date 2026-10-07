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
  if (op.op === 'visit.record') valid &&= row === undefined && op.value.room_id === op.room_id;
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
