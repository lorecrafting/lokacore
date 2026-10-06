import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same, type State } from './compose.ts';

/** One bound occupancy, or its invalidation; complete prior-row comparison. */
export function transitionWater(
  op: Extract<DeltaOp, { op: 'water.transition' }>,
  row: Json | undefined,
  state: State,
  room: Json | undefined,
) {
  const before = op.expected,
    after = op.value;
  const known = state.known_entities as Record<string, { kind: string; owner_id?: string }>;
  const active = after.room_id !== null;
  const valid =
    same(row, before) &&
    after.generation === (before?.generation ?? 0) + 1 &&
    (!before || before.body_id === after.body_id) &&
    known?.[after.body_id]?.kind === 'body' &&
    known[after.body_id].owner_id === op.actor_id &&
    (active
      ? (!before || before.room_id === null) &&
        after.entered_at === state.clock &&
        after.deadline !== null &&
        after.deadline > after.entered_at &&
        after.job_id !== null &&
        known[after.room_id!]?.kind === 'room' &&
        room === after.room_id
      : before?.room_id !== null &&
        before !== null &&
        after.entered_at === null &&
        after.deadline === null &&
        after.job_id === null);
  return valid ? { value: after as unknown as Json } : { code: 'precondition_failed' as const };
}
