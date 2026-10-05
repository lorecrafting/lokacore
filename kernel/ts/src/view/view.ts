import { visible, fuelView } from '../mechanics/light/shared.ts';
import { noticeViews } from './notice_boards.ts';
import { engaged } from '../mechanics/combat/shared.ts';
import { living } from '../mechanics/death/shared.ts';
// The player's GameView (04 §14; 00 §4.10), read from a World.
import type {
  AdvertisedAction,
  BandTable,
  ContentView,
  ChapterView,
  EntityId,
  EntityView,
  ExitView,
  GameView,
  Key,
  QuestView,
  ResourceView,
  SlotKey,
  TextKey,
} from '../contracts.gen.ts';
import { lists } from './action_lists.ts';
import { refusal, resolved } from '../commands/actions.ts';
import { COMPASS, refString, type Entity, type World } from '../runtime/decision.ts';
import { barrierState, exitOf, opened, questOf } from '../mechanics/lookups.ts';
import { choiceView, definition } from '../mechanics/dialogue/shared.ts';
import { level, resourceRef } from '../mechanics/resource.ts';
import * as description_variant from '../mechanics/description_variant/rule.ts';
import * as movement from '../mechanics/movement/rule.ts';
import * as scene from '../mechanics/scene/shared.ts';
import * as position from '../mechanics/position/shared.ts';
import { holds } from '../mechanics/policy.ts';
import { value } from '../mechanics/fact.ts';
import { holdsNow } from '../mechanics/quest/lifecycle.ts';
import { cmp } from '../foundation/validate.ts';
import { shelf } from '../mechanics/commerce/shared.ts';
import { status as calendarStatus } from '../mechanics/calendar.ts';

/**
 * The player's GameView of the current place (04 §14; 00 §4.10): its description the variant
 * the player sees (description_variant.describe), exits in compass order (unavailable while
 * admission refuses them: unsupported_capability without a matching composed action or
 * invalid_state when its policy fails; then exit_closed or exit_locked through a closed or locked barrier,
 * movement.passage, else invalid_state while the player is not standing, position.standing, else
 * insufficient_resource while the body cannot pay a move, movement.fare),
 * each with its barrier's door (short name, state and the door verbs step accepts there now,
 * view/action_lists.ts door), also when passable, and, unless its barrier bars the way, what is seen
 * through it (movement.sight; 04 §15 as amended by c1-doors), the place's actions without the door verbs,
 * the NPCs and items in the room and the items the player's body holds (03 §23), each named by
 * its short description with its actions (view/action_lists.ts lists: an item here by the room_contents
 * scope, an NPC by room_occupants, a held item by inventory; a talk only on its speaker), NPCs
 * first, then in DefinitionRefString order, an item with its lid's state and what is in reach
 * inside it (within; c1-locks); and the journal, each quest the player has an instance of with its
 * state, title and optional selected journal text (04 §15 quest journal state), in
 * DefinitionRefString order; and the player's
 * pending choice, if any (mechanics/dialogue/shared.ts choiceView); and the body's resources with their bands (04 §15
 * as amended), absent when the cartridge has none; and the player's position (position@1), absent
 * without it; and the highest reached chapter marker, absent without chapter declarations.
 */
// size: allow 45, current snapshot composes optional notice metadata with existing projections
export function gameView(world: World): GameView {
  const fight = engaged(world, world.body);
  const here = world.state.containers[world.body];
  const actions = lists(world, world.character);
  const equipment = Object.entries(world.slots).map(([slot, holder]) => {
    const [item] = within(world, actions, holder, actions.worn);
    return { slot: slot as SlotKey, ...(item && { item }) };
  });
  const room = world.rooms[here];
  const text = (key: TextKey) => ({ key });
  const description = text(description_variant.describe(world, world.character, room));
  const choice = fight ? undefined : choiceView(world, world.character);
  const pools = resources(world);
  const current = chapter(world);
  const showing = scene.running(world, world.character);
  const at = position.positionOf(world, world.character) as Key | undefined;
  const calendar_status = calendarStatus(world.cartridge, world.state.clock);
  return {
    actor_id: world.character,
    ...(fight && {
      combat: {
        encounter_id: fight.id,
        opponent_id: fight.row.npc_id,
        name: world.entities[fight.row.npc_id].short,
      },
    }),
    place: { id: here, title: text(room.title), description },
    exits: exits(world, actions.door),
    actions: actions.place,
    ...noticeViews(world, here, actions.notice),
    entities: within(world, actions, here),
    inventory: within(world, actions, world.body),
    ...(equipment.length > 0 && { equipment }),
    ...(at !== undefined && { position: at }),
    journal: journal(world),
    ...(current && { chapter: current }),
    ...(showing && { scene: showing }),
    time: world.state.clock,
    ...(calendar_status && { calendar_status }),
    ...(choice && { choice }),
    ...(pools.length > 0 && { resources: pools }),
  };
}

