import { decideHarvest } from './harvest.ts';
import { living } from '../death/shared.ts';
// containment@1 (capability_registry.json): take, drop and give (21 §8 Containment; 03 §23;
// 04 §5.3 conserved transfer). An entity's one container is State.containers; an actor's
// inventory is what its body contains, never stored. Accepted: one entity.transfer, whose
// custody, cycle and capacity preconditions foundation/compose.ts checks against the overlay, and one
// event. Ids come from target resolution and are re-validated here: no item (or recipient) by
// that id is not_found; not an item (or, for give, not an NPC) invalid_target; an item that is
// out of the actor's reach (take; mechanics/lookups.ts reach, c1-locks custody) or a recipient elsewhere not_present;
// an item the actor does not hold (drop, give) not_owned; an item already held (take) or a
// recipient at its capacity invalid_state.
import type { EntityId } from '../../contracts.gen.ts';
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
} from '../../runtime/decision.ts';
import { check } from '../../runtime/invariants.ts';
import { reach } from '../lookups.ts';
import { carrying, giveRefused, putRefused } from './shared.ts';
import { movable } from '../../runtime/created.ts';

// size: allow 52, finite Harvest joins the existing conserved-transfer decision
export const decide: Rule<'containment'> = (world, command, mint, steps) => {
  const p = command.payload;
  if (p.type === 'harvest')
    return decideHarvest(world, { ...command, payload: p }, mint, steps ?? { n: 0 });
  const body = bodyOf(world, p.actor_id);
  if (!body || !has(world.entities, p.item_id)) return rejected('not_found');
  if (!movable(world, p.item_id) || world.entities[p.item_id].kind !== 'item')
    return rejected('invalid_target');
  const [here, at] = [world.state.containers[body], world.state.containers[p.item_id]];
  const move = (destination_id: EntityId) => [
    {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: p.item_id,
      source_id: at,
      destination_id,
    } as const,
  ];
  const acquired = (holder_id: EntityId) => [
    event(world, command, mint, 1, { type: 'item_acquired', item_id: p.item_id, holder_id }),
  ];
  if (p.type === 'take') {
    if (at === body) return rejected('invalid_state');
    const reached = reach(world, body, p.item_id, steps);
    if (typeof reached === 'string') return { kind: 'fault', code: reached };
    if (!reached) return rejected('not_present');
    const code = carrying(world, body, steps)(p.item_id);
    if (code) return code === 'too_heavy' ? rejected(code) : { kind: 'fault', code };
    return accepted(world, 'taken', move(body), acquired(body));
  }
  if (p.type === 'put') {
    const code = putRefused(world, body, p.item_id, p.container_id, steps ?? { n: 0 });
    if (code)
      return code === 'budget_exceeded' || code === 'containment_cycle'
        ? { kind: 'fault', code }
        : rejected(code);
    return accepted(world, 'put', move(p.container_id), acquired(p.container_id));
  }
  if (at !== body) return rejected('not_owned');
  if (p.type === 'drop') {
    const dropped = { type: 'item_dropped', item_id: p.item_id, room_id: here } as const;
    return accepted(world, 'dropped', move(here), [event(world, command, mint, 1, dropped)]);
  }
  const code = giveRefused(world, p.item_id, steps) ?? recipient(world, p.recipient_id, here);
  if (code)
    return code === 'budget_exceeded' ||
      code === 'containment_cycle' ||
      code === 'precondition_failed'
      ? { kind: 'fault', code }
      : rejected(code);
  return accepted(world, 'given', move(p.recipient_id), acquired(p.recipient_id));
};

// ponytail: scans every container per call; index contents by holder when worlds grow.
const held = (world: World, holder: string) =>
  values(world.state.containers).filter((c) => c === holder).length;

/** Registered invariants of containment (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  // Every item and NPC has a container, and each container is a room or a contained entity.
  one_container_per_item: (world) =>
    keys(world.entities).every((id) => {
      const c = world.state.containers[id];
      return (
        has(world.rooms, c) ||
        has(world.state.containers, c) ||
        (c === world.consumed && world.entities[id].kind === 'item' && !!world.entities[id].edible)
      );
    }),
  // Every container is a room or a contained entity, so with no cycle (the linear observation
  // check, which also holds each declared capacity) every chain of containers ends at a room.
  containment_acyclic: (world) =>
    keys(world.state.containers).every((id) => {
      const c = world.state.containers[id];
      const e = world.entities[id];
      return (
        id !== world.consumed &&
        (has(world.rooms, c) ||
          has(world.state.containers, c) ||
          (c === world.consumed && e?.kind === 'item' && !!e.edible))
      );
    }) &&
    check('containment_acyclic', {
      state: { containers: world.state.containers, capacities: world.capacities },
      result: { changes: [] },
    }),
};

function recipient(world: World, id: EntityId, here: EntityId) {
  if (!has(world.entities, id) || !living(world, id)) return 'not_found' as const;
  if (world.entities[id].kind !== 'npc') return 'invalid_target' as const;
  if (world.state.containers[id] !== here) return 'not_present' as const;
  if (held(world, id) >= (world.capacities[id] ?? Infinity)) return 'invalid_state' as const;
  return undefined;
}
