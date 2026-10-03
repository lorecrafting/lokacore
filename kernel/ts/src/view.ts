// The player's GameView (04 §14; 00 §4.10), read from a World.
import type {
  AdvertisedAction,
  BandTable,
  EntityId,
  EntityView,
  ExitView,
  GameView,
  Key,
  QuestView,
  ResourceView,
  TextKey,
} from './contracts.gen.ts';
import { lists } from './action_lists.ts';
import { barrierState, COMPASS, exitOf, refString, type QuestRow, type World } from './decision.ts';
import { choiceView } from './dialogue.ts';
import { level, resourceRef } from './resource.ts';
import * as description_variant from './rules/description_variant.ts';
import * as movement from './rules/movement.ts';
import { cmp } from './validate.ts';

/**
 * The player's GameView of the current place (04 §14; 00 §4.10): its description the variant
 * the player sees (description_variant.describe), exits in compass order (unavailable while
 * movement refuses them: exit_closed or exit_locked through a closed or locked barrier,
 * movement.passage, else insufficient_resource while the body cannot pay a move, movement.fare),
 * each with its barrier's door (short name, state and the door verbs step accepts there now,
 * action_lists.ts door), also when passable, and, unless its barrier bars the way, what is seen
 * through it (movement.sight; 04 §15 as amended by c1-doors), the place's actions without the door verbs,
 * the NPCs and items in the room and the items the player's body holds (03 §23), each named by
 * its short description with its actions (action_lists.ts lists: an item here by the room_contents
 * scope, an NPC by room_occupants, a held item by inventory; a talk only on its speaker), NPCs
 * first, then in DefinitionRefString order; and the journal, each quest the player has an instance of with its
 * state and title (04 §15 quest journal state), in DefinitionRefString order; and the player's
 * pending choice, if any (dialogue.ts choiceView); and the body's resources with their bands (04 §15
 * as amended), absent when the cartridge has none.
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
        actions: actions.of(holder === world.body ? 'inventory' : scope[e.kind], id),
      }));
  const room = world.rooms[here];
  const text = (key: TextKey) => ({ key });
  const description = text(description_variant.describe(world, world.character, room));
  const choice = choiceView(world, world.character);
  const pools = resources(world);
  return {
    actor_id: world.character,
    place: { id: here, title: text(room.title), description },
    exits: exits(world, actions.door),
    actions: actions.place,
    entities: within(here),
    inventory: within(world.body),
    journal: journal(world),
    time: world.state.clock,
    ...(choice && { choice }),
    ...(pools.length > 0 && { resources: pools }),
  };
}

// The exits of the body's room in compass order (movement.sight's): each unavailable with the
// code movement would refuse it with, with its barrier's door, and with what is seen through it
// unless that barrier bars the way.
function exits(world: World, door: (direction: Key) => AdvertisedAction[]): ExitView[] {
  const room = world.rooms[world.state.containers[world.body]];
  const tired = !movement.fare(world, world.body); // the move's cost, as movement admits it
  return movement.sight(world, world.body).map((seen) => {
    const { direction } = seen;
    const barrier = exitOf(room, direction)!.barrier;
    const shown = {
      direction,
      ...(barrier && {
        door: {
          name: world.cartridge.barriers![refString(barrier)].short,
          state: barrierState(world, barrier),
          actions: door(direction),
        },
      }),
      ...(seen.entities && {
        sight: {
          room: seen.room!,
          title: world.rooms[seen.room!].title,
          entities: seen.entities.map((id) => {
            const { short: name, kind } = world.entities[id];
            return { id, name, kind: kind as Key };
          }),
        },
      }),
    };
    const code = movement.passage(world, room, direction) ?? (tired && 'insufficient_resource');
    return code ? { available: false, ...shown, reason: { code } } : { available: true, ...shown };
  });
}

function journal(world: World): QuestView[] {
  const title = (q: QuestRow) => world.cartridge.quests![refString(q.quest)].title;
  return Object.values(world.state.quests ?? {})
    .filter(({ scope: s }) => s.kind === 'player' && s.character_id === world.character)
    .map((q) => ({ quest: q.quest, state: q.state, title: title(q) }))
    .sort((a, b) => cmp(refString(a.quest), refString(b.quest)));
}

// The engine default condition bands of 04 §15 (amendments 2026-10-01, 2026-10-02), highest
// cut first, with their tones; a pool's own bands, else the cartridge's world.bands, replace it.
const BANDS: BandTable = (
  [
    [100, 'perfect_health', 'normal'],
    [90, 'slightly_scratched', 'normal'],
    [80, 'few_bruises', 'normal'],
    [70, 'some_cuts', 'warning'],
    [60, 'several_wounds', 'warning'],
    [50, 'many_nasty_wounds', 'warning'],
    [40, 'bleeding_freely', 'warning'],
    [30, 'covered_in_blood', 'danger'],
    [20, 'leaking_guts', 'danger'],
    [10, 'almost_dead', 'danger'],
    [0, 'dying', 'danger'],
  ] as const
).map(([at_percent, key, tone]) => ({ at_percent, key: key as Key, tone }));

// The body's resources at the clock (resource.ts level), in DefinitionRefString order, each with
// the first band of its table whose cut p reaches, compared in integers (p measured from the
// minimum; maximum = minimum gives the top row; 32-bit ResourceInts keep every product exact).
function resources(world: World): ResourceView[] {
  return Object.values(world.resourceSpecs)
    .map(({ key: k, minimum, maximum, bands }) => {
      const resource = resourceRef(world, k);
      const current = level(world, world.body, resource)!;
      const { key: band, tone } = (bands ?? world.cartridge.world?.bands ?? BANDS).find(
        (b) => 100 * (current - minimum) >= b.at_percent * (maximum - minimum),
      )!;
      return { resource, current, maximum, band, tone };
    })
    .sort((a, b) => cmp(refString(a.resource), refString(b.resource)));
}
