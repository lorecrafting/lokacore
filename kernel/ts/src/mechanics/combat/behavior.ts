import type { DeltaOp, EntityId, EncounterRow, Key } from '../../contracts.gen.ts';
import { key, same } from '../../foundation/compose.ts';
import { cmp } from '../../foundation/validate.ts';
import { COMPASS, refString, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { exitTo } from '../lookups.ts';
import { passage } from '../movement/shared.ts';
import { engaged } from './shared.ts';

/** Exact C3 slot membership at admission; the roster never refills. */
export function admission(world: World, target: EntityId, steps: Steps): EntityId[] | undefined {
  const origin = world.state.created?.[target]?.origin;
  if (origin?.kind !== 'spawned' || origin.role !== 'hound') return;
  const plan = world.populationSpecs[key(origin.by)]?.plan;
  if (!plan?.pack) return;
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
  const room = world.rooms[here];
  for (const direction of [...COMPASS].sort(cmp)) {
    steps.n++;
    const exit = exitTo(room, direction);
    const there = exit && world.roomIds[refString(exit)];
    if (
      !there ||
      !plan.area.some((ref) => refString(ref) === refString(exit)) ||
      passage(world, room, direction)
    )
      continue;
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
      direction,
      there,
      ops: [
        {
          op: 'entity.transfer',
          writer_group: 0,
          entity_id: id,
          source_id: here,
          destination_id: there,
        },
        {
          op: 'population.slot',
          writer_group: 0,
          plan: origin.by,
          slot: origin.slot,
          expected: prior,
          value: { ...prior, last_flight_at: at },
        },
      ],
    };
  }
}

export function packPlan(world: World, id: EntityId) {
  const origin = world.state.created?.[id]?.origin;
  return origin?.kind === 'spawned' ? world.populationSpecs[key(origin.by)]?.plan.pack : undefined;
}
