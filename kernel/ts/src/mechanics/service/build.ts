// Built rooms S2/S3 (mechanics.md Built rooms): the build benefit's gate and its one created row,
// raised at once (S2) or by the commission's due order job (S3).
import type {
  CharacterId,
  CommandPayload,
  DeltaOp,
  EntityId,
  JobId,
  ServiceDefinition,
  TextKey,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import {
  bodyOf,
  refString,
  type JobRow,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { assigned, value } from '../fact.ts';
import { selected } from '../containment/stock.ts';
import { applyStatus, cureOps, currentStatus } from '../status/shared.ts';

type Build = Pick<
  Extract<ServiceDefinition['benefit'], { kind: 'build' }>,
  'blueprint' | 'site' | 'direction'
>; // a build service's or (S6) a recipe build step's
const refused = (key: string) => ({
  code: 'invalid_state' as const,
  message: { key: key as TextKey },
});

/** One structure per site direction, at most world.construction.max_total, and at most the
 * blueprint's max_per_owner raised for `owner`. */
export function unbuildable(world: World, b: Build, owner: CharacterId) {
  const built = Object.values(world.state.created ?? {}).flatMap((i) =>
    i.origin.kind === 'built' ? [{ ...i.origin, definition: i.definition }] : [],
  );
  if (built.some((o) => same(o.site, b.site) && o.direction === b.direction))
    return refused('service.site_taken');
  const mine = built.filter((o) => o.owner === owner && same(o.definition, b.blueprint));
  const cap = world.cartridge.blueprints?.[refString(b.blueprint)]?.max_per_owner ?? Infinity;
  if (built.length >= (world.cartridge.world?.construction?.max_total ?? 0) || mine.length >= cap)
    return refused('service.construction_full');
  return undefined;
}

// The created row, then (S4) the blueprint's weathering on the new room. The room is known only
// after hydrate, so the status is applied on a world that already knows it (compose admits a
// holder created earlier in the same delta).
export function created(world: World, b: Build, owner: CharacterId, mint: Mint): DeltaOp[] {
  const origin = { kind: 'built', site: b.site, direction: b.direction, owner } as const;
  const identity = { id: mint() as EntityId, definition: b.blueprint, origin };
  const weathering = world.cartridge.blueprints?.[refString(b.blueprint)]?.weathering;
  const known = { ...world.knownEntities, [identity.id]: { kind: 'room' as const } };
  return [
    { op: 'entity.create', writer_group: 0, identity },
    ...(weathering
      ? applyStatus({ ...world, knownEntities: known }, identity.id, weathering, 0, mint)
      : []),
  ];
}

type Mend = Extract<ServiceDefinition['benefit'], { kind: 'mend' }>;

/** Built rooms S4: the room built at the mend's site direction while its blueprint's ruin is active
 * on it, else undefined. */
function ruined(world: World, b: Mend) {
  const [id, room] =
    Object.entries(world.state.created ?? {}).find(
      ([, i]) =>
        i.origin.kind === 'built' &&
        same(i.origin.site, b.site) &&
        i.origin.direction === b.direction,
    ) ?? [];
  const blueprint = room && world.cartridge.blueprints?.[refString(room.definition)];
  return blueprint?.ruin && currentStatus(world, id as EntityId, blueprint.ruin)
    ? { id: id as EntityId, blueprint }
    : undefined;
}

export const unmendable = (world: World, b: Mend) =>
  ruined(world, b) ? undefined : refused('service.nothing_to_mend');

// The mend cures ruin and weathers the room again from now.
function mended(world: World, b: Mend, mint: Mint): DeltaOp[] {
  const { id, blueprint } = ruined(world, b)!;
  const again = blueprint.weathering ? applyStatus(world, id, blueprint.weathering, 0, mint) : [];
  return [...cureOps(world, id, [blueprint.ruin!]), ...again];
}

/** A paid build without materials mints the room's identity; hydrate derives the room from it.
 * A mend (S4) cures and re-weathers its ruined room. */
export function raised(
  world: World,
  p: Extract<CommandPayload, { type: 'use_service' }>,
  s: ServiceDefinition,
  mint: Mint,
): DeltaOp[] {
  if (s.benefit.kind === 'mend') return mended(world, s.benefit, mint);
  return s.benefit.kind === 'build' && !s.benefit.escrow
    ? created(world, s.benefit, p.actor_id, mint)
    : [];
}

/** Built rooms S3: a due build commission's order job raises its owner's room (row.actor_id, never
 * the session character) and closes the order. A cancelled order, or one a later order of the same
 * owner replaced, writes nothing; a site lost meanwhile returns the materials in custody instead.
 * A refund past the query budget, or to an owner with no body here, faults: nothing is lost. */
export function built(
  world: World,
  job_id: JobId,
  row: JobRow,
  mint: Mint,
  steps: Steps,
): readonly DeltaOp[] | 'budget_exceeded' | 'precondition_failed' {
  const b = world.cartridge.services?.[refString({ ...row.job, kind: 'service' })]?.benefit;
  const owner = row.actor_id;
  if (b?.kind !== 'build' || !b.fact || !b.escrow || !owner) return [];
  if (value(world, owner, b.fact) !== true) return [];
  const later = Object.entries(world.state.jobs ?? {}).some(
    ([id, r]) =>
      id !== job_id && r.status === 'pending' && same(r.job, row.job) && r.actor_id === owner,
  );
  if (later) return [];
  const closed = assigned(
    world,
    owner,
    { ops: [], position: 0, facts: {} },
    { fact: b.fact, value: false },
    'service',
  ).ops;
  if (!unbuildable(world, b, owner)) return [...created(world, b, owner, mint), ...closed];
  const custody = world.roomIds[refString(b.escrow.custody)];
  const body = bodyOf(world, owner);
  if (!body) return 'precondition_failed';
  const back = selected(world, b.escrow.items, custody, b.escrow.quantity, steps);
  if (typeof back === 'string') return back;
  const moves = back.map((entity_id) => ({
    op: 'entity.transfer' as const,
    writer_group: 0,
    entity_id,
    source_id: custody,
    destination_id: body,
  }));
  return [...moves, ...closed];
}
