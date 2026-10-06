// Job row admission and binding checks for the composer.
import type { DeltaOp, ErrorCode } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';

type Row = { [key: string]: Json };
type Outcome = { value: Json } | { code: ErrorCode };
const failed: Outcome = { code: 'precondition_failed' };

export function composeJob(
  op: DeltaOp & { op: `job.${string}` },
  value: Json | undefined,
  horizon: number,
): Outcome {
  const row = value as Row | undefined;
  if (op.op === 'job.schedule') {
    if (row !== undefined) return failed;
    if (op.due_time <= horizon) return { code: 'nonfuture_job' };
    if (!bindingValid(op)) return failed;
    return { value: pendingJob(op) };
  }
  if (row?.status !== 'pending') return failed;
  if (op.op === 'job.cancel')
    return (
      op.sight_member_id !== undefined
        ? op.encounter_id === undefined &&
          op.water_generation === undefined &&
          (row.sight as Row | undefined)?.member_id === op.sight_member_id
        : op.bleed_body_id !== undefined
          ? row.bleed_body_id === op.bleed_body_id &&
            row.bleed_generation === op.bleed_generation &&
            op.encounter_id === undefined
          : op.water_generation !== undefined
            ? row.water_generation === op.water_generation &&
              row.actor_id === op.actor_id &&
              op.encounter_id === undefined
            : op.encounter_id !== undefined && row.encounter_id === op.encounter_id
    )
      ? { value: { ...row, status: 'cancelled' } }
      : failed;
  return (row.due_time as number) <= horizon ? { value: { ...row, status: 'completed' } } : failed;
}

function bindingValid(op: Extract<DeltaOp, { op: 'job.schedule' }>) {
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
    (op.bleed_body_id === undefined) !== (op.bleed_generation === undefined) ||
    (op.job.kind === 'bleed') !== (op.bleed_body_id !== undefined) ||
    (op.bleed_body_id !== undefined &&
      (op.encounter_id !== undefined ||
        op.quest_instance_id !== undefined ||
        op.water_generation !== undefined ||
        op.sight !== undefined))
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

function pendingJob(op: Extract<DeltaOp, { op: 'job.schedule' }>): Json {
  return {
    job: op.job as Json,
    due_time: op.due_time,
    status: 'pending',
    ...(op.encounter_id === undefined ? {} : { encounter_id: op.encounter_id }),
    ...(op.water_generation === undefined
      ? {}
      : {
          actor_id: op.actor_id!,
          water_generation: op.water_generation,
          water_body_id: op.water_body_id!,
        }),
    ...(op.quest_instance_id === undefined
      ? {}
      : { quest_instance_id: op.quest_instance_id, actor_id: op.actor_id }),
    ...(op.sight === undefined ? {} : { sight: op.sight }),
    ...(op.bleed_body_id === undefined
      ? {}
      : { bleed_body_id: op.bleed_body_id, bleed_generation: op.bleed_generation }),
  };
}
