// A fresh world from a loaded loka-cartridge-v2 artifact (03 §1, §3, §23; numeric profile,
// Initial world ids), split from world.ts, which re-exports newWorld.
import type { CharacterId, EntityId, WorldContextId } from './contracts.gen.ts';
import { key } from './compose.ts';
import { refString, type Cartridge, type Detail, type Entity, type World } from './decision.ts';
import { firstJobs } from './behavior.ts';
import { id } from './id_source.ts';
import type { RngState } from './rng.ts';
import { cmp } from './validate.ts';

export const NIL = '00000000-0000-0000-0000-000000000000';

/**
 * A fresh world: IdSource ids under the nil CommandId (ordinal 0 the player's CharacterId, 1 its
 * body entity, then each room in DefinitionRefString order, then each room's details in the same
 * room order and detail-key order, then each NPC, then each item, both in DefinitionRefString
 * order, then one job per NPC with a non-empty daily schedule, in the same NPC order: numeric
 * profile, Initial world ids), the body in the entry room, each NPC in its room and each item at
 * its location, the calendar's start time (0 without one), each NPC's first job pending at its
 * schedule's first listed hour strictly after that time (behavior.ts next; 04 §5.4: a job is
 * scheduled strictly later than now), each fact's default by its canonical DefinitionRef text
 * and no fact set. A world that starts after 0 stores the body's resources at their start values
 * at that time, since an unset resource regenerates from time 0 (compose.ts current).
 */
export function newWorld(cartridge: Cartridge, context: WorldContextId, seed: RngState): World {
  let ordinal = 0;
  const mint = () => id(context, NIL, ordinal++) as EntityId;
  const [character, body] = [mint() as string as CharacterId, mint()];
  const refs = Object.keys(cartridge.rooms).sort(cmp);
  const roomIds = Object.fromEntries(refs.map((r) => [r, mint()]));
  const details: Record<string, Detail> = {};
  for (const r of refs)
    for (const [key, d] of Object.entries(cartridge.rooms[r].details ?? {}).sort(([a], [b]) =>
      cmp(a, b),
    ))
      details[mint()] = { ...d, room: roomIds[r], key };
  const { entities, entityIds, containers, capacities } = place(cartridge, roomIds, mint);
  containers[body] = roomIds[refString(cartridge.entry)];
  const clock = cartridge.calendar?.start ?? 0;
  const jobs = firstJobs(cartridge, clock, mint);
  const resources = clock ? started(cartridge, body, clock) : {};
  return {
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
    factDefaults: byRef(cartridge, 'fact', cartridge.facts, (f) => f.value_type.default),
    resourceSpecs: byRef(cartridge, 'resource', cartridge.resources, (s) => s),
    barrierInitial: byRef(cartridge, 'barrier', cartridge.barriers, (b) => b.initial),
    attributes: byRef(cartridge, 'attribute', cartridge.attributes, (a) => a.start),
    state: { clock, containers, rng: seed, ...written({ jobs, resources }) },
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
    ...sorted(cartridge.npcs).map(([r, d]): [string, Entity] => [r, { ...d, kind: 'npc' }]),
    ...sorted(cartridge.items).map(([r, d]): [string, Entity] => [r, { ...d, kind: 'item' }]),
  ];
  const entityIds = Object.fromEntries(defs.map(([r]) => [r, mint()]));
  const ids = { ...roomIds, ...entityIds };
  const containers: Record<string, EntityId> = {};
  for (const [r, e] of defs) {
    const l = e.kind === 'item' ? e.location : { in: 'room' as const, room: e.room };
    containers[entityIds[r]] =
      ids[refString(l.in === 'room' ? l.room : l.in === 'npc' ? l.npc : l.item)];
  }
  return {
    entities: Object.fromEntries(defs.map(([r, e]) => [entityIds[r], e])),
    entityIds,
    containers,
    capacities: Object.fromEntries(
      defs.flatMap(([r, e]) => (e.capacity === undefined ? [] : [[entityIds[r], e.capacity]])),
    ),
  };
}

// The body's resources stored at their start values at `clock` (resource.schema.json ResourceSpec
// start: a new body's value), by canonical resource target text.
function started(cartridge: Cartridge, body: EntityId, clock: number) {
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  return Object.fromEntries(
    Object.values(cartridge.resources ?? {}).map((s) => {
      const resource = { cartridge_id, cartridge_version, kind: 'resource', key: s.key };
      return [key({ kind: 'resource', resource, entity_id: body }), { value: s.start, at: clock }];
    }),
  );
}

// The sections that have rows: a world that writes none keeps its earlier state hash.
const written = (sections: Record<string, object>) =>
  Object.fromEntries(Object.entries(sections).filter(([, rows]) => Object.keys(rows).length));
