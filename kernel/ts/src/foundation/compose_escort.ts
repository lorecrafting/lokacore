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
  return same(previous, op.expected) &&
    op.value.actor_id === op.actor_id &&
    identity &&
    (EDGES[previous?.status ?? 'absent'] ?? []).includes(op.value.status)
    ? { value: op.value }
    : { code: 'precondition_failed' };
}
