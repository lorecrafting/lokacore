// The player's GameView (04 §14; 00 §4.10), read from a World.
import type { EntityId, EntityView, GameView, Key, TextKey } from './contracts.gen.ts';
import { lists } from './actions.ts';
import { COMPASS, type World } from './decision.ts';
import * as description_variant from './rules/description_variant.ts';
import * as movement from './rules/movement.ts';

/**
 * The player's GameView of the current place (04 §14; 00 §4.10): its description the variant
 * the player sees (description_variant.describe), exits in compass order (unavailable while
 * movement refuses them: exit_closed or exit_locked through a closed or locked barrier,
 * movement.passage, else insufficient_resource while the body cannot pay a move, movement.fare), the place's actions,
 * the NPCs and items in the room and the items the player's body holds (03 §23), each named by
 * its short description with its actions (actions.ts lists: an item here by the room_contents
 * scope, an NPC by room_occupants, a held item by inventory), NPCs first, then in
 * DefinitionRefString order.
 */
export function gameView(world: World): GameView {
  const here = world.state.containers[world.body];
  const actions = lists(world, world.character);
  const scope = { item: 'room_contents', npc: 'room_occupants' } as const;
  const within = (holder: EntityId): EntityView[] =>
    Object.entries(world.entities)
      .filter(([id]) => world.state.containers[id] === holder)
      .map(([id, e]) => ({
        id: id as EntityId,
        name: e.short,
        kind: e.kind as Key,
        actions: actions.of(holder === world.body ? 'inventory' : scope[e.kind]),
      }));
  const room = world.rooms[here];
  const tired = !movement.fare(world, world.body); // the move's cost, as movement admits it
  const text = (key: TextKey) => ({ key });
  const description = text(description_variant.describe(world, world.character, room));
  return {
    actor_id: world.character,
    place: { id: here, title: text(room.title), description },
    exits: COMPASS.filter((d) => Object.hasOwn(room.exits, d)).map((direction) => {
      const code = movement.passage(world, room, direction) ?? (tired && 'insufficient_resource');
      return code
        ? { available: false, direction, reason: { code } }
        : { available: true, direction };
    }),
    actions: actions.place,
    entities: within(here),
    inventory: within(world.body),
    journal: [],
    time: world.state.clock,
  };
}
