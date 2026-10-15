// Job row admission and binding checks for the composer.
import type { DeltaOp, ErrorCode, MutationTarget } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';

type Row = { [key: string]: Json };
type Outcome = { value: Json } | { code: ErrorCode };
const failed: Outcome = { code: 'precondition_failed' };

// Only job.schedule writes a pending row: one due by the target must have run in this advance.
export const unrunJob = (w: { target: MutationTarget; value: Json }, horizon: number) =>
  w.target.kind === 'job' &&
  (w.value as Row).status === 'pending' &&
  ((w.value as Row).due_time as number) <= horizon;

// ctx.at: the due time of the last job.complete, else the target (a partial compose: the clock).
export function composeJob(
  op: DeltaOp & { op: `job.${string}` },
  value: Json | undefined,
  ctx: { horizon: number; at: number },
): Outcome {
  const row = value as Row | undefined;
  if (op.op === 'job.schedule') {
    if (row !== undefined) return failed;
    if (op.due_time <= ctx.at) return { code: 'nonfuture_job' };
    if (!bindingValid(op)) return failed;
    return { value: pendingJob(op) };
  }
  if (row?.status !== 'pending') return failed;
  if (op.op === 'job.cancel')
    return (
      op.crow_member_id !== undefined
        ? row.crow_member_id === op.crow_member_id &&
          row.crow_generation === op.crow_generation &&
          op.encounter_id === undefined &&
          op.water_generation === undefined
        : op.sight_member_id !== undefined
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
  if ((row.due_time as number) > ctx.horizon) return failed;
  ctx.at = row.due_time as number;
  return { value: { ...row, status: 'completed' } };
}

function bindingValid(op: Extract<DeltaOp, { op: 'job.schedule' }>) {
  if (
    op.crow_member_id !== undefined ||
    op.crow_generation !== undefined ||
    op.crow_phase !== undefined ||
    op.job.kind === 'population_bundle'
  )
    return crowBindingValid(op);
  if (
    (op.quest_instance_id === undefined &&
      op.water_generation === undefined &&
      op.job.kind !== 'reaction') !==
      (op.actor_id === undefined) ||
    (op.quest_instance_id !== undefined &&
      (op.job.kind !== 'quest' || op.encounter_id !== undefined)) ||
    (op.job.kind === 'reaction' && op.encounter_id !== undefined)
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
  return waterBindingValid(op);
}

function waterBindingValid(op: Extract<DeltaOp, { op: 'job.schedule' }>) {
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
    ...(op.crow_member_id === undefined
      ? {}
      : {
          crow_member_id: op.crow_member_id,
          crow_generation: op.crow_generation!,
          crow_phase: op.crow_phase!,
        }),
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
    ...(op.job.kind === 'reaction' ? { actor_id: op.actor_id! } : {}), // FD1's stored actor
    ...(op.sight === undefined ? {} : { sight: op.sight }),
    ...(op.bleed_body_id === undefined
      ? {}
      : { bleed_body_id: op.bleed_body_id, bleed_generation: op.bleed_generation }),
  };
}

function crowBindingValid(op: Extract<DeltaOp, { op: 'job.schedule' }>) {
  return (
    op.crow_member_id !== undefined &&
    op.crow_generation !== undefined &&
    op.crow_phase !== undefined &&
    op.job.kind === 'population_bundle' &&
    op.encounter_id === undefined &&
    op.quest_instance_id === undefined &&
    op.water_generation === undefined &&
    op.water_body_id === undefined &&
    op.actor_id === undefined &&
    op.sight === undefined &&
    op.bleed_body_id === undefined &&
    op.bleed_generation === undefined
  );
}
