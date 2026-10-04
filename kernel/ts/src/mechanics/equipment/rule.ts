// equipment@1 (capability_registry.json; 21 §8 Equipment and 00 §4.4 as amended by c1-equipment):
// wear and remove an item by its id. A worn item is inside the actor's body's holder for its slot
// (a fresh world makes one per declared slot, capacity 1; runtime/fresh.ts), so both are one
// entity.transfer, whose custody, cycle and capacity preconditions foundation/compose.ts re-checks, and no
// event. Checks and codes: mechanics.md equipment@1.
import type { CharacterId, EntityId, ErrorCode } from '../../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  has,
  rejected,
  type Rule,
  values,
  type World,
} from '../../runtime/decision.ts';

/** equipment@1's commands, shared by the GameView and its invariant. */
export const VERBS: readonly string[] = ['wear', 'remove'];

/** True when `at` is one of `body`'s slot holders: what it contains is worn. */
export const wornIn = (world: World, at: EntityId | undefined, body: EntityId | undefined) =>
  values(world.slots).some((h) => h === at && world.state.containers[h] === body);

export const decide: Rule<'equipment'> = (world, command) => {
  const { type, actor_id, item_id } = command.payload;
  const t = transfer(world, actor_id, type, item_id);
  if (typeof t === 'string') return rejected(t);
  const [source_id, destination_id] = t;
  const ops = [
    { op: 'entity.transfer', writer_group: 0, entity_id: item_id, source_id, destination_id },
  ] as const;
  return accepted(world, type === 'wear' ? 'worn' : 'removed', ops, []);
};

/**
 * Why step would refuse `type` (wear or remove) of `item` by `actor` now, else the transfer's
 * source and destination. Read-only, shared with the GameView (view/action_lists.ts).
 */
export function transfer(
  world: World,
  actor: CharacterId,
  type: string,
  item: EntityId,
): ErrorCode | [EntityId, EntityId] {
  const body = bodyOf(world, actor);
  if (!body || !has(world.entities, item)) return 'not_found';
  const e = world.entities[item];
  if (e.kind !== 'item') return 'invalid_target';
  const at = world.state.containers[item];
  const worn = wornIn(world, at, body);
  if (type === 'remove') return worn ? [at, body] : at === body ? 'invalid_state' : 'not_owned';
  if (worn) return 'invalid_state';
  if (at !== body) return 'not_owned';
  const holder = e.slot === undefined ? undefined : world.slots[e.slot];
  if (holder === undefined || world.state.containers[holder] !== body) return 'invalid_target';
  return values(world.state.containers).includes(holder) ? 'invalid_state' : [body, holder];
}
