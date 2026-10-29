import { createdKind, creationValid } from '../foundation/creation.ts';
// Derived corpse definitions are rebuilt from durable identity and the pinned cartridge only.
import { key, same } from '../foundation/compose.ts';
import type { DefinitionRef, EntityId, Key, RoomDefinition } from '../contracts.gen.ts';
import { OPPOSITE } from '../content/cartridge_barriers.ts';
import { validate } from '../foundation/validate.ts';
import { refString, type Entity, type State, type World } from './decision.ts';

type Identity = NonNullable<State['created']>[string];
type Draft = {
  rooms?: Record<string, RoomDefinition>;
  roomIds?: Record<string, EntityId>;
  entities?: Record<string, Entity>;
  knownEntities?: Record<string, World['knownEntities'][string]>;
  capacities?: Record<string, number>;
  entityResourceSpecs?: Record<string, World['resourceSpecs'][string]>;
};

/** A created corpse stays fixed; spawned loot uses ordinary item custody. */
export function movable(world: World, id: EntityId): boolean {
  const origin = world.state.created?.[id]?.origin;
  return !origin || (origin.kind === 'spawned' && origin.role === 'loot');
}

export function hydrate(world: World, state: State, loading = false): World | undefined {
  if (!loading && state.created === world.state.created && state.built === world.state.built)
    return { ...world, state };
  const draft: Draft = {};
  for (const [id, identity] of ordered(state)) {
    if (world.state.created?.[id] && same(identity, world.state.created[id])) {
      if (
        loading &&
        identity.origin.kind === 'spawned' &&
        identity.origin.role === 'hunter' &&
        !houndValid(world, state, id, identity, draft)
      )
        return undefined;
      continue;
    }
    if (!derive(world, state, id, identity, draft)) return undefined;
  }
  for (const id of Object.keys(state.built ?? {}))
    if (!same(state.built![id], world.state.built?.[id]) && !raze(world, state, id, draft))
      return undefined;
  if ((draft.rooms || loading) && !builtValid(world, state)) return undefined;
  const next = { ...world, state, ...draft };
  if (
    (draft.entities || (loading && (world.cartridge.world?.death || world.consumed))) &&
    !custodyValid(next)
  )
    return undefined;
  return next;
}

function ordered(state: State) {
  const rank = (i: Identity) =>
    !i?.origin
      ? 3
      : i.origin.kind === 'spawned'
        ? i.origin.role === 'hunter' || i.origin.role === 'prey'
          ? 0
          : 1
        : 2;
  return Object.entries(state.created ?? {}).sort(([, a], [, b]) => rank(a) - rank(b));
}

function derive(world: World, state: State, id: string, identity: Identity, draft: Draft): boolean {
  if (
    !identity ||
    identity.id !== id ||
    !creationValid(identity as never, {
      clock: state.clock,
      known_entities: draft.knownEntities ?? world.knownEntities,
      corpse_templates: world.corpseTemplates,
      population_specs: world.populationSpecs as never,
    })
  )
    return false;
  if (identity.origin.kind === 'built') return raise(world, state, id, identity, draft);
  const member = createdKind(identity as never) === 'npc';
  const template = member
    ? world.cartridge.npcs?.[refString(identity.definition)]
    : world.cartridge.items?.[refString(identity.definition)];
  if (
    !template ||
    (member
      ? !houndValid(world, state, id, identity, draft)
      : !itemValid(world, state, id, identity, draft))
  )
    return false;
  draft.entities ??= { ...world.entities };
  const { name, ...rest } = template;
  draft.entities[id] = { ...rest, short: name, kind: member ? 'npc' : 'item' } as Entity;
  draft.knownEntities ??= { ...world.knownEntities };
  const entity = draft.entities[id];
  draft.knownEntities[id] = {
    kind: entity.kind,
    ...(entity.kind === 'item' && entity.edible && { edible: true as const }),
    ...(entity.kind === 'item' && entity.bandage && { bandage: true as const }),
  };
  return true;
}

function houndValid(world: World, state: State, id: string, identity: Identity, draft: Draft) {
  if (identity.origin.kind !== 'spawned') return false;
  const spec = world.populationSpecs[key(identity.origin.by)];
  const room = state.containers[id];
  if (!spec) return false;
  const ordinary = spec.plan.area.some((r) => world.roomIds[refString(r)] === room);
  const crow =
    state.crows?.[key({ kind: 'crow', plan: identity.origin.by, slot: identity.origin.slot })];
  const excursion =
    spec.plan.scavenge &&
    crow &&
    crow.phase !== 'idle' &&
    crow.member_id === id &&
    crow.generation === identity.origin.generation &&
    spec.plan.scavenge.corridor.some((r) => world.roomIds[refString(r)] === room);
  const historical = spec.plan.scavenge?.corridor.some((r) => world.roomIds[refString(r)] === room);
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
    return false;
  if (!ordinary && !excursion && !(historical && hp.value === 0)) return false;
  draft.entityResourceSpecs ??= { ...world.entityResourceSpecs };
  draft.entityResourceSpecs[hpTarget] = spec.hp;
  return true;
}

