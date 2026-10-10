import { knowledgeView } from './knowledge.ts';
import { movementPlan } from '../mechanics/movement/sequence.ts';
import { edge } from '../mechanics/water/shared.ts';
import { waterViews } from './water.ts';
import { chapter, journal } from './quest_journal.ts';
import { lore } from '../mechanics/topics/shared.ts';
import { services } from './services.ts';
import { liquidView } from './liquid.ts';
import { resources } from './resources.ts';
import { KernelError } from '../foundation/error.ts';
import { LIMITS } from '../contracts.gen.ts';
import { visible, fuelView } from '../mechanics/light/shared.ts';
import { skillViews, freeLessons } from './skills.ts';
import { noticeViews } from './notice_boards.ts';
import { engaged } from '../mechanics/combat/shared.ts';
import { living } from '../mechanics/death/shared.ts';
// The player's GameView (04 §14; 00 §4.10), read from a World.
import type {
  AdvertisedAction,
  ContentView,
  EntityId,
  EntityView,
  ExitView,
  GameView,
  Key,
  SlotKey,
  TextKey,
} from '../contracts.gen.ts';
import { lists } from './action_lists.ts';
import { refusal, resolved } from '../commands/actions.ts';
import { COMPASS, refString, type Entity, type Steps, type World } from '../runtime/decision.ts';
import { barrierState, exitOf, opened } from '../mechanics/lookups.ts';
import { choiceView } from '../mechanics/dialogue/shared.ts';
import { describe, describeEntity } from '../mechanics/description_variant/rule.ts';
import * as movement from '../mechanics/movement/rule.ts';
import * as scene from '../mechanics/scene/shared.ts';
import * as position from '../mechanics/position/shared.ts';
import { shelf } from '../mechanics/commerce/shared.ts';
import { status as calendarStatus } from '../mechanics/calendar.ts';
import { carrying } from '../mechanics/crow/behavior.ts';
import { currentBleed } from '../mechanics/bleed/shared.ts';
import { activeStatuses } from '../mechanics/status/shared.ts';

