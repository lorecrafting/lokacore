import { dark, illuminated } from '../light/shared.ts';
import { darkSight } from '../attributes/shared.ts';
import { living } from '../death/shared.ts';
// movement@1 (capability_registry.json): move through a room's exit (21 §5 Connection; 04 §5).
// A direction outside the compass is invalid_target; a compass direction without an exit here
// is not_found, and one through a closed or locked barrier (barrier@1) exit_closed or exit_locked
// (passage); then, under position@1, an actor not standing is invalid_state (position.ts
// standing). A move costs the body the cartridge's world.movement.cost, else 1 mv where it
// declares the mv pool (resource@1; 00 §4 amendments 2026-09-25, 2026-10-02), and one it cannot
// pay is insufficient_resource ("You are too exhausted."). Accepted: that resource.adjust (none
// without a cost), one entity.transfer of the actor's body and entity_entered_room; no resource
// event. D6's exact authored water edges share movementPlan for entry debit/free Surface.
// Other exits retain the ordinary world fare. scan (00 §4.1) is accepted
// with nothing to change, no RNG and no event, like look; the host shows sight().
import {
  accepted,
  COMPASS,
  has,
  keys,
  refString,
  type Rule,
  type World,
  type Steps,
  values,
} from '../../runtime/decision.ts';
import type { DefinitionRef, EntityId } from '../../contracts.gen.ts';
import { exitTo } from '../lookups.ts';
import { moveSequence } from './sequence.ts';
import { passage } from './shared.ts';
export { passage, fare } from './shared.ts';

export const decide: Rule<'movement'> = (world, command, mint, steps = { n: 0 }) =>
  command.payload.type === 'scan'
    ? accepted(world, 'scanned', [], [])
    : moveSequence(world, { ...command, payload: command.payload }, mint, 'moved', steps);

/**
 * What `body` sees through each exit of its room, in compass order (00 §4.1 scan): the passage
 * code of an exit whose barrier bars the way, else the destination room and the NPCs and
 * items directly in it, NPCs first, then in DefinitionRefString order (as the GameView lists
 * them). Read-only. ponytail: sight passes exactly where a move would (passage); perception
 * policies, darkness and far scan from view rooms join with map discovery.
 */
export function sight(world: World, body: EntityId, steps: Steps = { n: 0 }) {
  const room = world.rooms[world.state.containers[body]];
  return COMPASS.filter((d) => has(room.exits, d)).map((direction) => {
    const barred = passage(world, room, direction);
    if (barred) return { direction, code: barred };
    if (dark(world, world.character, steps)) return { direction };
    const there = world.roomIds[refString(exitTo(room, direction)!)];
    if (
      world.rooms[there].dark_description &&
      !darkSight(world, world.character) &&
      !illuminated(world, world.character, steps)
    )
      return { direction };
    const at = (id: string): id is EntityId =>
      world.state.containers[id] === there && living(world, id);
    return { direction, room: there, entities: keys(world.entities).filter(at) };
  });
}

/** Registered invariants of movement (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  player_in_one_room: (world) => has(world.rooms, world.state.containers[world.body]),
  exits_resolve: (world) =>
    values(world.rooms).every((room) =>
      values<{ to: DefinitionRef }>(room.exits).every((exit) =>
        has(world.roomIds, refString(exit.to)),
      ),
    ),
};