type Built = Extract<Identity['origin'], { kind: 'built' }>;
// Built rooms S2: the room is the structure, entered from its site by the origin's direction.
function raise(world: World, state: State, id: string, identity: Identity, draft: Draft): boolean {
  const { site, direction } = identity.origin as Built;
  const structure = world.cartridge.structures?.[refString(identity.definition)];
  const declared = world.cartridge.rooms[refString(site)]?.site;
  const siteId = world.roomIds[refString(site)];
  if (
    !structure ||
    !siteId ||
    !declared?.directions.includes(direction) ||
    !declared.structures.some((b) => same(b, identity.definition))
  )
    return false;
  // A DefinitionRef key is [a-z][a-z0-9_]*, so the room key spells the uuid with underscores.
  const room = `built_${id.replaceAll('-', '_')}` as Key;
  const ref: DefinitionRef = { ...identity.definition, kind: 'room', key: room };
  draft.rooms ??= { ...world.rooms };
  draft.roomIds ??= { ...world.roomIds };
  draft.knownEntities ??= { ...world.knownEntities };
  const at = draft.rooms[siteId];
  // Built rooms S5: a razed room keeps its ids (contents may still name it) but has no exits.
  const razed = !!state.built?.[id];
  if (!razed) draft.rooms[siteId] = { ...at, exits: { ...at.exits, [direction]: { to: ref } } };
  draft.rooms[id] = {
    ...structure,
    key: room,
    exits: razed ? {} : { [OPPOSITE[direction]]: { to: site } },
  };
  draft.roomIds[refString(ref)] = id as EntityId;
  draft.knownEntities[id] = { kind: 'room' };
  return true;
}

// Built rooms S5: a room razed since world (its created row unchanged) loses its exits, and its
// site loses the exit only while that exit still leads to it.
function raze(world: World, state: State, id: string, draft: Draft): boolean {
  const origin = state.created?.[id]?.origin;
  const rooms = (draft.rooms ??= { ...world.rooms });
  if (origin?.kind !== 'built') return false;
  const siteId = world.roomIds[refString(origin.site)];
  const exits = { ...rooms[siteId].exits };
  if (exits[origin.direction]?.to.key === rooms[id].key) delete exits[origin.direction];
  rooms[siteId] = { ...rooms[siteId], exits };
  rooms[id] = { ...rooms[id], exits: {} };
  return true;
}

// Over every built row of the state, not only the changed ones: one live room per site direction,
// at most world.construction.max_total live; each tombstone is no later than the clock and holds
// nothing (raze() in hydrate refuses one that names no built room).
function builtValid(world: World, state: State): boolean {
  const sites = Object.entries(state.created ?? {}).flatMap(([id, i]) =>
    i?.origin.kind === 'built' && !state.built?.[id]
      ? [key([i.origin.site, i.origin.direction])]
      : [],
  );
  const razed = Object.entries(state.built ?? {});
  return (
    new Set(sites).size === sites.length &&
    sites.length <= (world.cartridge.world?.construction?.max_total ?? 0) &&
    razed.every(
      ([, row]) => !validate('BuiltRow', row as never).length && row.razed_at <= state.clock,
    ) &&
    !Object.values(state.containers).some((c) => state.built?.[c])
  );
}

function itemValid(world: World, state: State, id: string, identity: Identity, draft: Draft) {
  const item = world.cartridge.items?.[refString(identity.definition)];
  if (
    !item ||
    item.location.in !== 'template' ||
    item.capacity !== undefined ||
    item.slot !== undefined ||
    item.barrier !== undefined ||
    !state.containers[id]
  )
    return false;
  if (!item.container) {
    draft.capacities ??= { ...world.capacities };
    draft.capacities[id] = 0;
  }
  return true;
}

function custodyValid(world: World): boolean {
  const done = new Set<string>();
  const held: Record<string, number> = {};
  for (const [id, container] of Object.entries(world.state.containers)) {
    if (
      id === world.consumed ||
      (container === world.consumed &&
        (world.entities[id]?.kind !== 'item' ||
          (!world.entities[id].edible && !world.entities[id].bandage)))
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
