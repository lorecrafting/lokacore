import type { DialogueChoice, Key, PatrolDraw, PatrolRelation } from '../../contracts.gen.ts';
import {
  bodyOf,
  refString,
  type ChoiceRow,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { living } from '../death/shared.ts';
import { standing } from '../position/shared.ts';
import { questOf } from '../lookups.ts';
import { passage } from '../movement/shared.ts';

export const definition = (world: World, row: PatrolRelation) =>
  world.cartridge.quests![refString(world.state.quests![row.quest_instance_id].quest)].patrol!;
export function drawn(row: PatrolRelation): PatrolDraw {
  const { quest_instance_id, attempt_id, cursor, status } = row;
  return { quest_instance_id, attempt_id, cursor, status };
}
export function route(world: World, row: PatrolRelation, steps: Steps = { n: 0 }) {
  const settings = definition(world, row);
  steps.n += settings.route.length;
  const next = (row.cursor + 1) % settings.route.length;
  const here = world.roomIds[refString(settings.route[row.cursor])];
  const there = world.roomIds[refString(settings.route[next])];
  const direction = Object.entries(world.rooms[here].exits).find(
    ([, e]) => world.roomIds[refString(e.to)] === there,
  )?.[0] as Key;
  const previous = (row.cursor + settings.route.length - 1) % settings.route.length;
  const source = world.roomIds[refString(settings.route[previous])];
  const pending_direction = Object.entries(world.rooms[source].exits).find(
    ([, e]) => world.roomIds[refString(e.to)] === here,
  )?.[0] as Key;
  return { settings, next, here, there, direction, pending_direction };
}
/** Shared direct Choose and PendingChoice admission, including the exact drawn attempt. */
export function refused(
  world: World,
  choice: ChoiceRow,
  option: DialogueChoice,
  input: PatrolDraw | undefined,
  steps: Steps,
) {
  const effect = option.patrol;
  if (!effect) return input ? ('invalid_state' as const) : undefined;
  const body = bodyOf(world, choice.actor_id);
  const npc = choice.roles.find((r) => r.role === effect.npc)?.entity_id;
  const settings = world.cartridge.quests![refString(effect.quest)].patrol!;
  if (!body || npc !== world.entityIds[refString(settings.npc)]) return 'invalid_state' as const;
  if (!standing(world, choice.actor_id) || !living(world, body)) return 'invalid_state' as const;
  if (!living(world, npc) || world.state.containers[body] !== world.state.containers[npc])
    return 'not_present' as const;
  const quest = questOf(world, choice.actor_id, effect.quest);
  if (effect.transition === 'start') return quest || input ? ('invalid_state' as const) : undefined;
  const row = quest && world.state.patrols?.[quest[0]];
  const expected = { continue: 'together', rejoin: 'paused', restart: 'failed' }[effect.transition];
  if (
    !row ||
    quest![1].state !== 'active' ||
    !same(input, drawn(row)) ||
    row.status !== expected ||
    row.actor_id !== choice.actor_id ||
    row.body_id !== body ||
    row.npc_id !== npc
  )
    return 'invalid_state' as const;
  if (effect.transition === 'continue') {
    const edge = route(world, row, steps);
    if (world.state.containers[npc] !== edge.here) return 'invalid_state' as const;
    return passage(world, world.rooms[edge.here], edge.direction);
  }
}
