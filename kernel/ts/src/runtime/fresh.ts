// A fresh world from a loaded loka-cartridge-v2 artifact (03 §1, §3, §23; numeric profile,
// Initial world ids), split from runtime/world.ts, which re-exports newWorld.
import type { CharacterId, EntityId, ResourceSpec, WorldContextId } from '../contracts.gen.ts';
import { initialPopulation } from '../mechanics/population/shared.ts';
import { initialLiquids } from '../mechanics/liquid/shared.ts';
import { key } from '../foundation/compose.ts';
import { refString, type Cartridge, type Detail, type Entity, type World } from './decision.ts';
import { firstJobs } from '../mechanics/schedule/behavior.ts';
import { id } from '../foundation/id_source.ts';
import type { RngState } from '../foundation/rng.ts';
import { cmp } from '../foundation/validate.ts';

export const NIL = '00000000-0000-0000-0000-000000000000';

/**
 * A fresh world: IdSource ids under the nil CommandId (ordinal 0 the player's CharacterId, 1 its
 * body entity, then each room in DefinitionRefString order, then each room's details in the same
 * room order and detail-key order, then each NPC, then each item, both in DefinitionRefString
 * order, then one job per NPC with a non-empty daily schedule, in the same NPC order, then one
 * slot holder per distinct item slot, in slot-key order: numeric profile, Initial world ids and
 * Slot holder ids), each holder in the body with capacity 1 and not an entity, the body in the entry room, each NPC in its room and each item at
 * its location, the calendar's start time (0 without one), each NPC's first job pending at its
 * schedule's first listed hour strictly after that time (mechanics/schedule/behavior.ts next; 04 §5.4: a job is
 * scheduled strictly later than now), each fact's default by its canonical DefinitionRef text
 * and no fact set. A world that starts after 0 stores the body's resources at their start values
 * at that time, since an unset legacy resource regenerates from time 0. Opted rows also
 * exist at clock zero, with standing rate and no fractional credit.
 */
export function newWorld(cartridge: Cartridge, context: WorldContextId, seed: RngState): World {
  let ordinal = 0;
  const mint = () => id(context, NIL, ordinal++) as EntityId;
  return initialPopulation(baseWorld(cartridge, context, seed, mint), mint, NIL as never);
}

function baseWorld(
  cartridge: Cartridge,
  context: WorldContextId,
  seed: RngState,
  mint: () => EntityId,
): World {
  const [character, body] = [mint() as string as CharacterId, mint()];
  const refs = Object.keys(cartridge.rooms).sort(cmp);
  const roomIds = Object.fromEntries(refs.map((r) => [r, mint()]));
  const details = roomDetails(cartridge, refs, roomIds, mint);
  const { entities, entityIds, containers, capacities } = place(cartridge, roomIds, mint);
  containers[body] = roomIds[refString(cartridge.entry)];
  const { liquids, liquidSpecs } = initialLiquids(cartridge, entities);
  const clock = cartridge.calendar?.start ?? 0;
  const jobs = firstJobs(cartridge, clock, mint);
  const slots = holders(cartridge, mint);
  for (const holder of Object.values(slots)) [containers[holder], capacities[holder]] = [body, 1];
  const { resources, entityResourceSpecs } = started(cartridge, body, clock, entities);
  const { fuelSpecs, fuel } = initialFuel(entities, clock);
  const world: World = {
    fuelSpecs,
    cartridge,
    context,
    character,
    body,
    rooms: Object.fromEntries(refs.map((r) => [roomIds[r], cartridge.rooms[r]])),
    roomIds,
    details,
    entities,
    entityIds,
    capacities,
    liquidSpecs,
    knownEntities: pinnedEntities(roomIds, details, entities, slots, body, character),
    ...staticSpecs(cartridge, roomIds),
    slots,
    entityResourceSpecs,
    state: { clock, containers, rng: seed, ...written({ jobs, resources, fuel, liquids }) },
  };
  return world;
}

