// Independent encounter/job replay: prove both guards and final rows without composing.
import { key, same } from '../foundation/compose.ts';
import { advancePack, packMembers } from './invariants_pack.ts';

type Any = any;
export function encountersHold(state: Any, ops: Any[], result: Any): boolean {
  const encounters = new Map<string, Any>(Object.entries(state.encounters ?? {}));
  const jobs = new Map<string, Any>(Object.entries(state.jobs ?? {}));
  const containers = new Map<string, Any>(Object.entries(state.containers ?? {}));
  const slots = new Map<string, Any>(Object.entries(state.population_slots ?? {}));
  const written = new Map<string, Any>();
  const preceding: Any[] = [];
  let horizon = state.clock;
  for (const op of ops) if (op.op === 'time.advance') horizon = op.to;
  for (const op of ops) {
    if (op.op === 'entity.transfer') containers.set(op.entity_id, op.destination_id);
    if (op.op === 'population.slot')
      slots.set(key({ kind: 'population_slot', plan: op.plan, slot: op.slot }), op.value);
    if (op.op.startsWith('encounter.')) {
      const row = encounter(op, encounters, containers, slots, state, preceding, horizon);
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
    preceding.push(op);
  }
  return [...written.values()].every((expected) =>
    result.changes.some((row: Any) => same(row, expected)),
  );
}

function encounter(
  op: Any,
  encounters: Map<string, Any>,
  containers: Map<string, Any>,
  slots: Map<string, Any>,
  state: Any,
  preceding: Any[],
  horizon: number,
): Any {
  const row = encounters.get(op.encounter_id);
  return op.op === 'encounter.open'
    ? openEncounter(op, row, encounters, containers, state)
    : changeEncounter(op, row, containers, slots, state, preceding);
}

function openEncounter(
  op: Any,
  row: Any,
  encounters: Map<string, Any>,
  containers: Map<string, Any>,
  state: Any,
) {
  const origin = state.created?.[op.npc_id]?.origin;
  const opted =
    origin?.kind === 'spawned' && !!state.population_specs?.[key(origin.by)]?.plan?.pack;
  if (
    row !== undefined ||
    !participants(op, containers, state.known_entities ?? {}) ||
    opted !== (op.active_ids !== undefined) ||
    (op.active_ids === undefined) !== (op.next_opponent_id === undefined) ||
    (op.active_ids !== undefined && !packMembers(op, state, containers))
  )
    return undefined;
  for (const active of encounters.values())
    if (
      active.status === 'open' &&
      [active.body_id, ...(active.active_ids ?? [active.npc_id])].some(
        (id) => id === op.body_id || (op.active_ids ?? [op.npc_id]).includes(id),
      )
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
    ...(op.active_ids !== undefined && {
      active_ids: op.active_ids,
      next_opponent_id: op.next_opponent_id,
    }),
  };
}

function changeEncounter(
  op: Any,
  row: Any,
  containers: Map<string, Any>,
  slots: Map<string, Any>,
  state: Any,
  preceding: Any[],
) {
  if (row?.status !== 'open' || row.job_id !== op.job_id) return undefined;
  if (row.active_ids !== undefined && !same(row, op.expected)) return undefined;
  if (op.op === 'encounter.close')
    return {
      ...row,
      status: 'closed',
      ...(row.active_ids !== undefined && { active_ids: [], next_opponent_id: null }),
    };
  if (
    row.round !== op.round ||
    op.job_id === op.next_job_id ||
    !Number.isSafeInteger(op.round + 1) ||
    (row.active_ids !== undefined && !advancePack(op, row, containers, slots, state, preceding))
  )
    return undefined;
  return {
    ...row,
    round: op.round + 1,
    job_id: op.next_job_id,
    ...(row.active_ids !== undefined && {
      active_ids: op.active_ids,
      npc_id: op.npc_id,
      next_opponent_id: op.next_opponent_id,
    }),
  };
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
    if (!bindingValid(op)) return undefined;
    const next: Any = { job: op.job, due_time: op.due_time, status: 'pending' };
    if (op.encounter_id !== undefined) next.encounter_id = op.encounter_id;
    if (op.quest_instance_id !== undefined) {
      next.quest_instance_id = op.quest_instance_id;
      next.actor_id = op.actor_id;
    }
    if (op.water_generation !== undefined) {
      next.actor_id = op.actor_id;
      next.water_generation = op.water_generation;
      next.water_body_id = op.water_body_id;
    }
    if (op.crow_member_id !== undefined) {
      next.crow_member_id = op.crow_member_id;
      next.crow_generation = op.crow_generation;
      next.crow_phase = op.crow_phase;
    }
    if (op.sight !== undefined) next.sight = op.sight;
    if (op.bleed_body_id !== undefined) {
      next.bleed_body_id = op.bleed_body_id;
      next.bleed_generation = op.bleed_generation;
    }

    return next;
  }
  if (row?.status !== 'pending') return undefined;
  if (op.op === 'job.cancel')
    return cancelValid(op, row) ? { ...row, status: 'cancelled' } : undefined;
  return row.due_time <= horizon ? { ...row, status: 'completed' } : undefined;
}

