// status@1 (toolbox rows 1, G3): timed statuses on the player's body, an NPC or an item, one
// generation per holder/status pair; the tick job is unbound and finds its row by job id, so a
// stale one completes harmlessly.
import type { DefinitionRef, DeltaOp, EntityId, JobId, StatusRow } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { key } from '../../foundation/compose.ts';
import { type Mint, refString, type World } from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';
import { HOLDERS } from '../../foundation/compose_status.ts';
import { living } from '../death/shared.ts';
import { settleMaxima } from '../resource.ts';

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

/**
 * A status whose `modifies` (row 2c) names an hp_max term and starts or ends on the player's body
 * moves that maximum, so hp settles first, at the world's clock (resource@1, as wear and remove do).
 */
export const settleFor = (
  world: World,
  body: EntityId,
  status: DefinitionRef,
  writer_group: number,
): DeltaOp[] => {
  const terms = world.cartridge.world?.derived?.hp_max?.terms ?? [];
  const moves = specOf(world, status)?.modifies?.some(({ attribute }) =>
    terms.some((t) => refString(t.attribute) === refString(attribute)),
  );
  return body === world.body && moves
    ? settleMaxima(world).map((op) => ({ ...op, writer_group, at: world.state.clock }))
    : [];
};

/** End an active status by expiry or cure, settling a derived hp maximum first (row 2c). */
export const expire = (
  world: World,
  body: EntityId,
  status: DefinitionRef,
  row: Active,
  writer_group: number,
): DeltaOp[] => [
  ...settleFor(world, body, status, writer_group),
  endStatus(body, status, row, writer_group),
];

/**
 * The NPC or item instance `body` declares `status` immune (row G3); a created NPC or item copies
 * its template's list (runtime/created.ts).
 */
export const immune = (world: World, body: EntityId, status: DefinitionRef) =>
  !!world.entities[body]?.immune?.some((s) => refString(s) === refString(status));

/** `body` can hold a status: the player's body, a living NPC or an item (row G3). */
const holds = (world: World, body: EntityId) =>
  HOLDERS.includes(world.knownEntities[body]?.kind ?? '') && living(world, body);

/**
 * Apply or refresh `status` on `body` (a body, a living NPC or an item) at the world's clock; an
 * unknown or immune status, a dead NPC or another kind of entity changes nothing.
 */
// size: allow 43, a first application writes the row and schedules its job; a refresh writes only the end
export function applyStatus(
  world: World,
  body: EntityId,
  status: DefinitionRef,
  writer_group: number,
  mint: Mint,
): DeltaOp[] {
  const spec = specOf(world, status);
  if (!spec || !holds(world, body) || immune(world, body, status)) return [];
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
        next_tick_at: spec.per_tick === undefined ? ends_at : add(now, spec.tick_every),
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
  if (active) return [change];
  const due_time = Math.min(value.next_tick_at, ends_at);
  const job: DeltaOp = {
    op: 'job.schedule',
    writer_group,
    job_id: value.job_id,
    job: status,
    due_time,
  };
  return [...settleFor(world, body, status, writer_group), change, job];
}

/** Inactivate every active status on `body` at death (a cure goes through `cureOps`, which settles hp). */
export const clearStatuses = (world: World, body: EntityId, writer_group: number): DeltaOp[] =>
  activeStatuses(world, body).map(({ status, row }) => endStatus(body, status, row, writer_group));

/** End each active status on `body` that `cures` lists, once however often listed (Eat, Drink). */
export function cureOps(world: World, body: EntityId, cures: readonly DefinitionRef[] = []) {
  const listed = new Set(cures.map(refString));
  return activeStatuses(world, body)
    .filter(({ status }) => listed.has(refString(status)))
    .flatMap(({ status, row }) => expire(world, body, status, row, 0));
}
