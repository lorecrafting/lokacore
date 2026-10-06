import { creationValid } from '../foundation/creation.ts';
// Derived corpse definitions are rebuilt from durable identity and the pinned cartridge only.
import { key } from '../foundation/compose.ts';
import { refString, type Entity, type State, type World } from './decision.ts';

export function hydrate(world: World, state: State, loading = false): World | undefined {
  if (!loading && state.created === world.state.created) return { ...world, state };
  let entities: Record<string, Entity> | undefined;
  let knownEntities: Record<string, { kind: string; owner_id?: World['character'] }> | undefined;
  let capacities: Record<string, number> | undefined;
  let entityResourceSpecs: Record<string, World['resourceSpecs'][string]> | undefined;
  const ordered = Object.entries(state.created ?? {}).sort(([, a], [, b]) => {
    const rank = (i: typeof a) =>
      i.origin.kind === 'spawned' ? (i.origin.role === 'hound' ? 0 : 1) : 2;
    return rank(a) - rank(b);
  });
  for (const [id, identity] of ordered) {
    if (identity === world.state.created?.[id]) continue;
    const currentKnown = knownEntities ?? world.knownEntities;
    if (
      !creationValid(identity as never, {
        clock: state.clock,
        known_entities: currentKnown,
        corpse_templates: world.corpseTemplates,
        population_specs: world.populationSpecs as never,
      }) ||
      identity.id !== id
    )
      return undefined;
    const spawned = identity.origin.kind === 'spawned';
    const hound = spawned && identity.origin.role === 'hound';
    const template = hound
      ? world.cartridge.npcs?.[refString(identity.definition)]
      : world.cartridge.items?.[refString(identity.definition)];
    if (!template) return undefined;
    if (hound) {
      const spec = world.populationSpecs[key(identity.origin.by)];
      const room = state.containers[id];
      if (!spec || !spec.plan.area.some((r) => world.roomIds[refString(r)] === room))
        return undefined;
      const hpTarget = key({
        kind: 'resource',
        resource: {
          cartridge_id: world.cartridge.manifest.id,
          cartridge_version: world.cartridge.manifest.version,
          kind: 'resource',
          key: 'hp',
        },
        entity_id: id,
      });
      const hp = state.resources?.[hpTarget];
      if (
        !hp ||
        hp.at < 0 ||
        hp.at > state.clock ||
        hp.value < spec.hp.minimum ||
        hp.value > spec.hp.maximum
      )
        return undefined;
      entityResourceSpecs ??= { ...world.entityResourceSpecs };
      entityResourceSpecs[hpTarget] = spec.hp;
    } else {
      const item = world.cartridge.items?.[refString(identity.definition)];
      if (
        !item ||
        item.location.in !== 'template' ||
        item.capacity !== undefined ||
        item.slot !== undefined ||
        item.barrier !== undefined ||
        !state.containers[id]
      )
        return undefined;
      if (!item.container) {
        capacities ??= { ...world.capacities };
        capacities[id] = 0;
      }
    }
    entities ??= { ...world.entities };
    entities[id] = { ...template, kind: hound ? 'npc' : 'item' } as Entity;
    knownEntities ??= { ...world.knownEntities };
    knownEntities[id] = { kind: hound ? 'npc' : 'item' };
  }
  const next = {
    ...world,
    state,
    ...(entities && { entities }),
    ...(knownEntities && { knownEntities }),
    ...(capacities && { capacities }),
    ...(entityResourceSpecs && { entityResourceSpecs }),
  };
  // One-time load/new-corpse validation; ordinary resource/timer steps retain derived maps.
  if ((entities || (loading && world.cartridge.world?.death)) && !custodyValid(next))
    return undefined;
  return next;
}

function custodyValid(world: World): boolean {
  const done = new Set<string>();
  const held: Record<string, number> = {};
  for (const [id, container] of Object.entries(world.state.containers)) {
    if (!world.knownEntities[id] && !world.state.created?.[id]) return false;
    held[container] = (held[container] ?? 0) + 1;
    const path = new Set<string>();
    let at: string | undefined = id;
    while (at !== undefined && !world.rooms[at] && !done.has(at)) {
      if (path.has(at)) return false;
      path.add(at);
      at = world.state.containers[at];
    }
    if (at === undefined) return false;
    for (const e of path) done.add(e);
  }
  return (
    Object.keys(world.entities).every((id) => world.state.containers[id] !== undefined) &&
    Object.entries(world.capacities).every(([id, capacity]) => (held[id] ?? 0) <= capacity)
  );
}
