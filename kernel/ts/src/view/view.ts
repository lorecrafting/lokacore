// size: allow 315, row 33 lists an NPC's lock-admitted holdings beside container contents; word bar S2; the Book hostile refusal (loka-x6t.33)
import { wordViews } from './spells.ts';
import { knowledgeView } from './knowledge.ts';
import { movementPlan } from '../mechanics/movement/sequence.ts';
import { edge } from '../mechanics/water/shared.ts';
import { waterViews } from './water.ts';
import { chapter, journal } from './quest_journal.ts';
import { lore } from '../mechanics/topics/shared.ts';
import { services } from './services.ts';
import { liquidView } from './liquid.ts';
import { conditionViews, resources } from './resources.ts';
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
  CharacterId,
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
import { bodyOf, refString, type Entity, type Steps, type World } from '../runtime/decision.ts';
import { barrierState, exitOf, opened } from '../mechanics/lookups.ts';
import { choiceView } from '../mechanics/dialogue/shared.ts';
import { asides, describe, describeEntity } from '../mechanics/description_variant/rule.ts';
import * as movement from '../mechanics/movement/rule.ts';
import { cueViews } from '../mechanics/senses.ts';
import { holds } from '../mechanics/policy.ts';
import { disposition } from '../mechanics/disposition.ts';
import { lockRefused } from '../mechanics/locks.ts';
import * as scene from '../mechanics/scene/shared.ts';
import * as position from '../mechanics/position/shared.ts';
import { shelf } from '../mechanics/commerce/shared.ts';
import { timeView } from './time.ts';
import { carrying } from '../mechanics/crow/behavior.ts';
import { currentBleed } from '../mechanics/bleed/shared.ts';

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
// size: allow 43, the viewer's body is derived once for every projection (loka-kgd.150.5); row FD3 storylet; word bar S2
export function gameView(world: World, actor: CharacterId = world.character): GameView {
  const body = bodyOf(world, actor);
  const fight = body ? engaged(world, body) : undefined;
  const here = body ? world.state.containers[body] : undefined;
  const steps = { n: 0 };
  const actions = lists(world, actor, steps);
  const equipment = equipmentViews(world, actor, actions, steps);
  const choice = fight ? undefined : choiceView(world, actor, steps);
  const pools = resources(world, body);
  const current = chapter(world, actor);
  const showing = scene.running(world, actor);
  const at = position.positionOf(world, actor) as Key | undefined;
  const bleed = body ? currentBleed(world, body) : undefined;
  const view: GameView = {
    actor_id: actor,
    ...knowledgeView(world, actor, steps),
    ...waterViews(world, actor, steps),
    ...skillViews(world, actor, steps),
    ...(world.cartridge.topics && lore(world, actor)),
    ...(fight && { combat: combatView(world, actor, fight, steps) }),
    ...(bleed && { bleeding: bleedingView(world, bleed) }),
    ...conditionViews(world, body),
    ...cueViews(world, actor, body, steps, holds),
    place: placeView(world, actor, here, steps),
    exits: exits(world, actor, actions.door, steps),
    actions: actions.place,
    ...(here && noticeViews(world, actor, here, actions.notice, steps)),
    entities: body && here ? within(world, actor, body, actions, here, undefined, steps) : [],
    inventory: body ? within(world, actor, body, actions, body, undefined, steps) : [],
    ...(equipment.length > 0 && { equipment }),
    ...(at !== undefined && { position: at }),
    journal: journal(world, actor, steps),
    ...(current && { chapter: current }),
    ...(showing && { scene: showing }),
    ...wordViews(world, actor, steps),
    ...(actions.place.some((a) => a.action_key === actions.drawn) && { storylet: actions.drawn }),
    ...timeView(world),
    ...(choice && { choice }),
    ...(pools.length > 0 && { resources: pools }),
  };
  if (steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
  return view;
}

function placeView(world: World, actor: CharacterId, here: EntityId | undefined, steps: Steps) {
  const text = (key: TextKey) => ({ key });
  // A body-less actor (unreachable in the Story) sees no place; the shape stays.
  if (!here)
    return { id: '' as EntityId, title: text('' as TextKey), description: text('' as TextKey) };
  const room = world.rooms[here];
  const lines = asides(world, actor, room, steps);
  return {
    id: here,
    title: text(room.title),
    description: text(describe(world, actor, room, steps)),
    ...(lines.length > 0 && { asides: lines.map(text) }),
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

// The entities directly in `holder` (room, body or slot holder), each with its short name, kind and
// actions (`worn`, else by scope: room_contents, room_occupants or inventory); an item also with its
// barrier's state and, unless worn, its contents (c1-locks); a theft NPC its holdings (row 33).
function within(
  world: World,
  actor: CharacterId,
  body: EntityId,
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
        visible(world, actor, id, steps),
    )
    .map(([id, e]) => {
      const scope = holder === body ? 'inventory' : SCOPE[e.kind];
      // Row 33: an NPC's direct holdings its get lock admits; a vault's locked pool stays private.
      const contents =
        e.kind === 'item' && !worn
          ? inside(world, actor, body, actions, id, scope, steps)
          : e.kind === 'npc' && world.cartridge.world?.theft
            ? inside(world, actor, body, actions, id, 'room_contents', steps, true).filter(
                (c) => !lockRefused(world, actor, e.locks?.get, c.id, steps),
              )
            : [];
      // Row FD10: a present NPC's asides, read with the NPC as the target.
      const lines = e.kind === 'npc' ? asides(world, actor, e, steps, id as EntityId) : [];
      return {
        ...viewOf(world, actor, id, e, worn ? worn(id) : actions.of(scope, id), steps),
        ...(contents.length > 0 && { contents }),
        ...(lines.length > 0 && { asides: lines.map((key) => ({ key })) }),
      };
    });
}

const SCOPE = { item: 'room_contents', npc: 'room_occupants' } as const;

// What item `box` holds in reach (all containers up to `box` opened), at any depth, in ref order,
// each with its container, take and container verbs (ContentView; c1-locks); `direct`: box's own.
function inside(
  world: World,
  actor: CharacterId,
  body: EntityId,
  actions: Lists,
  box: string,
  scope: string,
  steps: Steps,
  direct = false,
): ContentView[] {
  const under = (id: string) => {
    if (direct) return world.state.containers[id] === box;
    for (let c = world.state.containers[id]; opened(world, c, body); c = world.state.containers[c])
      if (c === box) return true;
    return false;
  };
  return Object.entries(world.entities)
    .filter(([id]) => under(id) && visible(world, actor, id, steps))
    .map(([id, e]) => ({
      ...viewOf(world, actor, id, e, actions.of(scope, id, true), steps),
      container_id: world.state.containers[id],
    }));
}

// An entity as the view names it, with its barrier's state if it has one.
const viewOf = (
  world: World,
  actor: CharacterId,
  id: string,
  e: Entity,
  actions: AdvertisedAction[],
  steps: Steps,
) => ({
  id: id as EntityId,
  name: describeEntity(world, actor, id as EntityId, 'short', steps),
  description: describeEntity(world, actor, id as EntityId, 'description', steps),
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
  ...(e.kind === 'npc' && freeLessons(world, id, actor, steps)),
  // Book hostile refusal: the page needs hostility, which refusal codes cannot tell apart.
  ...(e.kind === 'npc' &&
    disposition(world, actor, id as EntityId, steps) === 'hostile' && {
      hostile: true as const,
      ...(e.disposition?.refuse && { refusal: e.disposition.refuse }),
    }),
  ...(e.kind === 'npc' &&
    e.services && { services: services(world, actor, id as EntityId, steps) }),
  ...(fuelView(world, id) && { fuel: fuelView(world, id) }),
  ...(e.kind === 'npc' && e.shop && { shop: shelf(world, actor, id as EntityId) }),
  ...(e.kind === 'npc' &&
    carrying(world, id as EntityId) && { carrying: carrying(world, id as EntityId) }),
});

type Lists = ReturnType<typeof lists>;

// The exits of the body's room in compass order (movement.sight's): each unavailable with the
// code movement would refuse it with, with its barrier's door, and with what is seen through it
// unless that barrier bars the way.
function exits(world: World, actor_id: CharacterId, door: Lists['door'], steps: Steps): ExitView[] {
  const body = bodyOf(world, actor_id);
  if (!body) return [];
  const room = world.rooms[world.state.containers[body]];
  const set = resolved(world, actor_id);
  return movement.sight(world, body, steps).map(({ direction, ...seen }) => {
    const barrier = exitOf(room, direction)!.barrier;
    const destination = world.roomIds[refString(exitOf(room, direction)!.to)];
    const wet = edge(world, world.state.containers[body], destination, direction);
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
          entities: seen.entities.map((id) => ({
            id,
            name: describeEntity(world, actor_id, id, 'short', steps),
            kind: world.entities[id].kind as Key,
          })),
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
function equipmentViews(world: World, actor: CharacterId, actions: Lists, steps: Steps) {
  const body = bodyOf(world, actor);
  if (!body) return [];
  return Object.entries(world.slots).flatMap(([slot, holder]) => {
    const items = within(world, actor, body, actions, holder, actions.worn, steps);
    return Array.from({ length: world.capacities[holder] }, (_, i) => ({
      slot: slot as SlotKey,
      ...(items[i] && { item: items[i] }),
    }));
  });
}

type Fight = NonNullable<ReturnType<typeof engaged>>;
function combatView(world: World, actor: CharacterId, fight: Fight, steps: Steps) {
  const name = (id: EntityId) => describeEntity(world, actor, id, 'short', steps);
  return {
    encounter_id: fight.id,
    opponent_id: fight.row.npc_id,
    name: name(fight.row.npc_id),
    ...(fight.row.active_ids && {
      active_opponents: fight.row.active_ids.map((id) => ({ id, name: name(id) })),
    }),
  };
}
