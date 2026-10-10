import type { DefinitionRef, DeltaOp, EntityId, EncounterRow, Key } from '../../contracts.gen.ts';
import { key, same } from '../../foundation/compose.ts';
import { cmp } from '../../foundation/validate.ts';
import { COMPASS, refString, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { exitOf, exitTo } from '../lookups.ts';
import { passage } from '../movement/shared.ts';
import { engaged } from './shared.ts';
import { suppressed } from '../population/shared.ts';

/** Exact C3 slot membership at admission; the roster never refills. */
export function admission(world: World, target: EntityId, steps: Steps): EntityId[] | undefined {
  const origin = world.state.created?.[target]?.origin;
  if (origin?.kind !== 'spawned' || origin.role !== 'hound') return;
  const plan = world.populationSpecs[key(origin.by)]?.plan;
  if (!plan?.pack || suppressed(world, origin.by)) return;
  const room = world.state.containers[target];
  return Array.from({ length: plan.cap }, (_, i) => i + 1)
    .flatMap((index) => {
      steps.n++;
      const slot =
        world.state.population_slots?.[
          key({ kind: 'population_slot', plan: origin.by, slot: index })
        ];
      const id = slot?.member_id;
      if (
        !id ||
        slot.replacement_due !== null ||
        world.state.containers[id] !== room ||
        !living(world, id) ||
        engaged(world, id as EntityId)
      )
        return [];
      const member = world.state.created?.[id]?.origin;
      if (
        member?.kind !== 'spawned' ||
        member.role !== 'hound' ||
        !same(member.by, origin.by) ||
        member.member_id !== id ||
        member.generation !== slot.generation ||
        member.slot !== index
      )
        return [];
      return [id as EntityId];
    })
    .sort(cmp);
}

export function eligible(world: World, row: EncounterRow, id: EntityId) {
  return living(world, id) && world.state.containers[id] === row.room_id;
}

export function next(ids: readonly EntityId[], selected: EntityId) {
  return ids.find((id) => id > selected) ?? ids[0];
}

export function flight(
  world: World,
  id: EntityId,
  at: number,
  steps: Steps,
): { ops: DeltaOp[]; direction: Key; there: EntityId } | undefined {
  const origin = world.state.created?.[id]?.origin;
  if (origin?.kind !== 'spawned' || origin.role !== 'hound') return;
  const plan = world.populationSpecs[key(origin.by)]?.plan;
  if (!plan?.pack) return;
  const here = world.state.containers[id];
  if (!plan.area.some((ref) => world.roomIds[refString(ref)] === here)) return;
  const leaving = flightExit(world, here, plan.area, steps);
  return leaving && flightWrite(world, id, at, here, origin, leaving);
}

function flightWrite(
  world: World,
  id: EntityId,
  at: number,
  here: EntityId,
  origin: { by: DefinitionRef; slot: number; generation: number },
  leaving: { direction: Key; there: EntityId },
) {
  const target = { kind: 'population_slot' as const, plan: origin.by, slot: origin.slot };
  const prior = world.state.population_slots?.[key(target)];
  if (
    !prior ||
    prior.member_id !== id ||
    prior.generation !== origin.generation ||
    prior.replacement_due !== null
  )
    return;
  return {
    ...leaving,
    ops: [
      {
        op: 'entity.transfer' as const,
        writer_group: 0,
        entity_id: id,
        source_id: here,
        destination_id: leaving.there,
      },
      {
        op: 'population.slot' as const,
        writer_group: 0,
        plan: origin.by,
        slot: origin.slot,
        expected: prior,
        value: { ...prior, last_flight_at: at },
      },
    ],
  };
}

function flightExit(world: World, here: EntityId, area: readonly DefinitionRef[], steps: Steps) {
  const room = world.rooms[here];
  for (const direction of [...COMPASS].sort(cmp)) {
    steps.n++;
    const exit = exitTo(room, direction);
    const there = exit && world.roomIds[refString(exit)];
    if (
      there &&
      area.some((ref) => refString(ref) === refString(exit)) &&
      !exitOf(room, direction)!.hidden_until &&
      !exitOf(room, direction)!.climb &&
      !passage(world, room, direction)
    )
      return { direction, there };
  }
}

export function packPlan(world: World, id: EntityId) {
  const origin = world.state.created?.[id]?.origin;
  return origin?.kind === 'spawned' ? world.populationSpecs[key(origin.by)]?.plan.pack : undefined;
}