// The entities directly in `holder` (the room, the body or a slot holder), each with its short
// name, kind and actions (`worn`, else by scope: an item here by room_contents, an NPC by
// room_occupants, a held item by inventory); an item also with its barrier's state and, unless
// worn, its contents (c1-locks).
function within(
  world: World,
  actions: Lists,
  holder: EntityId,
  worn?: (id: string) => AdvertisedAction[],
): EntityView[] {
  return Object.entries(world.entities)
    .filter(
      ([id]) =>
        world.state.containers[id] === holder &&
        living(world, id) &&
        visible(world, world.character, id),
    )
    .map(([id, e]) => {
      const scope = holder === world.body ? 'inventory' : SCOPE[e.kind];
      const contents = e.kind === 'item' && !worn ? inside(world, actions, id, scope) : [];
      return {
        ...viewOf(world, id, e, worn ? worn(id) : actions.of(scope, id)),
        ...(contents.length > 0 && { contents }),
      };
    });
}

const SCOPE = { item: 'room_contents', npc: 'room_occupants' } as const;

// What item `box` holds in reach (every container from the item up to `box` opened, `box` too),
// at any depth, in DefinitionRefString order, each with its direct container and only take and
// its container verbs (ContentView; c1-locks).
function inside(world: World, actions: Lists, box: string, scope: string): ContentView[] {
  const under = (id: string) => {
    for (
      let c = world.state.containers[id];
      opened(world, c, world.body);
      c = world.state.containers[c]
    )
      if (c === box) return true;
    return false;
  };
  return Object.entries(world.entities)
    .filter(([id]) => under(id))
    .map(([id, e]) => ({
      ...viewOf(world, id, e, actions.of(scope, id, true)),
      container_id: world.state.containers[id],
    }));
}

// An entity as the view names it, with its barrier's state if it has one.
const viewOf = (world: World, id: string, e: Entity, actions: AdvertisedAction[]) => ({
  id: id as EntityId,
  name: e.short,
  description: e.description,
  kind: e.kind as Key,
  ...(e.kind === 'item' && e.barrier && { state: barrierState(world, e.barrier) }),
  actions,
  ...(fuelView(world, id) && { fuel: fuelView(world, id) }),
  ...(e.kind === 'npc' && e.shop && { shop: shelf(world, id as EntityId) }),
});

type Lists = ReturnType<typeof lists>;

// The exits of the body's room in compass order (movement.sight's): each unavailable with the
// code movement would refuse it with, with its barrier's door, and with what is seen through it
// unless that barrier bars the way.
function exits(world: World, door: (direction: Key) => AdvertisedAction[]): ExitView[] {
  const actor_id = world.character;
  const room = world.rooms[world.state.containers[world.body]];
  const set = resolved(world, actor_id);
  const tired = !movement.fare(world, world.body); // the move's cost, as movement admits it
  const seated = !!engaged(world, world.body) || !position.standing(world, world.character); // position@1, after the barrier
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
    const code =
      refusal(world, { type: 'move', actor_id, direction }, { n: 0 }, undefined, set) ??
      movement.passage(world, room, direction) ??
      (seated ? 'invalid_state' : tired && 'insufficient_resource');
    return code ? { available: false, ...shown, reason: { code } } : { available: true, ...shown };
  });
}

function chapter(world: World): ChapterView | undefined {
  const chapters = world.cartridge.chapters;
  if (!chapters) return;
  let index = 0;
  for (let i = 1; i < chapters.length; i++) {
    const c = chapters[i]!;
    const outcomes = world.cartridge.story_points![refString(c.story_point!)].outcomes;
    const counted = c.outcome
      ? [[c.outcome, outcomes[c.outcome]!] as const]
      : Object.entries(outcomes);
    if (
      counted.some(([outcome, t]) => {
        if ('scene' in t) {
          const marker = {
            ...c.story_point!,
            kind: 'fact' as const,
            key: `story_point_${c.story_point!.key}` as Key,
          };
          return value(world, world.character, marker) === outcome;
        }
        const d = definition(world, t.dialogue);
        const q = questOf(world, world.character, d.quest!)?.[1];
        return q?.state === 'resolved' && q.outcome === t.choice;
      })
    )
      index = i;
  }
  return { index, title: chapters[index]!.title };
}

function journal(world: World): QuestView[] {
  return Object.values(world.state.quests ?? {})
    .filter(({ scope: s }) => s.kind === 'player' && s.character_id === world.character)
    .map((q) => {
      const d = world.cartridge.quests![refString(q.quest)];
      const shown = { quest: q.quest, state: q.state, title: d.title };
      const j = d.journal;
      if (!j) return shown;
      const variant =
        q.state === 'active'
          ? j.active_variants?.find((v) => holds(world, world.character, v.when.root))?.text
          : undefined;
      const journal =
        q.state === 'active'
          ? (variant ??
            (holdsNow(world, world.character, q.quest, { n: 0 }) ? j.objectives_met : j.active))
          : q.state === 'objectives_complete'
            ? j.objectives_met
            : ((q.outcome && j.outcomes?.[q.outcome]) ?? j[q.state]);
      return { ...shown, journal };
    })
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

// The body's resources at the clock (mechanics/resource.ts level), in DefinitionRefString order, each with
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
