// size: allow 370, population genesis, suppression and one bounded resume share plan ownership
import type {
  CharacterId,
  Command,
  CommandId,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EntityId,
  JobId,
} from '../../contracts.gen.ts';
import { apply } from '../../runtime/apply.ts';
import {
  accepted,
  bodyOf,
  refString,
  type JobRow,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { key } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import { closeEncounter, engaged } from '../combat/shared.ts';
import { add } from '../../foundation/int.ts';
import { living } from '../death/shared.ts';
import { passage } from '../movement/shared.ts';
import { birth } from './birth.ts';

const planRef = (world: World, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: key as DefinitionRef['key'],
});

export function suppressed(world: World, plan: DefinitionRef, at = world.state.clock) {
  const until = world.state.population_plans?.[key(plan)]?.suppression?.ends_at;
  return until !== undefined && until !== null && at < until;
}

/** One accepted bell cause owns one bounded suppression and its resume occurrence. */
// size: allow 46, one cause binds suppression, resume occurrence and hound encounter closure
export function suppress(
  world: World,
  actor: CharacterId,
  plan: DefinitionRef,
  duration: number,
  cause: DomainEvent,
  group: number,
  mint: Mint,
): DeltaOp[] {
  const control = world.state.population_plans?.[key(plan)];
  if (
    !world.populationSpecs[key(plan)]?.plan.pack ||
    !control ||
    cause.payload.type !== 'fact_changed' ||
    cause.payload.new !== true ||
    cause.actor_id !== actor ||
    suppressed(world, plan, cause.logical_time)
  )
    throw new KernelError('precondition_failed');
  const job_id = mint() as JobId;
  const ends_at = add(cause.logical_time, duration);
  const suppression = {
    generation: (control.suppression?.generation ?? 0) + 1,
    ends_at,
    job_id,
    cause_event_id: cause.id,
  };
  const body = bodyOf(world, actor);
  const fight = body && engaged(world, body);
  const origin = fight && world.state.created?.[fight.row.npc_id]?.origin;
  const close =
    origin?.kind === 'spawned' && key(origin.by) === key(plan) ? closeEncounter(world, body!) : [];
  return [
    {
      op: 'population.control',
      writer_group: group,
      plan,
      expected: control,
      value: { ...control, suppression },
    },
    { op: 'job.schedule', writer_group: group, job_id, job: plan, due_time: ends_at },
    ...close.map((op) => ({ ...op, writer_group: group })),
  ];
}

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
  const pack = !!world.populationSpecs[key(ref)]?.plan.pack;
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
              ...(pack && { last_flight_at: null }),
            }
          : {
              generation: 0,
              member_id: null,
              replacement_due: null,
              ...(pack && { last_flight_at: null }),
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
  if (!plan || !control) throw new KernelError('precondition_failed');
  if (control.suppression?.job_id === job_id)
    return resumePopulation(world, command, job_id, job, control, plan, mint);
  if (control.job_id !== job_id)
    return accepted<never>(world, 'job_ran', [{ op: 'job.complete', writer_group: 0, job_id }], []);
  const target = targetAt(world, plan, job.due_time);
  const slots = slotRows(world, job.job, plan.cap);
  const quiet = suppressed(world, job.job, job.due_time);
  const born = quiet
    ? { ops: [] as DeltaOp[], ids: new Set<string>() }
    : births(world, command.id, job, target, slots, mint);
  const ops: DeltaOp[] = [
    { op: 'job.complete', writer_group: 0, job_id },
    ...born.ops,
    ...(quiet ? [] : wanders(world, plan, job, control, slots, born.ids)),
    ...successor(world, plan, job, control, target, slots, mint),
  ];
  return accepted<never>(world, 'job_ran', ops, []);
}

function resumePopulation(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  control: NonNullable<World['state']['population_plans']>[string],
  plan: World['populationSpecs'][string]['plan'],
  mint: Mint,
) {
  const suppression = control.suppression!;
  if (suppression.ends_at !== job.due_time) throw new KernelError('precondition_failed');
  const born = births(
    world,
    command.id,
    job,
    targetAt(world, plan, job.due_time),
    slotRows(world, job.job, plan.cap),
    mint,
  );
  return accepted<never>(
    world,
    'job_ran',
    [
      { op: 'job.complete', writer_group: 0, job_id },
      ...born.ops,
      {
        op: 'population.control',
        writer_group: 0,
        plan: job.job,
        expected: control,
        value: { ...control, suppression: { ...suppression, ends_at: null, job_id: null } },
      },
    ],
    [],
  );
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
      value: {
        generation,
        member_id,
        replacement_due: null,
        ...(world.populationSpecs[key(job.job)]?.plan.pack && { last_flight_at: null }),
      },
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
      row.last_flight_at === job.due_time ||
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
      value: { ...control, job_id, next_wander_due: wander },
    },
  ];
}
