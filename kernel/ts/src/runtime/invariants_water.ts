import { same } from '../foundation/compose.ts';

/** Independent occupancy replay and final-row proof; never calls the composer. */
export function watersHold(state: any, ops: any[], result: any) {
  const rows = new Map<string, any>(Object.entries(state.water ?? {}));
  const containers = new Map<string, any>(Object.entries(state.containers ?? {}));
  const written = new Set<string>();
  for (const op of ops) {
    if (op.op === 'entity.transfer') containers.set(op.entity_id, op.destination_id);
    if (op.op !== 'water.transition') continue;
    const prior = rows.get(op.actor_id),
      next = op.value,
      known = state.known_entities ?? {};
    if (
      !same(prior, op.expected) ||
      next.generation !== (prior?.generation ?? 0) + 1 ||
      known[next.body_id]?.owner_id !== op.actor_id ||
      known[next.body_id]?.kind !== 'body' ||
      (prior && prior.body_id !== next.body_id)
    )
      return false;
    if (next.room_id === null) {
      if (!prior?.room_id || ['entered_at', 'deadline', 'job_id'].some((k) => next[k] !== null))
        return false;
    } else if (
      prior?.room_id ||
      known[next.room_id]?.kind !== 'room' ||
      containers.get(next.body_id) !== next.room_id ||
      next.entered_at !== state.clock ||
      !(next.deadline > next.entered_at) ||
      !next.job_id
    )
      return false;
    rows.set(op.actor_id, next);
    written.add(op.actor_id);
  }
  return [...written].every((actor_id) =>
    result.changes.some(
      (r: any) => same(r.target, { kind: 'water', actor_id }) && same(r.value, rows.get(actor_id)),
    ),
  );
}
