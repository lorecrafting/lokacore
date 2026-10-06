import { creationValid } from '../foundation/creation.ts';
// Derived corpse definitions are rebuilt from durable identity and the pinned cartridge only.
import { refString, type Entity, type State, type World } from './decision.ts';

export function hydrate(world: World, state: State, loading = false): World | undefined {
  if (!loading && state.created === world.state.created) return { ...world, state };
  let entities: Record<string, Entity> | undefined;
  for (const [id, identity] of Object.entries(state.created ?? {})) {
    if (identity === world.state.created?.[id]) continue;
    if (
      !creationValid(identity as never, {
        clock: state.clock,
        known_entities: world.knownEntities,
        corpse_templates: world.corpseTemplates,
      }) ||
      identity.id !== id
    )
      return undefined;
    const template = world.cartridge.items?.[refString(identity.definition)];
    if (
      !template ||
      template.location.in !== 'template' ||
      template.capacity !== undefined ||
      template.slot !== undefined ||
      template.barrier !== undefined ||
      !Object.hasOwn(world.rooms, state.containers[id])
    )
      return undefined;
    entities ??= { ...world.entities };
    entities[id] = { ...template, kind: 'item' };
  }
  const next = { ...world, state, ...(entities && { entities }) };
  // One-time load/new-corpse validation; ordinary resource/timer steps retain derived maps.
  if (
    (entities || (loading && (world.cartridge.world?.death || world.consumed))) &&
    !custodyValid(next)
  )
    return undefined;
  return next;
}

function custodyValid(world: World): boolean {
  const done = new Set<string>();
  const held: Record<string, number> = {};
  for (const [id, container] of Object.entries(world.state.containers)) {
    if (
      id === world.consumed ||
      (container === world.consumed &&
        (world.entities[id]?.kind !== 'item' || !world.entities[id].edible))
    )
      return false;
    if (!world.knownEntities[id] && !world.state.created?.[id]) return false;
    held[container] = (held[container] ?? 0) + 1;
    const path = new Set<string>();
    let at: string | undefined = id;
    while (at !== undefined && !world.rooms[at] && at !== world.consumed && !done.has(at)) {
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
