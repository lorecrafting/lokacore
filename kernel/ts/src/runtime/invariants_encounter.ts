// Independent encounter/job replay: prove both guards and final rows without composing.
import { same } from '../foundation/compose.ts';

type Any = any;
export function encountersHold(state: Any, ops: Any[], result: Any): boolean {
  const encounters = new Map<string, Any>(Object.entries(state.encounters ?? {}));
  const jobs = new Map<string, Any>(Object.entries(state.jobs ?? {}));
  const containers = new Map<string, Any>(Object.entries(state.containers ?? {}));
  const written = new Map<string, Any>();
  let horizon = state.clock;
  for (const op of ops) if (op.op === 'time.advance') horizon = op.to;
  for (const op of ops) {
    if (op.op === 'entity.transfer') containers.set(op.entity_id, op.destination_id);
    if (op.op.startsWith('encounter.')) {
      const row = encounter(op, encounters, containers, state.known_entities ?? {});
      if (!row) return false;
      encounters.set(op.encounter_id, row);
      written.set(op.encounter_id, {
        target: { kind: 'encounter', encounter_id: op.encounter_id },
        value: row,
      });
    }
    if (op.op.startsWith('job.')) {
      const row = job(op, jobs.get(op.job_id), horizon);
      if (!row) return false;
      jobs.set(op.job_id, row);
      written.set(`job:${op.job_id}`, { target: { kind: 'job', job_id: op.job_id }, value: row });
    }
  }
  return [...written.values()].every((expected) =>
    result.changes.some((row: Any) => same(row, expected)),
  );
}

function encounter(
  op: Any,
  encounters: Map<string, Any>,
  containers: Map<string, Any>,
  known: Any,
): Any {
  const row = encounters.get(op.encounter_id);
  if (op.op === 'encounter.open') {
    if (row !== undefined || !participants(op, containers, known)) return undefined;
    for (const active of encounters.values())
      if (
        active.status === 'open' &&
        [active.body_id, active.npc_id].some((id) => id === op.body_id || id === op.npc_id)
      )
        return undefined;
    return {
      character_id: op.character_id,
      body_id: op.body_id,
      npc_id: op.npc_id,
      room_id: op.room_id,
      status: 'open',
      round: 1,
      job_id: op.job_id,
    };
  }
  if (row?.status !== 'open' || row.job_id !== op.job_id) return undefined;
  if (op.op === 'encounter.close') return { ...row, status: 'closed' };
  if (row.round !== op.round || op.job_id === op.next_job_id || !Number.isSafeInteger(op.round + 1))
    return undefined;
  return { ...row, round: op.round + 1, job_id: op.next_job_id };
}

function participants(op: Any, containers: Map<string, Any>, known: Any): boolean {
  return (
    known[op.body_id]?.kind === 'body' &&
    known[op.body_id]?.owner_id === op.character_id &&
    known[op.npc_id]?.kind === 'npc' &&
    known[op.room_id]?.kind === 'room' &&
    op.body_id !== op.npc_id &&
    containers.get(op.body_id) === op.room_id &&
    containers.get(op.npc_id) === op.room_id
  );
}

function job(op: Any, row: Any, horizon: number): Any {
  if (op.op === 'job.schedule') {
    if (row !== undefined || op.due_time <= horizon) return undefined;
    if (
      (op.quest_instance_id === undefined) !== (op.actor_id === undefined) ||
      (op.quest_instance_id !== undefined &&
        (op.job.kind !== 'quest' || op.encounter_id !== undefined))
    )
      return undefined;
    const next: Any = { job: op.job, due_time: op.due_time, status: 'pending' };
    if (op.encounter_id !== undefined) next.encounter_id = op.encounter_id;
    if (op.quest_instance_id !== undefined) {
      next.quest_instance_id = op.quest_instance_id;
      next.actor_id = op.actor_id;
    }
    return next;
  }
  if (row?.status !== 'pending') return undefined;
  if (op.op === 'job.cancel')
    return row.encounter_id === op.encounter_id ? { ...row, status: 'cancelled' } : undefined;
  return row.due_time <= horizon ? { ...row, status: 'completed' } : undefined;
}
