// Portable encounter lifecycle; containment and encounter rows include the proposal overlay.
import type { DeltaOp, ErrorCode } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import type { State } from './compose.ts';
import { encode } from './canonical.ts';
import { add } from './int.ts';
import { KernelError } from './error.ts';

type Row = { [key: string]: Json };
type EncounterOp = DeltaOp & { op: `encounter.${string}` };
type Outcome = { value: Json } | { code: ErrorCode };
const failed: Outcome = { code: 'precondition_failed' };

export function openEncounter(
  op: EncounterOp & { op: 'encounter.open' },
  row: Json | undefined,
  state: State,
  bodyRoom: Json | undefined,
  npcRoom: Json | undefined,
  encounters: [string, Json][],
): Outcome {
  const known = (state.known_entities ?? {}) as Record<string, Row>;
  const roster = op.active_ids;
  const pack = roster !== undefined;
  const origin = ((state.created ?? {}) as Record<string, Row>)[op.npc_id]?.origin as
    Row | undefined;
  const spec =
    origin?.kind === 'spawned'
      ? ((state.population_specs ?? {}) as Record<string, Row>)[encode(origin.by)]
      : undefined;
  const opted = !!(spec?.plan as Row | undefined)?.pack;
  const participants = pack ? roster : [op.npc_id];
  if (
    row !== undefined ||
    known[op.body_id]?.kind !== 'body' ||
    known[op.body_id]?.owner_id !== op.character_id ||
    known[op.npc_id]?.kind !== 'npc' ||
    known[op.room_id]?.kind !== 'room' ||
    op.body_id === op.npc_id ||
    bodyRoom !== op.room_id ||
    npcRoom !== op.room_id ||
    pack !== opted ||
    pack !== (op.next_opponent_id !== undefined) ||
    (pack && !packMembers(state, roster!, op.npc_id, op.next_opponent_id!, op.room_id)) ||
    encounters.some(
      ([, r]) =>
        (r as Row).status === 'open' &&
        [
          (r as Row).body_id,
          ...(((r as Row).active_ids as string[] | undefined) ?? [(r as Row).npc_id]),
        ].some((id) => id === op.body_id || participants.includes(id as typeof op.npc_id)),
    )
  )
    return failed;
  return {
    value: {
      character_id: op.character_id,
      body_id: op.body_id,
      npc_id: op.npc_id,
      room_id: op.room_id,
      job_id: op.job_id,
      status: 'open',
      round: 1,
      ...(pack && { active_ids: [...roster!], next_opponent_id: op.next_opponent_id }),
    },
  };
}

function packMembers(
  state: State,
  ids: readonly string[],
  primary: string,
  next: string,
  room: string,
) {
  if (
    !ids.length ||
    ids.length > 64 ||
    !ids.includes(primary) ||
    next !== primary ||
    ids.some((id, i) => i > 0 && ids[i - 1] >= id)
  )
    return false;
  const known = (state.known_entities ?? {}) as Record<string, Row>;
  const created = (state.created ?? {}) as Record<string, Row>;
  const containers = (state.containers ?? {}) as Record<string, string>;
  const slots = (state.population_slots ?? {}) as Record<string, Row>;
  const origin = created[primary]?.origin as Row | undefined;
  if (origin?.kind !== 'spawned' || origin.role !== 'hound') return false;
  const spec = ((state.population_specs ?? {}) as Record<string, Row>)[encode(origin.by)];
  if (
    !(spec?.plan as Row | undefined)?.pack ||
    !Number.isSafeInteger(spec?.cap) ||
    ids.length > (spec.cap as number)
  )
    return false;
  return ids.every((id) => {
    const member = created[id]?.origin as Row | undefined;
    const slot =
      member && slots[encode({ kind: 'population_slot', plan: member.by, slot: member.slot })];
    return (
      known[id]?.kind === 'npc' &&
      containers[id] === room &&
      member?.kind === 'spawned' &&
      member.role === 'hound' &&
      member.member_id === id &&
      encode(member.by) === encode(origin.by) &&
      slot?.member_id === id &&
      slot.generation === member.generation &&
      slot.replacement_due === null
    );
  });
}

export function changeEncounter(
  op: Exclude<EncounterOp, { op: 'encounter.open' }>,
  value: Json | undefined,
  present: (id: string, room: string) => boolean,
  initiallyPresent: (id: string, room: string) => boolean,
): Outcome {
  const row = value as Row | undefined;
  if (row?.status !== 'open' || row.job_id !== op.job_id) return failed;
  const pack = row.active_ids !== undefined;
  if (
    pack &&
    (op.expected === undefined || encode(row as Json) !== encode(op.expected as unknown as Json))
  )
    return failed;
  if (op.op === 'encounter.close')
    return {
      value: { ...row, status: 'closed', ...(pack && { active_ids: [], next_opponent_id: null }) },
    };
  if (row.round !== op.round || op.next_job_id === op.job_id) return failed;
  if (pack) {
    const old = row.active_ids as unknown as NonNullable<typeof op.active_ids>;
    const next = op.active_ids;
    if (
      !next?.length ||
      !next.includes(op.npc_id!) ||
      !next.includes(op.next_opponent_id!) ||
      next.some((id, i) => !old.includes(id) || (i > 0 && next[i - 1] >= id)) ||
      old.some((id) => next.includes(id) !== present(id, row.room_id as string))
    )
      return failed;
    const starting = old.filter((id) => initiallyPresent(id, row.room_id as string));
    const cursor = row.next_opponent_id as (typeof old)[number];
    const selected = starting.includes(cursor)
      ? cursor
      : (starting.find((id) => id > cursor) ?? starting[0]);
    if (
      !selected ||
      op.npc_id !== (next.includes(row.npc_id as never) ? row.npc_id : next[0]) ||
      op.next_opponent_id !== (next.find((id) => id > selected) ?? next[0])
    )
      return failed;
  }
  try {
    return {
      value: {
        ...row,
        round: add(op.round, 1),
        job_id: op.next_job_id,
        ...(pack && {
          active_ids: [...op.active_ids!],
          npc_id: op.npc_id,
          next_opponent_id: op.next_opponent_id,
        }),
      },
    };
  } catch (error) {
    if (error instanceof KernelError && error.code === 'integer_overflow') return failed;
    throw error;
  }
}

export function composeJob(
  op: DeltaOp & { op: `job.${string}` },
  value: Json | undefined,
  horizon: number,
): Outcome {
  const row = value as Row | undefined;
  if (op.op === 'job.schedule') {
    if (row !== undefined) return failed;
    if (op.due_time <= horizon) return { code: 'nonfuture_job' };
    if (
      (op.quest_instance_id === undefined) !== (op.actor_id === undefined) ||
      (op.quest_instance_id !== undefined &&
        (op.job.kind !== 'quest' || op.encounter_id !== undefined))
    )
      return failed;
    return {
      value: {
        job: op.job as Json,
        due_time: op.due_time,
        status: 'pending',
        ...(op.encounter_id === undefined ? {} : { encounter_id: op.encounter_id }),
        ...(op.quest_instance_id === undefined
          ? {}
          : { quest_instance_id: op.quest_instance_id, actor_id: op.actor_id }),
      },
    };
  }
  if (row?.status !== 'pending') return failed;
  if (op.op === 'job.cancel')
    return row.encounter_id === op.encounter_id
      ? { value: { ...row, status: 'cancelled' } }
      : failed;
  return (row.due_time as number) <= horizon ? { value: { ...row, status: 'completed' } } : failed;
}
