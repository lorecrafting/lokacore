// Portable encounter lifecycle; containment and encounter rows include the proposal overlay.
import type { DeltaOp, ErrorCode } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import type { State } from './compose.ts';
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
  if (
    row !== undefined ||
    known[op.body_id]?.kind !== 'body' ||
    known[op.body_id]?.owner_id !== op.character_id ||
    known[op.npc_id]?.kind !== 'npc' ||
    known[op.room_id]?.kind !== 'room' ||
    op.body_id === op.npc_id ||
    bodyRoom !== op.room_id ||
    npcRoom !== op.room_id ||
    encounters.some(
      ([, r]) =>
        (r as Row).status === 'open' &&
        [(r as Row).body_id, (r as Row).npc_id].some((id) => id === op.body_id || id === op.npc_id),
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
    },
  };
}

export function changeEncounter(
  op: Exclude<EncounterOp, { op: 'encounter.open' }>,
  value: Json | undefined,
): Outcome {
  const row = value as Row | undefined;
  if (row?.status !== 'open' || row.job_id !== op.job_id) return failed;
  if (op.op === 'encounter.close') return { value: { ...row, status: 'closed' } };
  if (row.round !== op.round || op.next_job_id === op.job_id) return failed;
  try {
    return { value: { ...row, round: add(op.round, 1), job_id: op.next_job_id } };
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
    return {
      value: {
        job: op.job as Json,
        due_time: op.due_time,
        status: 'pending',
        ...(op.encounter_id === undefined ? {} : { encounter_id: op.encounter_id }),
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
