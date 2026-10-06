import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same } from './compose.ts';

/** A single quest-owned attempt. Route evidence is checked by the movement owner. */
export function transitionExpedition(
  op: Extract<DeltaOp, { op: 'expedition.transition' }>,
  row: Json | undefined,
) {
  const before = row as typeof op.expected | undefined;
  const after = op.value;
  if (!same(before, op.expected) || after.quest_instance_id !== op.quest_instance_id)
    return { code: 'precondition_failed' as const };
  if (before == null)
    return after.status === 'active' && after.cursor === 0 && !after.sheltered
      ? { value: after as unknown as Json }
      : { code: 'precondition_failed' as const };
  if (
    !(['kind', 'actor_id', 'body_id', 'quest_instance_id'] as const).every((k) =>
      same(before[k], after[k]),
    )
  )
    return { code: 'precondition_failed' as const };
  const restart =
    before.status === 'failed' &&
    after.status === 'active' &&
    before.attempt_id !== after.attempt_id &&
    after.cursor === 0 &&
    !after.sheltered;
  const fail =
    before.status === 'active' &&
    after.status === 'failed' &&
    before.attempt_id === after.attempt_id &&
    after.cursor === 0 &&
    !after.sheltered;
  const progress =
    before.status === 'active' &&
    after.status === 'active' &&
    before.attempt_id === after.attempt_id &&
    after.cursor === before.cursor + 1 &&
    before.sheltered === after.sheltered;
  const complete =
    before.status === 'active' &&
    after.status === 'completed' &&
    before.attempt_id === after.attempt_id &&
    after.cursor === before.cursor + 1 &&
    before.sheltered === after.sheltered;
  const shelter =
    before.status === 'active' &&
    after.status === 'active' &&
    before.attempt_id === after.attempt_id &&
    before.cursor === after.cursor &&
    !before.sheltered &&
    after.sheltered;
  return restart || fail || progress || complete || shelter
    ? { value: after as unknown as Json }
    : { code: 'precondition_failed' as const };
}