function staticSpecs(cartridge: Cartridge, roomIds: World['roomIds']) {
  return {
    corpseTemplates: corpseTemplates(cartridge),
    populationSpecs: populationSpecs(cartridge, roomIds),
    factDefaults: byRef(cartridge, 'fact', cartridge.facts, (f) => f.value_type.default),
    resourceSpecs: byRef(cartridge, 'resource', cartridge.resources, (s) => s),
    barrierInitial: byRef(cartridge, 'barrier', cartridge.barriers, (b) => b.initial),
    attributes: byRef(cartridge, 'attribute', cartridge.attributes, (a) => a.start),
  };
}

// A definition map's values by canonical DefinitionRef text, as composition reads them (the
// ResourceSpecs, each barrier's initial state).
const byRef = <D extends { key: string }, V>(
  c: Cartridge,
  kind: string,
  defs: Readonly<Record<string, D>> = {},
  value: (d: D) => V,
) =>
  Object.fromEntries(
    Object.values(defs).map((d) => {
      const { id: cartridge_id, version: cartridge_version } = c.manifest;
      return [key({ cartridge_id, cartridge_version, kind, key: d.key }), value(d)];
    }),
  );

// Each NPC, then each item, in DefinitionRefString order, with its minted id, its container (an
// NPC's room, an item's location) and its declared capacity.
function place(
  cartridge: Cartridge,
  roomIds: Readonly<Record<string, EntityId>>,
  mint: () => EntityId,
) {
  const sorted = <T>(m?: Readonly<Record<string, T>>) =>
    Object.entries(m ?? {}).sort(([a], [b]) => cmp(a, b));
  const defs: [string, Entity][] = [
    ...sorted(cartridge.npcs)
      .filter(([, d]) => !d.spawn_template)
      .map(([r, d]): [string, Entity] => [r, { ...d, kind: 'npc' }]),
    ...sorted(cartridge.items)
      .filter(([, d]) => d.location.in !== 'template')
      .map(([r, d]): [string, Entity] => [r, { ...d, kind: 'item' }]),
  ];
  const entityIds = Object.fromEntries(defs.map(([r]) => [r, mint()]));
  const ids = { ...roomIds, ...entityIds };
  const containers: Record<string, EntityId> = {};
  for (const [r, e] of defs) {
    const l = e.kind === 'item' ? e.location : { in: 'room' as const, room: e.room };
    if (l.in === 'template') continue;
    containers[entityIds[r]] =
      ids[refString(l.in === 'room' ? l.room : l.in === 'npc' ? l.npc : l.item)];
  }
  return {
    entities: Object.fromEntries(defs.map(([r, e]) => [entityIds[r], e])),
    entityIds,
    containers,
    capacities: Object.fromEntries(
      defs.flatMap(([r, e]) => {
        const capacity = e.kind === 'item' && e.container !== true ? 0 : e.capacity;
        return capacity === undefined ? [] : [[entityIds[r], capacity]];
      }),
    ),
  };
}

// Birth resource rows by canonical target: player start values and explicitly authored NPC HP.
function started(cartridge: Cartridge, body: EntityId, clock: number, entities: World['entities']) {
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  const resources = Object.fromEntries(
    Object.values(cartridge.resources ?? {})
      .filter(
        (s) =>
          (clock !== 0 ||
            s.regen ||
            Object.values(cartridge.services ?? {}).some(
              (service) => service.currency.key === s.key,
            )) &&
          !Object.values(cartridge.services ?? {}).some(
            (service) => service.benefit.kind === 'meal' && service.benefit.stock.key === s.key,
          ),
      )
      .map((s) => {
        const resource = { cartridge_id, cartridge_version, kind: 'resource', key: s.key };
        const row = {
          value: s.start,
          at: clock,
          ...(s.regen && { rate: s.regen.by_position.standing, remainder: 0 }),
        };
        return [key({ kind: 'resource', resource, entity_id: body }), row];
      }),
  );
  const entityResourceSpecs: Record<string, ResourceSpec> = {};
  for (const [entity_id, e] of Object.entries(entities)) {
    if (e.kind !== 'npc') continue;
    for (const [name, value] of Object.entries(e.resource_starts ?? {})) {
      const resource = { cartridge_id, cartridge_version, kind: 'resource', key: name };
      resources[key({ kind: 'resource', resource, entity_id })] = { value, at: clock };
    }
    if (!e.hp) continue;
    const resource = { cartridge_id, cartridge_version, kind: 'resource', key: 'hp' };
    const target = key({ kind: 'resource', resource, entity_id });
    entityResourceSpecs[target] = { key: 'hp' as ResourceSpec['key'], ...e.hp };
    resources[target] = { value: e.hp.start, at: clock };
  }
  return { resources, entityResourceSpecs };
}

