import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same } from './compose.ts';

/** Portable lifecycle only; the patrol owner proves route, admission and causal credit. */
// size: allow 60, full-prior row and closed attempt lifecycle share one portable precondition
export function transitionPatrol(
  op: Extract<DeltaOp, { op: 'patrol.transition' }>,
  row: Json | undefined,
) {
  const before = row as typeof op.expected | undefined;
  const after = op.value;
  let legal = false;
  if (before == null) legal = after.status === 'together' && after.credit.length === 0;
  else {
    const identity = [
      'kind',
      'actor_id',
      'body_id',
      'npc_id',
      'quest_instance_id',
      'continuation_id',
      'choice_id',
    ] as const;
    if (!identity.every((k) => same(before[k], after[k])))
      return { code: 'precondition_failed' as const };
    const fixed = before.attempt_id === after.attempt_id;
    const credit = same(before.credit, after.credit);
    const cursor = before.cursor === after.cursor;
    switch (`${before.status}:${after.status}`) {
      case 'together:awaiting':
        legal = fixed && credit && !cursor;
        break;
      case 'together:paused':
      case 'awaiting:paused':
      case 'paused:together':
        legal = fixed && credit && cursor;
        break;
      case 'together:failed':
      case 'awaiting:failed':
      case 'paused:failed':
        legal = fixed && cursor && after.credit.length === 0;
        break;
      case 'failed:together':
        legal = !fixed && cursor && after.credit.length === 0;
        break;
      case 'awaiting:together':
      case 'awaiting:completed':
        legal =
          fixed &&
          cursor &&
          (credit ||
            (after.credit.length === before.credit.length + 1 &&
              same(after.credit.slice(0, -1), before.credit)));
        break;
    }
  }
  return same(before, op.expected) &&
    after.quest_instance_id === op.quest_instance_id &&
    new Set(after.credit).size === after.credit.length &&
    legal
    ? { value: after as unknown as Json }
    : { code: 'precondition_failed' as const };
}
