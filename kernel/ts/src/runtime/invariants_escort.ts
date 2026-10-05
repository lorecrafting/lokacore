import { same } from '../foundation/compose.ts';

// Independent status/identity replay and final-row proof; never invokes composition.
export function escortsHold(state: any, ops: any[], result: any): boolean {
  const written = new Map<string, any>();
  for (const op of ops) {
    if (op.op !== 'escort.transition') continue;
    const before = written.has(op.actor_id)
      ? written.get(op.actor_id)
      : state.escorts?.[op.actor_id];
    const after = op.value;
    if (!same(before, op.expected) || after.actor_id !== op.actor_id) return false;
    const edge = `${before?.status ?? 'absent'}:${after.status}`;
    if (
      ![
        'absent:following',
        'following:separated',
        'separated:following',
        'following:completed',
      ].includes(edge)
    )
      return false;
    if (before != null && !same({ ...after, status: before.status }, before)) return false;
    written.set(op.actor_id, after);
  }
  return [...written].every(([actor, value]) =>
    result.changes.some(
      (r: any) => r.target.kind === 'escort' && r.target.actor_id === actor && same(r.value, value),
    ),
  );
}
