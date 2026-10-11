// status@1 (toolbox rows 1, G3): timed statuses on the player's body, an NPC or an item, one
// generation per holder/status pair; the tick job is unbound and finds its row by job id, so a
// stale one completes harmlessly.
import type {
  DefinitionRef,
  DeltaOp,
  EntityId,
  EventPayload,
  JobId,
  Key,
  Resistances,
  StatusRow,
  TextKey,
} from '../../contracts.gen.ts';
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

/** Status reader 2 emits status_applied only while a reaction listens for it (as W25's clock_hour). */
export const landing = (world: World) =>
  Object.values(world.cartridge.reactions ?? {}).some((r) => r.on.event === 'status_applied');

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
  const change = (value: StatusRow): DeltaOp => ({
    op: 'status.transition',
    writer_group,
    body_id: body,
    status,
    expected: prior ?? null,
    value,
  });
  const generation = (prior?.generation ?? 0) + 1;
  // A permanent status (row W8) has no end, tick or job (nor an hp_max modifier, so no settle).
  if (spec.duration === 'permanent') return active ? [] : [change({ active: true, generation })];
  const now = world.state.clock;
  const ends_at = add(now, spec.duration);
  if (active) return [change({ ...active, ends_at })];
  const next_tick_at = spec.per_tick === undefined ? ends_at : add(now, spec.tick_every);
  const value = {
    active: true as const,
    generation,
    ends_at,
    next_tick_at,
    job_id: mint() as JobId,
  };
  const job: DeltaOp = {
    op: 'job.schedule',
    writer_group,
    job_id: value.job_id,
    job: status,
    due_time: Math.min(next_tick_at, ends_at),
  };
  return [...settleFor(world, body, status, writer_group), change(value), job];
}

/**
 * Inactivate every active status on `body` at death, but a permanent one (row W8) on the same-body
 * return (`returning`); a cure goes through `cureOps`, which settles hp.
 */
export const clearStatuses = (
  world: World,
  body: EntityId,
  writer_group: number,
  returning = false,
): DeltaOp[] =>
  activeStatuses(world, body)
    .filter(({ spec }) => !returning || spec.duration !== 'permanent')
    .map(({ status, row }) => endStatus(body, status, row, writer_group));

/**
 * End each active status on `body` that `cures` lists, once however often listed (Eat, Drink), in
 * `writer_group` (a reaction's cure joins its holder's group, status reader 3).
 */
export function cureOps(
  world: World,
  body: EntityId,
  cures: readonly DefinitionRef[] = [],
  writer_group = 0,
) {
  const listed = new Set(cures.map(refString));
  return activeStatuses(world, body)
    .filter(({ status }) => listed.has(refString(status)))
    .flatMap(({ status, row }) => expire(world, body, status, row, writer_group));
}

/** Status reader 5: each resistance entry (a DamageKind or Tag) of `body`'s active statuses, summed. */
export function statusResistance(world: World, body: EntityId) {
  const specs = activeStatuses(world, body).map(({ spec }) => spec);
  return (entry: string) =>
    specs.reduce((sum, s) => add(sum, s.resistances?.[entry as keyof Resistances] ?? 0), 0);
}

/**
 * Status reader 4: whether `body`'s active statuses let it take Command type `command`: none blocks
 * it and every `allows` list names it. The player's admission (`permits`) and NPC combat turns read it.
 */
export function statusAllows(world: World, body: EntityId) {
  const bars = Object.values(world.cartridge.statuses ?? {}).some((s) => s.blocks || s.allows);
  const specs = bars ? activeStatuses(world, body).map(({ spec }) => spec) : [];
  return (command: string) =>
    specs.every(
      (s) => !s.blocks?.includes(command as Key) && (s.allows?.includes(command as Key) ?? true),
    );
}

/**
 * A status.apply or (status reader 3) status.cure step of a reaction or (row 29b) a spell on its
 * holders, once per holder and status in the rule or spell, in the one writer group the holder's
 * status writes share in this advance (job.ts statusGroup). Only a first application (over no row
 * or an inactive one) is heard: it emits status_applied (status reader 2) and, on the player's own
 * body, its applied line; a refresh while active is silent (row W25), and a permanent status (row
 * W8) opens with no job.
 */
export function statusStep(
  world: World,
  step: { op: 'status.apply' | 'status.cure'; status: DefinitionRef },
  on: readonly (EntityId | undefined)[],
  body: EntityId,
  group: number,
  { holders, applied }: { holders: Map<string, number>; applied: Set<string> },
  mint: Mint,
  emit: (payload: Extract<EventPayload, { type: 'status_applied' }>) => void,
) {
  const apply = step.op === 'status.apply';
  const out = { ops: [] as DeltaOp[], narration: [] as { key: TextKey }[] };
  for (const holder of on) {
    const once = `${holder}|${refString(step.status)}`;
    if (!holder || applied.has(once)) continue;
    applied.add(once);
    const joined = holders.get(holder) ?? group;
    const ops = apply
      ? applyStatus(world, holder, step.status, joined, mint)
      : cureOps(world, holder, [step.status], joined);
    if (ops.length) holders.set(holder, joined); // a later status job on the holder joins it too
    out.ops.push(...ops);
    const first = apply && ops.some((o) => o.op === 'status.transition' && !o.expected?.active);
    if (first && landing(world))
      emit({ type: 'status_applied', body_id: holder, status: step.status });
    const label = specOf(world, step.status)?.narration.applied;
    if (label && first && holder === body) out.narration.push({ key: label });
  }
  return out;
}