/**
 * The player's GameView of the current place (04 §14; 00 §4.10): its description the variant
 * the player sees (description_variant's describe), exits in compass order (unavailable while
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
// size: allow 49, one projection lists every GameView section, conditions included
export function gameView(world: World): GameView {
  const fight = engaged(world, world.body);
  const here = world.state.containers[world.body];
  const steps = { n: 0 };
  const actions = lists(world, world.character, steps);
  const equipment = equipmentViews(world, actions, steps);
  const choice = fight ? undefined : choiceView(world, world.character, steps);
  const pools = resources(world);
  const current = chapter(world);
  const showing = scene.running(world, world.character);
  const at = position.positionOf(world, world.character) as Key | undefined;
  const calendar_status = calendarStatus(world.cartridge, world.context, world.state.clock);
  const bleed = currentBleed(world, world.body);
  const conditions = activeStatuses(world, world.body).map(({ spec, row }) => ({
    label: spec.label,
    ends_at: row.ends_at,
    next_tick_at: row.next_tick_at,
    resource: spec.resource.key as Key,
    ...(spec.per_tick !== undefined && { per_tick: spec.per_tick }),
    tick_every: spec.tick_every,
  }));
  const view: GameView = {
    actor_id: world.character,
    ...knowledgeView(world, steps),
    ...waterViews(world, steps),
    ...skillViews(world, steps),
    ...(world.cartridge.topics && lore(world, world.character)),
    ...(fight && { combat: combatView(world, fight) }),
    ...(bleed && { bleeding: bleedingView(world, bleed) }),
    ...(conditions.length > 0 && { conditions }),
    place: placeView(world, here, steps),
    exits: exits(world, actions.door, steps),
    actions: actions.place,
    ...noticeViews(world, here, actions.notice, steps),
    entities: within(world, actions, here, undefined, steps),
    inventory: within(world, actions, world.body, undefined, steps),
    ...(equipment.length > 0 && { equipment }),
    ...(at !== undefined && { position: at }),
    journal: journal(world, steps),
    ...(current && { chapter: current }),
    ...(showing && { scene: showing }),
    time: world.state.clock,
    ...(calendar_status && { calendar_status }),
    ...(choice && { choice }),
    ...(pools.length > 0 && { resources: pools }),
  };
  if (steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
  return view;
}

function placeView(world: World, here: EntityId, steps: Steps) {
  const room = world.rooms[here];
  const text = (key: TextKey) => ({ key });
  return {
    id: here,
    title: text(room.title),
    description: text(describe(world, world.character, room, steps)),
  };
}

function bleedingView(world: World, bleed: NonNullable<ReturnType<typeof currentBleed>>) {
  const spec = world.cartridge.bleeds![refString(bleed.effect!)];
  return {
    label: 'condition.bleeding' as TextKey,
    generation: bleed.generation,
    ends_at: bleed.ends_at!,
    next_tick_at: bleed.next_tick_at!,
    hp_loss: spec.hp_loss,
    tick_every: spec.tick_every,
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
  steps: Steps = { n: 0 },
): EntityView[] {
  return Object.entries(world.entities)
    .filter(
      ([id]) =>
        world.state.containers[id] === holder &&
        living(world, id) &&
        visible(world, world.character, id, steps),
    )
    .map(([id, e]) => {
      const scope = holder === world.body ? 'inventory' : SCOPE[e.kind];
      const contents = e.kind === 'item' && !worn ? inside(world, actions, id, scope, steps) : [];
      return {
        ...viewOf(world, id, e, worn ? worn(id) : actions.of(scope, id), steps),
        ...(contents.length > 0 && { contents }),
      };
    });
}

const SCOPE = { item: 'room_contents', npc: 'room_occupants' } as const;

// What item `box` holds in reach (every container from the item up to `box` opened, `box` too),
// at any depth, in DefinitionRefString order, each with its direct container and only take and
// its container verbs (ContentView; c1-locks).
function inside(
  world: World,
  actions: Lists,
  box: string,
  scope: string,
  steps: Steps,
): ContentView[] {
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
    .filter(([id]) => under(id) && visible(world, world.character, id, steps))
    .map(([id, e]) => ({
      ...viewOf(world, id, e, actions.of(scope, id, true), steps),
      container_id: world.state.containers[id],
    }));
}

// An entity as the view names it, with its barrier's state if it has one.
const viewOf = (
  world: World,
  id: string,
  e: Entity,
  actions: AdvertisedAction[],
  steps: Steps,
) => ({
  id: id as EntityId,
  name: describeEntity(world, world.character, id as EntityId, 'short', steps),
  description: describeEntity(world, world.character, id as EntityId, 'description', steps),
  kind: e.kind as Key,
  ...(e.kind === 'item' && e.slot && { slot: e.slot }),
  ...(e.kind === 'item' &&
    e.weapon && {
      weapon: e.weapon,
      skill_label: world.cartridge.skills![refString(e.weapon.skill)].label,
      skill_requirement: world.cartridge.skills![refString(e.weapon.skill)].requirement,
    }),
  ...(e.kind === 'item' && e.block_chance !== undefined && { block_chance: e.block_chance }),
  ...(e.kind === 'item' && e.barrier && { state: barrierState(world, e.barrier) }),
  actions,
  ...liquidView(world, id),
  ...(e.kind === 'npc' && freeLessons(world, id)),
  ...(e.kind === 'npc' && e.services && { services: services(world, id as EntityId, steps) }),
  ...(fuelView(world, id) && { fuel: fuelView(world, id) }),
  ...(e.kind === 'npc' && e.shop && { shop: shelf(world, id as EntityId) }),
  ...(e.kind === 'npc' &&
    carrying(world, id as EntityId) && { carrying: carrying(world, id as EntityId) }),
});

type Lists = ReturnType<typeof lists>;

// The exits of the body's room in compass order (movement.sight's): each unavailable with the
// code movement would refuse it with, with its barrier's door, and with what is seen through it
// unless that barrier bars the way.
function exits(
  world: World,
  door: (direction: Key) => AdvertisedAction[],
  steps: Steps,
): ExitView[] {
  const actor_id = world.character;
  const room = world.rooms[world.state.containers[world.body]];
  const set = resolved(world, actor_id);
  return movement.sight(world, world.body, steps).map(({ direction, ...seen }) => {
    const barrier = exitOf(room, direction)!.barrier;
    const destination = world.roomIds[refString(exitOf(room, direction)!.to)];
    const wet = edge(world, world.state.containers[world.body], destination, direction);
    const shown = {
      direction,
      ...(wet?.entering && { warning: world.cartridge.world!.water!.warning }),
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
    const command = { type: 'move', actor_id, direction } as const;
    const refused = refusal(world, command, steps, 'move' as Key, set);
    const plan = refused ? undefined : movementPlan(world, actor_id, direction, steps);
    const code = refused ?? (typeof plan === 'string' ? plan : undefined);
    return code ? { available: false, ...shown, reason: { code } } : { available: true, ...shown };
  });
}

// One entry per place in a holder: the finger holder lists two (toolbox row 3).
function equipmentViews(world: World, actions: Lists, steps: Steps) {
  return Object.entries(world.slots).flatMap(([slot, holder]) => {
    const items = within(world, actions, holder, actions.worn, steps);
    return Array.from({ length: world.capacities[holder] }, (_, i) => ({
      slot: slot as SlotKey,
      ...(items[i] && { item: items[i] }),
    }));
  });
}

function combatView(world: World, fight: NonNullable<ReturnType<typeof engaged>>) {
  return {
    encounter_id: fight.id,
    opponent_id: fight.row.npc_id,
    name: world.entities[fight.row.npc_id].short,
    ...(fight.row.active_ids && {
      active_opponents: fight.row.active_ids.map((id) => ({
        id,
        name: world.entities[id].short,
      })),
    }),
  };
}
