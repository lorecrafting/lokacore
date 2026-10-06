import { same } from '../foundation/compose.ts';

/** Independent ordered replay and final-row proof, without calling composition. */
export function patrolsHold(state: any, ops: any[], result: any): boolean {
  const rows = new Map<string, any>();
  for (const op of ops) {
    if (op.op !== 'patrol.transition') continue;
    const before = rows.has(op.quest_instance_id)
      ? rows.get(op.quest_instance_id)
      : state.patrols?.[op.quest_instance_id];
    const after = op.value;
    if (
      !same(before, op.expected) ||
      after.quest_instance_id !== op.quest_instance_id ||
      new Set(after.credit).size !== after.credit.length
    )
      return false;
    if (!valid(before, after)) return false;
    rows.set(op.quest_instance_id, after);
  }
  return [...rows].every(([quest_instance_id, value]) =>
    result.changes.some(
      (r: any) => same(r.target, { kind: 'patrol', quest_instance_id }) && same(r.value, value),
    ),
  );
}

// size: allow 50, independent lifecycle proof covers every retained attempt transition
function valid(before: any, after: any): boolean {
  if (!before) {
    if (after.status !== 'together' || after.credit.length) return false;
  } else {
    if (
      ![
        'kind',
        'actor_id',
        'body_id',
        'npc_id',
        'quest_instance_id',
        'continuation_id',
        'choice_id',
      ].every((k) => same(before[k], after[k]))
    )
      return false;
    const edge = `${before.status}:${after.status}`;
    const fatal = ['together:failed', 'awaiting:failed', 'paused:failed'].includes(edge);
    const restart = edge === 'failed:together';
    const join = ['awaiting:together', 'awaiting:completed'].includes(edge);
    const depart = edge === 'together:awaiting';
    if (!(
      fatal ||
      restart ||
      join ||
      depart ||
      ['together:paused', 'awaiting:paused', 'paused:together'].includes(edge)
    ))
      return false;
    if (restart ? before.attempt_id === after.attempt_id : before.attempt_id !== after.attempt_id)
      return false;
    if (depart ? before.cursor === after.cursor : before.cursor !== after.cursor) return false;
    if (fatal || restart) {
      if (after.credit.length) return false;
    } else if (join) {
      if (!(
        same(before.credit, after.credit) ||
        (after.credit.length === before.credit.length + 1 &&
          same(after.credit.slice(0, -1), before.credit))
      ))
        return false;
    } else if (!same(before.credit, after.credit)) return false;
  }
  return true;
}
