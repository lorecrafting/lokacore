// Independent encounter/job replay: prove both guards and final rows without composing.
import { key, same } from '../foundation/compose.ts';

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
  const known = state.known_entities ?? {};
  const row = encounters.get(op.encounter_id);
  if (op.op === 'encounter.open') {
    const origin = state.created?.[op.npc_id]?.origin;
    const opted =
      origin?.kind === 'spawned' && !!state.population_specs?.[key(origin.by)]?.plan?.pack;
    if (
      row !== undefined ||
      !participants(op, containers, known) ||
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
  if (row?.status !== 'open' || row.job_id !== op.job_id) return undefined;
  if (row.active_ids !== undefined && !same(row, op.expected)) return undefined;
  if (op.op === 'encounter.close')
    return {
      ...row,
      status: 'closed',
      ...(row.active_ids !== undefined && { active_ids: [], next_opponent_id: null }),
    };
  if (row.round !== op.round || op.job_id === op.next_job_id || !Number.isSafeInteger(op.round + 1))
    return undefined;
  if (
    row.active_ids !== undefined &&
    (!Array.isArray(op.active_ids) ||
      !op.active_ids.length ||
      op.active_ids.some(
        (id: string, i: number) =>
          !row.active_ids.includes(id) || (i > 0 && op.active_ids[i - 1] >= id),
      ) ||
      !op.active_ids.includes(op.npc_id) ||
      !op.active_ids.includes(op.next_opponent_id) ||
      row.active_ids.some(
        (id: string) =>
          op.active_ids.includes(id) !==
          memberRemains(
            id,
            row.room_id,
            op.writer_group,
            state,
            containers,
            slots,
            preceding,
            state.jobs?.[op.job_id]?.due_time,
          ),
      ) ||
      !rotationHolds(op, row, state))
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

function rotationHolds(op: Any, row: Any, state: Any) {
  const starting = row.active_ids.filter((id: string) =>
    memberInitiallyPresent(id, row.room_id, state),
  );
  const selected = starting.includes(row.next_opponent_id)
    ? row.next_opponent_id
    : (starting.find((id: string) => id > row.next_opponent_id) ?? starting[0]);
  return (
    !!selected &&
    op.npc_id === (op.active_ids.includes(row.npc_id) ? row.npc_id : op.active_ids[0]) &&
    op.next_opponent_id === (op.active_ids.find((id: string) => id > selected) ?? op.active_ids[0])
  );
}

function memberInitiallyPresent(id: string, room: string, state: Any) {
  const origin = state.created?.[id]?.origin;
  const slot =
    origin?.kind === 'spawned' &&
    state.population_slots?.[
      key({
        kind: 'population_slot',
        plan: origin.by,
        slot: origin.slot,
      })
    ];
  return (
    state.containers?.[id] === room &&
    slot?.member_id === id &&
    slot.generation === origin.generation &&
    slot.replacement_due === null
  );
}

function memberRemains(
  id: string,
  room: string,
  group: number,
  state: Any,
  containers: Map<string, Any>,
  slots: Map<string, Any>,
  preceding: Any[],
  due: number | undefined,
) {
  const origin = state.created?.[id]?.origin;
  if (origin?.kind !== 'spawned' || !memberInitiallyPresent(id, room, state)) return false;
  const slotKey = key({ kind: 'population_slot', plan: origin.by, slot: origin.slot });
  const before = state.population_slots?.[slotKey];
  const slot = slots.get(slotKey);
  if (
    containers.get(id) === room &&
    slot?.member_id === id &&
    slot.generation === origin.generation &&
    slot.replacement_due === null
  )
    return true;
  const reverse = [...preceding].reverse();
  const slotOp = reverse.find(
    (x: Any) =>
      x.op === 'population.slot' &&
      key({ kind: 'population_slot', plan: x.plan, slot: x.slot }) === slotKey,
  );
  const move = reverse.find((x: Any) => x.op === 'entity.transfer' && x.entity_id === id);
  const hp = reverse.find(
    (x: Any) =>
      x.op === 'resource.adjust' &&
      x.entity_id === id &&
      same(x.resource, { ...origin.by, kind: 'resource', key: 'hp' }),
  );
  const flew =
    move?.writer_group === group &&
    move.destination_id !== move.source_id &&
    containers.get(id) !== room &&
    slotOp?.writer_group === group &&
    Number.isSafeInteger(due) &&
    slot?.last_flight_at === due &&
    before?.last_flight_at !== due &&
    slot?.replacement_due === null;
  const died =
    slotOp?.writer_group === group &&
    hp?.writer_group === group &&
    slot?.replacement_due !== null &&
    hp?.to === 0;
  return !(flew || died);
}

function packMembers(op: Any, state: Any, containers: Map<string, Any>) {
  const ids = op.active_ids;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 64 ||
    !ids.includes(op.npc_id) ||
    op.next_opponent_id !== op.npc_id ||
    ids.some((id: string, i: number) => i > 0 && ids[i - 1] >= id)
  )
    return false;
  const origin = state.created?.[op.npc_id]?.origin;
  if (origin?.kind !== 'spawned' || origin.role !== 'hound') return false;
  const spec = state.population_specs?.[key(origin.by)];
  if (!spec?.plan?.pack || !Number.isSafeInteger(spec.cap) || ids.length > spec.cap) return false;
  return ids.every((id: string) => {
    const member = state.created?.[id]?.origin;
    const slot =
      member &&
      state.population_slots?.[
        key({ kind: 'population_slot', plan: member.by, slot: member.slot })
      ];
    return (
      state.known_entities?.[id]?.kind === 'npc' &&
      containers.get(id) === op.room_id &&
      member?.kind === 'spawned' &&
      member.role === 'hound' &&
      member.member_id === id &&
      same(member.by, origin.by) &&
      slot?.member_id === id &&
      slot.generation === member.generation &&
      slot.replacement_due === null
    );
  });
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
