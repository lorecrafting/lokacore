import type {
  CharacterId,
  DeltaOp,
  EntityId,
  JobId,
  Key,
  WaterOccupancy,
} from '../../contracts.gen.ts';
import { bodyOf, refString, type World, type Steps, type Mint } from '../../runtime/decision.ts';
import { add } from '../../foundation/int.ts';
import { status } from '../skills.ts';
import { load } from '../containment/shared.ts';
import { level, pay, resourceRef } from '../resource.ts';
import { standing } from '../position/shared.ts';
import { engaged } from '../combat/shared.ts';

export function edge(world: World, here: EntityId, there: EntityId, direction: Key) {
  return world.cartridge.world?.water?.routes.flatMap((route) => {
    const surface = world.roomIds[refString(route.surface)],
      bottom = world.roomIds[refString(route.bottom)];
    return here === surface && there === bottom && direction === 'down'
      ? [{ route, entering: true }]
      : here === bottom && there === surface && direction === 'up'
        ? [{ route, entering: false }]
        : [];
  })[0];
}

export function admission(world: World, actor: CharacterId, entering: boolean, steps: Steps) {
  const body = bodyOf(world, actor)!;
  if (!(level(world, body, resourceRef(world, 'hp'))! > 0)) return 'invalid_state' as const;
  if (!entering) return { ops: [] as DeltaOp[] };
  if (
    !standing(world, actor) ||
    engaged(world, body) ||
    world.state.escorts?.[actor]?.status === 'following'
  )
    return 'invalid_state' as const;
  const settings = world.cartridge.world!.water!;
  if (!status(world, actor, settings.skill, steps).usable) return 'invalid_state' as const;
  const mass = load(world, body, steps);
  if (typeof mass === 'string') return mass;
  if (mass > settings.maximum_grams) return 'too_heavy' as const;
  return (
    pay(world, body, [{ resource: resourceRef(world, 'mv'), amount: settings.entry_cost }]) ??
    ('insufficient_resource' as const)
  );
}

export function entered(world: World, actor: CharacterId, bottom: EntityId, mint: Mint): DeltaOp[] {
  const expected = world.state.water?.[actor] ?? null,
    job_id = mint() as JobId;
  const generation = add(expected?.generation ?? 0, 1),
    entered_at = world.state.clock;
  const deadline = add(entered_at, world.cartridge.world!.water!.duration);
  const body_id = bodyOf(world, actor)!;
  const value: WaterOccupancy = {
    generation,
    body_id,
    room_id: bottom,
    entered_at,
    deadline,
    job_id,
  };
  const job = world.cartridge.world!.water!.routes.find(
    (r) => world.roomIds[refString(r.bottom)] === bottom,
  )!.bottom;
  return [
    { op: 'water.transition', writer_group: 0, actor_id: actor, expected, value },
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id,
      job,
      due_time: deadline,
      actor_id: actor,
      water_generation: generation,
      water_body_id: body_id,
    },
  ];
}

export function travel(
  world: World,
  actor: CharacterId,
  bottom: EntityId,
  entering: boolean | undefined,
  mint: Mint,
): DeltaOp[] {
  return entering === undefined
    ? []
    : entering
      ? entered(world, actor, bottom, mint)
      : leave(world, actor);
}

/** Every surface/death invalidates the generation; completed expiry has no cancellation. */
export function leave(world: World, actor: CharacterId, group = 0): DeltaOp[] {
  const expected = world.state.water?.[actor];
  if (!expected?.room_id) return [];
  const value = {
    generation: add(expected.generation, 1),
    body_id: expected.body_id,
    room_id: null,
    entered_at: null,
    deadline: null,
    job_id: null,
  };
  return [
    { op: 'water.transition', writer_group: group, actor_id: actor, expected, value },
    ...(world.state.jobs?.[expected.job_id!]?.status === 'pending'
      ? [
          {
            op: 'job.cancel' as const,
            writer_group: group,
            job_id: expected.job_id!,
            water_generation: expected.generation,
            actor_id: actor,
          },
        ]
      : []),
  ];
}
