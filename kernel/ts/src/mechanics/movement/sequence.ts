import type { CharacterId, CommandId, Key } from '../../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  COMPASS,
  event,
  refString,
  rejected,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import * as water from '../water/shared.ts';
import { engaged } from '../combat/shared.ts';
import * as patrol from '../patrol/sequence.ts';
import * as expedition from '../expedition/sequence.ts';
import { exitTo } from '../lookups.ts';
import { standing } from '../position/shared.ts';
import { closeEncounter } from '../combat/shared.ts';
import { settled as crowSettled } from '../crow/behavior.ts';
import { travel } from '../escort/shared.ts';
import { entrySight } from '../population/behavior.ts';
import { fare, passage } from './shared.ts';

/** Shared ordinary/escape movement: admission, one payment, one transfer and closure. */
type MoveCommand = {
  readonly id: CommandId;
  readonly payload: { readonly actor_id: CharacterId; readonly direction: Key };
};
export function moveSequence(
  world: World,
  command: MoveCommand,
  mint: Mint,
  outcome: string,
  steps = { n: 0 },
) {
  const { actor_id, direction } = command.payload;
  const plan = movementPlan(world, actor_id, direction, steps, outcome === 'fled');
  if (typeof plan === 'string') return rejected(plan);
  const { body, here, there, paid } = plan;
  const transfer = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: body,
    source_id: here,
    destination_id: there,
  } as const;
  const ops = [
    ...paid.ops,
    transfer,
    ...water.travel(world, actor_id, there, plan.water?.entering, mint),
    ...travel(world, actor_id, here, there),
    ...closeMovementEncounter(world, body, mint),
    ...entrySight(world, here, there, command.id, mint, steps),
  ];
  const entered = event(world, command, mint, 1, {
    type: 'entity_entered_room',
    entity_id: body,
    room_id: there,
  });
  const joined = patrol.travel(world, command, here, there, ops, mint, steps);
  const ventured = expedition.travel(
    world,
    command,
    here,
    there,
    [...ops, ...joined.ops],
    mint,
    steps,
  );
  return accepted(
    world,
    outcome,
    [...ops, ...joined.ops, ...ventured.ops],
    [entered, ...joined.events, ...ventured.events],
    [...joined.narration, ...ventured.narration].length
      ? [...joined.narration, ...ventured.narration]
      : undefined,
  );
}

/** Read-only ordinary movement checks, reused before random escape selection. */
export function movementPlan(
  world: World,
  actor_id: CharacterId,
  direction: Key,
  steps = { n: 0 },
  escape = false,
) {
  if (!COMPASS.includes(direction)) return 'invalid_target' as const;
  const body = bodyOf(world, actor_id);
  if (!body) return 'not_found' as const;
  const here = world.state.containers[body];
  const to = exitTo(world.rooms[here], direction);
  const there = to && world.roomIds[refString(to)];
  if (!there) return 'not_found' as const;
  const barred = passage(world, world.rooms[here], direction);
  if (barred) return barred;
  const wet = water.edge(world, here, there, direction);
  if (wet) {
    const paid = water.admission(world, actor_id, wet.entering, steps);
    return typeof paid === 'string' ? paid : { body, here, there, paid, water: wet };
  }
  if (engaged(world, body) && !escape) return 'invalid_state' as const;
  if (!standing(world, actor_id)) return 'invalid_state' as const;
  const paid = fare(world, body);
  if (!paid) return 'insufficient_resource' as const;
  return { body, here, there, paid };
}

/** Escape closes combat and resumes the same surviving crow's checked return. */
function closeMovementEncounter(world: World, body: Parameters<typeof engaged>[1], mint: Mint) {
  const fight = engaged(world, body);
  return [
    ...closeEncounter(world, body),
    ...(fight ? crowSettled(world, fight.row.npc_id, mint) : []),
  ];
}