// The sections that have rows: a world that writes none keeps its earlier state hash.
const written = (sections: Record<string, object>) =>
  Object.fromEntries(Object.entries(sections).filter(([, rows]) => Object.keys(rows).length));

function pinnedEntities(
  roomIds: World['roomIds'],
  details: World['details'],
  entities: World['entities'],
  slots: World['slots'],
  body: EntityId,
  character: CharacterId,
): World['knownEntities'] {
  return {
    ...Object.fromEntries(Object.keys(roomIds).map((r) => [roomIds[r], { kind: 'room' }])),
    ...Object.fromEntries(Object.keys(details).map((id) => [id, { kind: 'detail' }])),
    ...Object.fromEntries(Object.entries(entities).map(([id, e]) => [id, { kind: e.kind }])),
    ...Object.fromEntries(Object.values(slots).map((id) => [id, { kind: 'slot' }])),
    [body]: { kind: 'body', owner_id: character },
  };
}
function corpseTemplates(cartridge: Cartridge): World['corpseTemplates'] {
  return cartridge.world?.death
    ? {
        [key(cartridge.world.death.player_corpse)]: 'player',
        [key(cartridge.world.death.npc_corpse)]: 'npc',
        ...Object.fromEntries(
          Object.values(cartridge.population_bundles ?? {}).map((b) => [key(b.corpse), 'npc']),
        ),
      }
    : {};
}

function populationSpecs(
  cartridge: Cartridge,
  roomIds: World['roomIds'],
): World['populationSpecs'] {
  return Object.fromEntries(
    Object.entries(cartridge.populations ?? {}).map(([, plan]) => {
      const bundle = cartridge.population_bundles![refString(plan.bundle)]!;
      const npc = cartridge.npcs![refString(bundle.npc)]!;
      return [
        key({
          cartridge_id: cartridge.manifest.id,
          cartridge_version: cartridge.manifest.version,
          kind: 'population',
          key: plan.key,
        }),
        {
          bundle: plan.bundle,
          hound: bundle.npc,
          pelt: bundle.item,
          corpse: bundle.corpse,
          home: roomIds[refString(plan.home)],
          cap: plan.cap,
          hp: { key: 'hp' as ResourceSpec['key'], ...npc.hp! },
          plan,
        },
      ];
    }),
  );
}

function holders(cartridge: Cartridge, mint: () => EntityId) {
  const keys = [...new Set(Object.values(cartridge.items ?? {}).flatMap((i) => i.slot ?? []))];
  return Object.fromEntries(keys.sort(cmp).map((k) => [k, mint()]));
}

function roomDetails(
  cartridge: Cartridge,
  refs: string[],
  roomIds: World['roomIds'],
  mint: () => EntityId,
) {
  const details: Record<string, Detail> = {};
  for (const r of refs)
    for (const [key, d] of Object.entries(cartridge.rooms[r].details ?? {}).sort(([a], [b]) =>
      cmp(a, b),
    ))
      details[mint()] = { ...d, room: roomIds[r], key };
  return details;
}

function initialFuel(entities: World['entities'], clock: number) {
  const fuelSpecs = Object.fromEntries(
    Object.entries(entities).flatMap(([i, e]) =>
      e.kind === 'item' && e.fuel ? [[i, e.fuel]] : [],
    ),
  );
  const fuel = Object.fromEntries(
    Object.entries(fuelSpecs).map(([i, spec]) => [
      i,
      { remaining: spec.initial, at: clock, lit: false },
    ]),
  );
  return { fuelSpecs, fuel };
}
