import type {
  CommandId,
  DefinitionRef,
  DeltaOp,
  EntityId,
  JobId,
  PopulationSlot,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { cmp } from '../../foundation/validate.ts';
import { KernelError } from '../../foundation/error.ts';
import {
  accepted,
  COMPASS,
  refString,
  type JobRow,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { closeEncounter } from '../combat/shared.ts';
import { living } from '../death/shared.ts';
import { exitOf, exitTo } from '../lookups.ts';
import { passage } from '../movement/shared.ts';
import { planRef } from './refs.ts';

/** Bind only a current deer generation observed on an actual player entry. */
export function entrySight(
  world: World,
  source: EntityId,
  room: EntityId,
  cause_id: CommandId,
  mint: Mint,
  steps: Steps,
): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (const spec of Object.values(world.populationSpecs)) {
    if (!spec.plan.sight) continue;
    const plan = planRef(world, spec.plan.key);
    for (let slot = 1; slot <= spec.cap; slot++) {
      steps.n++;
      const row = world.state.population_slots?.[key({ kind: 'population_slot', plan, slot })];
      if (
        row?.member_id &&
        row.replacement_due === null &&
        world.state.containers[row.member_id] === room &&
        living(world, row.member_id)
      )
        ops.push(
          ...bindSight(
            world,
            plan,
            slot,
            row,
            row.member_id,
            source,
            room,
            cause_id,
            'player_entry',
            world.state.clock,
            mint,
          ),
        );
    }
  }
  return ops;
}

/** The checked population transfer is the cause; the caller owns the slot's single writer. */
export function bindSight(
  world: World,
  plan: DefinitionRef,
  slot: number,
  prior: PopulationSlot,
  member_id: EntityId,
  source_id: EntityId | null,
  destination_id: EntityId,
  cause_id: CommandId,
  cause_kind: 'player_entry' | 'population_transfer',
  at: number,
  mint: Mint,
): DeltaOp[] {
  const spec = world.populationSpecs[key(plan)];
  if (!spec?.plan.sight) return [];
  const old = prior.sight_job_id;
  const job_id = mint() as JobId;
  return [
    ...(old
      ? [{ op: 'job.cancel' as const, writer_group: 0, job_id: old, sight_member_id: member_id }]
      : []),
    sightJob(plan, job_id, at + spec.plan.sight.delay, {
      member_id,
      player_id: world.character,
      slot,
      generation: prior.generation,
      seen_at: at,
      cause_kind,
      cause_id,
      source_id,
      destination_id,
    }),
    bindSlot(plan, slot, prior, job_id),
  ];
}

function bindSlot(
  plan: DefinitionRef,
  slot: number,
  prior: PopulationSlot,
  job_id: JobId | null,
): Extract<DeltaOp, { op: 'population.slot' }> {
  return {
    op: 'population.slot',
    writer_group: 0,
    plan,
    slot,
    expected: prior,
    value: { ...prior, sight_job_id: job_id },
  };
}

function sightJob(
  plan: DefinitionRef,
  job_id: JobId,
  due_time: number,
  sight: NonNullable<Extract<DeltaOp, { op: 'job.schedule' }>['sight']>,
): DeltaOp {
  return { op: 'job.schedule', writer_group: 0, job_id, job: plan, due_time, sight };
}

export function runSight(world: World, job_id: JobId, job: JobRow, steps: Steps) {
  const sight = job.sight;
  if (!sight) throw new KernelError('precondition_failed');
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  const current = activeSight(world, job_id, job);
  if (!current) return accepted<never>(world, 'job_ran', [done], []);
  const { plan, slot } = current;
  const clear = bindSlot(job.job, sight.slot, slot, null);
  const here = world.state.containers[sight.member_id];
  const present =
    slot.replacement_due === null &&
    living(world, sight.member_id) &&
    world.state.containers[world.body] === here &&
    world.rooms[here];
  if (!present) return accepted<never>(world, 'job_ran', [done, clear], []);
  const escape = refuge(world, plan, here, steps);
  if (escape) {
    const { direction, there } = escape;
    const transfer: DeltaOp = {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: sight.member_id,
      source_id: here,
      destination_id: there,
    };
    return accepted<never>(
      world,
      'job_ran',
      [
        done,
        transfer,
        ...closeEncounter(world, sight.member_id),
        { ...clear, value: { ...slot, sight_job_id: null, last_flight_at: job.due_time } },
      ],
      [],
      [{ key: plan.sight!.narration[direction]! }],
    );
  }
  return accepted<never>(world, 'job_ran', [done, clear], []);
}

function activeSight(world: World, job_id: JobId, job: JobRow) {
  const sight = job.sight!;
  const plan = world.populationSpecs[key(job.job)]?.plan;
  const slot =
    world.state.population_slots?.[
      key({ kind: 'population_slot', plan: job.job, slot: sight.slot })
    ];
  if (
    !plan?.sight ||
    !slot ||
    slot.sight_job_id !== job_id ||
    slot.member_id !== sight.member_id ||
    slot.generation !== sight.generation ||
    sight.player_id !== world.character
  )
    return undefined;
  return { plan, slot };
}

function refuge(
  world: World,
  plan: World['populationSpecs'][string]['plan'],
  here: EntityId,
  steps: Steps,
) {
  const room = world.rooms[here];
  for (const direction of [...COMPASS].sort(cmp)) {
    steps.n++;
    const exit = exitTo(room, direction);
    const there = exit && world.roomIds[refString(exit)];
    if (
      !there ||
      !plan.area.some((r) => refString(r) === refString(exit)) ||
      exitOf(room, direction)!.hidden_until ||
      exitOf(room, direction)!.climb ||
      passage(world, room, direction)
    )
      continue;
    return { direction, there };
  }
  return undefined;
}
