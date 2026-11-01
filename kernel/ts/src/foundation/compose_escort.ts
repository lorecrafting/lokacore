import type { DeltaOp, ErrorCode } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same } from './compose.ts';

const EDGES: Record<string, string[]> = {
  absent: ['following'],
  following: ['separated', 'completed'],
  separated: ['following'],
};

export function transitionEscort(
  op: Extract<DeltaOp, { op: 'escort.transition' }>,
  row: Json | undefined,
): { value: Json } | { code: ErrorCode } {
  const previous = row as typeof op.expected | undefined;
  const identity = previous == null || same({ ...previous, status: op.value.status }, op.value);
  // The one identity change: a new quest instance's start replaces an ended row (escort@1).
  const restart =
    previous != null &&
    previous.status !== 'following' &&
    op.value.status === 'following' &&
    previous.quest_instance_id !== op.value.quest_instance_id;
  return same(previous, op.expected) &&
    op.value.actor_id === op.actor_id &&
    (restart || (identity && (EDGES[previous?.status ?? 'absent'] ?? []).includes(op.value.status)))
    ? { value: op.value }
    : { code: 'precondition_failed' };
}
