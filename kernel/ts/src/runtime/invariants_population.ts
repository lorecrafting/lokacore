import { key, same } from '../foundation/compose.ts';

type Any = any;

/** Independent full-prior replay for the two separately targeted population rows. */
export function populationsHold(state: Any, ops: Any[], result: Any): boolean {
  const rows = new Map<string, Any>();
  const changed = new Set<string>();
  for (const op of ops) {
    if (op.op !== 'population.control' && op.op !== 'population.slot') continue;
    const target =
      op.op === 'population.control'
        ? { kind: 'population_plan', plan: op.plan }
        : { kind: 'population_slot', plan: op.plan, slot: op.slot };
    const at = key(target);
    const before = rows.has(at)
      ? rows.get(at)
      : op.op === 'population.control'
        ? (state.population_plans?.[key(op.plan)] ?? null)
        : (state.population_slots?.[at] ?? null);
    if (!same(before, op.expected)) return false;
    const after = op.value;
    if (op.op === 'population.control') {
      if (
        before !== null &&
        !(after.next_wander_due >= before.next_wander_due && after.job_id !== before.job_id)
      )
        return false;
    } else if (before === null) {
      if (!(
        (after.generation === 0 && after.member_id === null && after.replacement_due === null) ||
        (after.generation === 1 && after.member_id !== null && after.replacement_due === null)
      ))
        return false;
    } else if (before.generation === 0) {
      if (!(after.generation === 1 && after.member_id !== null && after.replacement_due === null))
        return false;
    } else if (before.replacement_due === null) {
      if (!(
        after.generation === before.generation &&
        after.member_id === before.member_id &&
        after.member_id !== null &&
        after.replacement_due !== null
      ))
        return false;
    } else if (!(
      after.generation === before.generation + 1 &&
      after.member_id !== null &&
      after.member_id !== before.member_id &&
      after.replacement_due === null
    ))
      return false;
    rows.set(at, after);
    changed.add(at);
  }
  return [...changed].every((at) =>
    result.changes.some((c: Any) => key(c.target) === at && same(c.value, rows.get(at))),
  );
}
