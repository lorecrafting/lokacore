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
import { applyStatus } from '../status/shared.ts';

type Build = Extract<ServiceDefinition['benefit'], { kind: 'build' }>;
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
function created(world: World, b: Build, owner: CharacterId, mint: Mint): DeltaOp[] {
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

/** A paid build without materials mints the room's identity; hydrate derives the room from it. */
export function raised(
  world: World,
  p: Extract<CommandPayload, { type: 'use_service' }>,
  s: ServiceDefinition,
  mint: Mint,
): DeltaOp[] {
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
