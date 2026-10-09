// status@1 (toolbox row 1): timed statuses on the player's body, one generation per body/status
// pair; the tick job is unbound and finds its row by job id, so a stale one completes harmlessly.
// ponytail: only world.body carries statuses (the job names no body); add a job binding for NPCs.
import type { DefinitionRef, DeltaOp, EntityId, JobId, StatusRow } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { key } from '../../foundation/compose.ts';
import { type Mint, refString, type World } from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';

type Active = Extract<StatusRow, { active: true }>;

export const statusKey = (body: EntityId, status: DefinitionRef) =>
  key({ kind: 'status', body_id: body, status });

export const specOf = (world: World, status: DefinitionRef) =>
  world.cartridge.statuses?.[refString(status)];

export function currentStatus(world: World, body: EntityId, status: DefinitionRef) {
  const row = world.state.statuses?.[statusKey(body, status)];
  return row?.active ? (row as Active) : undefined;
}

/** Every active status on `body` with its definition, in canonical definition order. */
export function activeStatuses(world: World, body: EntityId) {
  return Object.entries(world.cartridge.statuses ?? {})
    .sort(([a], [b]) => cmp(a, b))
    .flatMap(([, spec]) => {
      const status: DefinitionRef = {
        cartridge_id: world.cartridge.manifest.id,
        cartridge_version: world.cartridge.manifest.version,
        kind: 'status' as DefinitionRef['kind'],
        key: spec.key,
      };
      const row = currentStatus(world, body, status);
      return row ? [{ status, spec, row }] : [];
    });
}

export const endStatus = (
  body: EntityId,
  status: DefinitionRef,
  row: Active,
  writer_group: number,
): DeltaOp => ({
  op: 'status.transition',
  writer_group,
  body_id: body,
  status,
  expected: row,
  value: { active: false, generation: row.generation },
});

/** Apply or refresh `status` on `body` at the world's clock; unknown statuses change nothing. */
// size: allow 43, a first application writes the row and schedules its job; a refresh writes only the end
export function applyStatus(
  world: World,
  body: EntityId,
  status: DefinitionRef,
  writer_group: number,
  mint: Mint,
): DeltaOp[] {
  const spec = specOf(world, status);
  if (!spec) return [];
  const prior = world.state.statuses?.[statusKey(body, status)];
  const active = prior?.active ? (prior as Active) : undefined;
  const now = world.state.clock;
  const ends_at = add(now, spec.duration);
  const value: Active = active
    ? { ...active, ends_at }
    : {
        active: true,
        generation: (prior?.generation ?? 0) + 1,
        ends_at,
        next_tick_at: add(now, spec.tick_every),
        job_id: mint() as JobId,
      };
  const change: DeltaOp = {
    op: 'status.transition',
    writer_group,
    body_id: body,
    status,
    expected: prior ?? null,
    value,
  };
  return active
    ? [change]
    : [
        change,
        {
          op: 'job.schedule',
          writer_group,
          job_id: value.job_id,
          job: status,
          due_time: Math.min(value.next_tick_at, ends_at),
        },
      ];
}

/** Inactivate every active status on `body` (death, or a cure listing them). */
export const clearStatuses = (world: World, body: EntityId, writer_group: number): DeltaOp[] =>
  activeStatuses(world, body).map(({ status, row }) => endStatus(body, status, row, writer_group));
