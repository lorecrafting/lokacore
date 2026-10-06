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
    if (!legal(op.op, before, after)) return false;
    rows.set(at, after);
    changed.add(at);
  }
  return [...changed].every((at) =>
    result.changes.some((c: Any) => key(c.target) === at && same(c.value, rows.get(at))),
  );
}

function legal(kind: string, before: Any, after: Any): boolean {
  if (kind === 'population.control')
    return (
      before === null ||
      (after.next_wander_due >= before.next_wander_due && after.job_id !== before.job_id)
    );
  if (before === null)
    return (
      (after.generation === 0 &&
        after.member_id === null &&
        after.replacement_due === null &&
        after.last_flight_at == null) ||
      born(after)
    );
  if (before.generation === 0) return born(after);
  if (before.replacement_due === null)
    return (
      after.generation === before.generation &&
      after.member_id === before.member_id &&
      after.member_id !== null &&
      ((after.replacement_due !== null && after.last_flight_at === before.last_flight_at) ||
        (after.replacement_due === null &&
          Number.isSafeInteger(after.last_flight_at) &&
          after.last_flight_at !== before.last_flight_at))
    );
  return (
    after.generation === before.generation + 1 &&
    after.member_id !== null &&
    after.member_id !== before.member_id &&
    after.replacement_due === null &&
    after.last_flight_at == null
  );
}

function born(row: Any) {
  return (
    row.generation === 1 &&
    row.member_id !== null &&
    row.replacement_due === null &&
    row.last_flight_at == null
  );
}
