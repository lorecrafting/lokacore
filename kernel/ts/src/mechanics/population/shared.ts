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
import { engaged } from '../combat/shared.ts';
import { living } from '../death/shared.ts';
import { passage } from '../movement/shared.ts';
import { birth } from './birth.ts';

const planRef = (world: World, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: key as DefinitionRef['key'],
});

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
  for (let slot = 1; slot <= cap; slot++) {
    const made =
      slot <= count ? birth(world, ref, slot, 1, occurrence_id, world.state.clock, mint) : [];
    ops.push(...made, {
      op: 'population.slot',
      writer_group: 0,
      plan: ref,
      slot,
      expected: null,
      value:
        slot <= count
          ? {
              generation: 1,
              member_id: (made[0] as Extract<DeltaOp, { op: 'entity.create' }>).identity.id,
              replacement_due: null,
            }
          : { generation: 0, member_id: null, replacement_due: null },
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
    ...wanders(world, plan, job, control, slots, born.ids),
    ...successor(world, plan, job, control, target, slots, mint),
  ];
  return accepted<never>(world, 'job_ran', ops, []);
}

type Plan = World['populationSpecs'][string]['plan'];
type Slots = { slot: number; row: NonNullable<World['state']['population_slots']>[string] }[];
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
function births(
  world: World,
  occurrence_id: CommandId,
  job: JobRow,
  target: number,
  slots: Slots,
  mint: Mint,
) {
  const ops: DeltaOp[] = [];
  const ids = new Set<string>();
  for (const { slot, row } of slots) {
    if (
      slot > target ||
      (row.member_id !== null && row.replacement_due === null) ||
      (row.replacement_due !== null && row.replacement_due > job.due_time)
    )
      continue;
    const generation = row.generation + 1;
    const made = birth(world, job.job, slot, generation, occurrence_id, job.due_time, mint);
    const member_id = (made[0] as Extract<DeltaOp, { op: 'entity.create' }>).identity.id;
    ops.push(...made, {
      op: 'population.slot',
      writer_group: 0,
      plan: job.job,
      slot,
      expected: row,
      value: { generation, member_id, replacement_due: null },
    });
    ids.add(member_id);
  }
  return { ops, ids };
}
function wanders(
  world: World,
  plan: Plan,
  job: JobRow,
  control: NonNullable<World['state']['population_plans']>[string],
  slots: Slots,
  born: Set<string>,
): DeltaOp[] {
  if (job.due_time !== control.next_wander_due) return [];
  const [home, nest] = plan.area.map((r) => world.roomIds[refString(r)]);
  const ops: DeltaOp[] = [];
  for (const { row } of slots) {
    const member = row.member_id;
    if (
      !member ||
      row.replacement_due !== null ||
      born.has(member) ||
      !living(world, member) ||
      engaged(world, member as EntityId)
    )
      continue;
    const from = world.state.containers[member];
    const to = from === home ? nest : from === nest ? home : undefined;
    const room = world.rooms[from];
    const edge =
      to && Object.entries(room.exits).find(([, e]) => world.roomIds[refString(e.to)] === to);
    if (!to || !edge || passage(world, room, edge[0] as never)) continue;
    ops.push({
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: member as EntityId,
      source_id: from,
      destination_id: to,
    });
  }
  return ops;
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
