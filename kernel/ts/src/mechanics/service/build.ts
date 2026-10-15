// Built rooms S2 (mechanics.md Built rooms): the build benefit's gate and its one created row.
import type {
  CommandPayload,
  DeltaOp,
  EntityId,
  ServiceDefinition,
  TextKey,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import type { Mint, World } from '../../runtime/decision.ts';

type Build = Extract<ServiceDefinition['benefit'], { kind: 'build' }>;
const refused = (key: string) => ({
  code: 'invalid_state' as const,
  message: { key: key as TextKey },
});

/** One structure per site direction, at most world.construction.max_total. */
export function unbuildable(world: World, b: Build) {
  const built = Object.values(world.state.created ?? {}).flatMap((i) =>
    i.origin.kind === 'built' ? [i.origin] : [],
  );
  if (built.some((o) => same(o.site, b.site) && o.direction === b.direction))
    return refused('service.site_taken');
  if (built.length >= (world.cartridge.world?.construction?.max_total ?? 0))
    return refused('service.construction_full');
  return undefined;
}

/** A paid build mints the room's identity; hydrate derives the room from it. */
export function raised(
  p: Extract<CommandPayload, { type: 'use_service' }>,
  s: ServiceDefinition,
  mint: Mint,
): DeltaOp[] {
  const b = s.benefit;
  if (b.kind !== 'build') return [];
  const id = mint() as EntityId;
  const origin = {
    kind: 'built',
    site: b.site,
    direction: b.direction,
    owner: p.actor_id,
  } as const;
  return [
    { op: 'entity.create', writer_group: 0, identity: { id, definition: b.blueprint, origin } },
  ];
}
