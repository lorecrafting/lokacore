import type {
  Command,
  CommandId,
  DefinitionRef,
  DeltaOp,
  EntityId,
  JobId,
} from '../../contracts.gen.ts';
import { apply } from '../../runtime/apply.ts';
import { accepted, refString, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { key } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { birth } from './birth.ts';
import { planRef } from './refs.ts';
import { births, wanders, type Plan, type Slots } from './settle.ts';

export function initialPopulation(world: World, mint: Mint, occurrence_id: CommandId): World {
  let current = world;
  for (const plan of Object.values(world.cartridge.populations ?? {})) {
    const ref = planRef(world, plan.key);
    const ops = initialOps(current, ref, plan, mint, occurrence_id);
    const result = apply(current, ops);
    if ('fault' in result) throw new KernelError(result.fault.code);
    current = result.world;
  }
  return current;
}

function initialOps(
  world: World,
  ref: DefinitionRef,
  plan: World['populationSpecs'][string]['plan'],
  mint: Mint,
  occurrence_id: CommandId,
): DeltaOp[] {
  const hour =
    Math.floor(world.state.clock / world.cartridge.calendar!.units_per_hour!) %
    world.cartridge.calendar!.hours_per_day!;
  const count =
    hour >= plan.night_start || hour < plan.night_end ? plan.night_target : plan.day_target;
  const ops = genesisSlots(world, ref, plan.cap, count, occurrence_id, mint);
  const wander = alignedAfter(world.state.clock, plan.wander_interval);
  const job_id = mint() as JobId;
  ops.push(
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id,
      job: ref,
      due_time: Math.min(wander, nightBoundary(world, plan, world.state.clock)),
    },
    {
      op: 'population.control',
      writer_group: 0,
      plan: ref,
      expected: null,
      value: { job_id, next_wander_due: wander },
    },
  );
  return ops;
}

function genesisSlots(
  world: World,
  ref: DefinitionRef,
  cap: number,
  count: number,
  occurrence_id: CommandId,
  mint: Mint,
): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const flight = !!(
    world.populationSpecs[key(ref)]?.plan.pack || world.populationSpecs[key(ref)]?.plan.sight
  );
  for (let slot = 1; slot <= cap; slot++) {
    const made =
      slot <= count ? birth(world, ref, slot, 1, occurrence_id, world.state.clock, mint) : [];
    ops.push(...made, {
      op: 'population.slot',
      writer_group: 0,
      plan: ref,
      slot,
      expected: null,
      value: {
        generation: slot <= count ? 1 : 0,
        member_id:
          slot <= count ? (made[0] as Extract<DeltaOp, { op: 'entity.create' }>).identity.id : null,
        replacement_due: null,
        ...(flight && { last_flight_at: null }),
        ...(world.populationSpecs[key(ref)]?.plan.sight && { sight_job_id: null }),
      },
    });
  }
  return ops;
}

const alignedAfter = (at: number, interval: number) => (Math.floor(at / interval) + 1) * interval;

function nightBoundary(world: World, plan: World['populationSpecs'][string]['plan'], at: number) {
  const calendar = world.cartridge.calendar!;
  const day = calendar.hours_per_day! * calendar.units_per_hour!;
  const next = (hour: number) =>
    at + ((hour * calendar.units_per_hour! - (at % day) + day - 1) % day) + 1;
  return Math.min(next(plan.night_start), next(plan.night_end));
}

/** The current plan occurrence; stale bindings never mint a replacement. */
export function runPopulation(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
) {
  const plan = world.cartridge.populations?.[refString(job.job)];
  const control = world.state.population_plans?.[key(job.job)];
  if (!plan || !control || control.job_id !== job_id) throw new KernelError('precondition_failed');
  const target = targetAt(world, plan, job.due_time);
  const slots = slotRows(world, job.job, plan.cap);
  const born = births(world, command.id, job, target, slots, mint);
  const ops: DeltaOp[] = [
    { op: 'job.complete', writer_group: 0, job_id },
    ...born.ops,
    ...wanders(world, command.id, job.job, plan, job, control, slots, born.ids, mint),
    ...successor(world, plan, job, control, target, slots, mint),
  ];
  return accepted<never>(world, 'job_ran', ops, []);
}

function targetAt(world: World, plan: Plan, at: number) {
  const calendar = world.cartridge.calendar!;
  const hour = Math.floor(at / calendar.units_per_hour!) % calendar.hours_per_day!;
  return hour >= plan.night_start || hour < plan.night_end ? plan.night_target : plan.day_target;
}
function slotRows(world: World, plan: DefinitionRef, cap: number): Slots {
  return Array.from({ length: cap }, (_, i) => {
    const slot = i + 1;
    const row = world.state.population_slots?.[key({ kind: 'population_slot', plan, slot })];
    if (!row) throw new KernelError('precondition_failed');
    return { slot, row };
  });
}
function successor(
  world: World,
  plan: Plan,
  job: JobRow,
  control: NonNullable<World['state']['population_plans']>[string],
  target: number,
  slots: Slots,
  mint: Mint,
): DeltaOp[] {
  const wander =
    job.due_time === control.next_wander_due
      ? alignedAfter(job.due_time, plan.wander_interval)
      : control.next_wander_due;
  const eligibleDue = slots.flatMap(({ slot, row }) =>
    slot <= target && row.replacement_due !== null && row.replacement_due > job.due_time
      ? [row.replacement_due]
      : [],
  );
  const next = Math.min(wander, nightBoundary(world, plan, job.due_time), ...eligibleDue);
  const job_id = mint() as JobId;
  return [
    { op: 'job.schedule', writer_group: 0, job_id, job: job.job, due_time: next },
    {
      op: 'population.control',
      writer_group: 0,
      plan: job.job,
      expected: control,
      value: { job_id, next_wander_due: wander },
    },
  ];
}
