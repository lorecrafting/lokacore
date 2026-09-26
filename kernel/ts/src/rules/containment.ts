// containment@1 (capability_registry.json): take, drop and give (21 §8 Containment; 03 §23;
// 04 §5.3 conserved transfer). An entity's one container is State.containers; an actor's
// inventory is what its body contains, never stored. Accepted: one entity.transfer, whose
// custody, cycle and capacity preconditions compose.ts checks against the overlay, and one
// event. Ids come from target resolution and are re-validated here: no item (or recipient) by
// that id is not_found; not an item (or, for give, not an NPC) invalid_target; an item that is
// not in the actor's room (take) or a recipient elsewhere not_present; an item the actor does not
// hold (drop, give) not_owned; an item already held (take) or a recipient at its capacity
// invalid_state.
import type { EntityId } from '../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  event,
  has,
  keys,
  rejected,
  type Rule,
  values,
  type World,
} from '../decision.ts';

export const decide: Rule<'containment'> = (world, command, mint) => {
  const p = command.payload;
  const body = bodyOf(world, p.actor_id);
  if (!body || !has(world.entities, p.item_id)) return rejected('not_found');
  if (world.entities[p.item_id].kind !== 'item') return rejected('invalid_target');
  const [here, at] = [world.state.containers[body], world.state.containers[p.item_id]];
  const move = (destination_id: EntityId) =>
    [
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: p.item_id,
        source_id: at,
        destination_id,
      },
    ] as const;
  const acquired = (holder_id: EntityId) => [
    event(world, command, mint, 1, { type: 'item_acquired', item_id: p.item_id, holder_id }),
  ];
  if (p.type === 'take') {
    if (at !== here) return rejected(at === body ? 'invalid_state' : 'not_present');
    return accepted(world, 'taken', move(body), acquired(body));
  }
  if (at !== body) return rejected('not_owned');
  if (p.type === 'drop') {
    const dropped = { type: 'item_dropped', item_id: p.item_id, room_id: here } as const;
    return accepted(world, 'dropped', move(here), [event(world, command, mint, 1, dropped)]);
  }
  const to = p.recipient_id;
  if (!has(world.entities, to)) return rejected('not_found');
  if (world.entities[to].kind !== 'npc') return rejected('invalid_target');
  if (world.state.containers[to] !== here) return rejected('not_present');
  if (held(world, to) >= (world.capacities[to] ?? Infinity)) return rejected('invalid_state');
  return accepted(world, 'given', move(to), acquired(to));
};

// ponytail: scans every container per call; index contents by holder when worlds grow.
const held = (world: World, holder: string) =>
  values(world.state.containers).filter((c) => c === holder).length;

// Where `id`'s containers lead after one step per container: a room, unless they cycle.
const climb = (world: World, id: string): string =>
  keys(world.state.containers).reduce(
    (at) =>
      has(world.rooms, at) || !has(world.state.containers, at) ? at : world.state.containers[at],
    id,
  );

/** Registered invariants of containment (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  // Every item and NPC has a container, and each container is a room or a contained entity.
  one_container_per_item: (world) =>
    keys(world.entities).every((id) => {
      const c = world.state.containers[id];
      return has(world.rooms, c) || has(world.state.containers, c);
    }),
  // From every contained entity, containers lead to a room within one step per container (so
  // never around a cycle), and no declared capacity is exceeded.
  containment_acyclic: (world) =>
    keys(world.state.containers).every((id) => has(world.rooms, climb(world, id))) &&
    keys(world.capacities).every((id) => held(world, id) <= world.capacities[id]),
};