function bindingValid(op: Any) {
  if (
    op.bleed_body_id !== undefined ||
    op.bleed_generation !== undefined ||
    op.job.kind === 'bleed'
  )
    return bleedBindingValid(op);
  if (
    op.crow_member_id !== undefined ||
    op.crow_generation !== undefined ||
    op.crow_phase !== undefined ||
    op.job.kind === 'population_bundle'
  )
    return crowBindingValid(op);
  if (
    (op.quest_instance_id === undefined && op.water_generation === undefined) !==
      (op.actor_id === undefined) ||
    (op.quest_instance_id !== undefined &&
      (op.job.kind !== 'quest' || op.encounter_id !== undefined))
  )
    return false;
  if (
    op.sight !== undefined &&
    (op.job.kind !== 'population' ||
      op.encounter_id !== undefined ||
      op.quest_instance_id !== undefined ||
      op.water_generation !== undefined ||
      op.actor_id !== undefined)
  )
    return false;
  if (
    (op.water_generation === undefined) !== (op.water_body_id === undefined) ||
    (op.water_generation !== undefined &&
      (op.job.kind !== 'room' ||
        op.quest_instance_id !== undefined ||
        op.encounter_id !== undefined))
  )
    return false;
  return true;
}

function bleedBindingValid(op: Any) {
  return (
    op.bleed_body_id !== undefined &&
    op.bleed_generation !== undefined &&
    op.job.kind === 'bleed' &&
    [
      op.encounter_id,
      op.quest_instance_id,
      op.actor_id,
      op.water_generation,
      op.water_body_id,
      op.sight,
      op.crow_member_id,
      op.crow_generation,
      op.crow_phase,
    ].every((v) => v === undefined)
  );
}

function crowBindingValid(op: Any) {
  return (
    op.crow_member_id !== undefined &&
    op.crow_generation !== undefined &&
    ['acquire', 'leg', 'return'].includes(op.crow_phase) &&
    op.job.kind === 'population_bundle' &&
    [
      op.encounter_id,
      op.quest_instance_id,
      op.actor_id,
      op.water_generation,
      op.water_body_id,
    ].every((v) => v === undefined)
  );
}

function cancelValid(op: Any, row: Any) {
  if (op.bleed_body_id !== undefined || op.bleed_generation !== undefined)
    return (
      op.bleed_body_id !== undefined &&
      op.bleed_generation !== undefined &&
      row.bleed_body_id === op.bleed_body_id &&
      row.bleed_generation === op.bleed_generation &&
      [op.encounter_id, op.sight_member_id, op.water_generation, op.crow_member_id].every(
        (v) => v === undefined,
      )
    );
  return op.crow_member_id !== undefined
    ? row.crow_member_id === op.crow_member_id &&
        row.crow_generation === op.crow_generation &&
        op.encounter_id === undefined &&
        op.sight_member_id === undefined
    : op.sight_member_id !== undefined
      ? op.encounter_id === undefined &&
        op.water_generation === undefined &&
        row.sight?.member_id === op.sight_member_id
      : op.water_generation !== undefined
        ? row.water_generation === op.water_generation &&
          row.actor_id === op.actor_id &&
          op.encounter_id === undefined
        : op.encounter_id !== undefined && row.encounter_id === op.encounter_id;
}
