import type { DeltaOp } from '../contracts.gen.ts';
import { key, same, target } from '../foundation/compose.ts';
import { validate } from '../foundation/validate.ts';
type Any = any;

export function knowledgeHolds(state: Any, ops: readonly DeltaOp[], result: Any): boolean {
  const expected = new Map<string, unknown>();
  const horizon = ops.reduce((at, op) => (op.op === 'time.advance' ? op.to : at), state.clock);
  for (const op of ops) {
    if (op.op !== 'visit.record' && op.op !== 'observation.record') continue;
    const at = key(target(op));
    const section = op.op === 'visit.record' ? 'visited_rooms' : 'observed_npcs';
    const before: Any = expected.has(at) ? expected.get(at) : state[section]?.[at];
    if (before === null || op.value.actor_id !== op.actor_id) return false;
    if (op.op === 'visit.record') {
      if (
        before !== undefined ||
        op.value.room_id !== op.room_id ||
        validate('VisitedRoom', op.value).length
      )
        return false;
    } else if (
      validate('ObservedNpc', op.value).length ||
      !same(before, op.from) ||
      op.value.npc_id !== op.npc_id ||
      op.value.at > horizon ||
      (before != null && before.at > op.value.at)
    )
      return false;
    expected.set(at, op.value);
  }
  return [...expected].every(([at, value]) =>
    result.changes.some((r: Any) => key(r.target) === at && same(r.value, value)),
  );
}
