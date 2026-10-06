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

const planRef = (world: World, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: key as DefinitionRef['key'],
});

/** A checked birth sequence reused by genesis and the one plan-owned job. */
export function birth(
  world: World,
  plan: DefinitionRef,
  slot: number,
  generation: number,
  occurrence_id: CommandId,
  at: number,
  mint: Mint,
  writer_group = 0,
): DeltaOp[] {
  const spec = world.populationSpecs[key(plan)];
  if (!spec) throw new KernelError('precondition_failed');
  const member_id = mint() as EntityId;
  const pelt_id = mint() as EntityId;
  const origin = {
    kind: 'spawned' as const,
    by: plan,
    bundle: spec.bundle,
    slot,
    generation,
    occurrence_id,
    member_id,
  };
  const resource = { ...plan, kind: 'resource' as const, key: 'hp' as DefinitionRef['key'] };
  return [
    {
      op: 'entity.create',
      writer_group,
      identity: {
        id: member_id,
        definition: spec.hound,
        origin: { ...origin, role: 'hound' },
      },
    },
    {
      op: 'entity.transfer',
      writer_group,
      entity_id: member_id,
      source_id: null,
      destination_id: spec.home,
    },
    {
      op: 'entity.create',
      writer_group,
      identity: {
        id: pelt_id,
        definition: spec.pelt,
        origin: { ...origin, role: 'pelt' },
      },
    },
    {
      op: 'entity.transfer',
      writer_group,
      entity_id: pelt_id,
      source_id: null,
      destination_id: member_id,
    },
    {
      op: 'resource.initialize',
      writer_group,
      resource,
      entity_id: member_id,
      value: spec.hp.start,
      at,
    },
  ];
}

export function initialPopulation(world: World, mint: Mint, occurrence_id: CommandId): World {
  let current = world;
  for (const plan of Object.values(world.cartridge.populations ?? {})) {
    const ref = planRef(world, plan.key);
    const hour =
      Math.floor(current.state.clock / current.cartridge.calendar!.units_per_hour!) %
      current.cartridge.calendar!.hours_per_day!;
    const night = hour >= plan.night_start || hour < plan.night_end;
    const count = night ? plan.night_target : plan.day_target;
    const ops: DeltaOp[] = [];
    for (let slot = 1; slot <= plan.cap; slot++) {
      const made =
        slot <= count ? birth(current, ref, slot, 1, occurrence_id, current.state.clock, mint) : [];
      ops.push(...made);
      ops.push({
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
    const wander = alignedAfter(current.state.clock, plan.wander_interval);
    const next = Math.min(wander, nightBoundary(current, plan, current.state.clock));
    const job_id = mint() as JobId;
    ops.push({ op: 'job.schedule', writer_group: 0, job_id, job: ref, due_time: next });
    ops.push({
      op: 'population.control',
      writer_group: 0,
      plan: ref,
      expected: null,
      value: { job_id, next_wander_due: wander },
    });
    const result = apply(current, ops);
    if ('fault' in result) throw new KernelError(result.fault.code);
    current = result.world;
  }
  return current;
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
  const calendar = world.cartridge.calendar!;
  const hour = Math.floor(job.due_time / calendar.units_per_hour!) % calendar.hours_per_day!;
  const night = hour >= plan.night_start || hour < plan.night_end;
  const target = night ? plan.night_target : plan.day_target;
  const slots = Array.from({ length: plan.cap }, (_, i) => {
    const slot = i + 1;
    const row =
      world.state.population_slots?.[key({ kind: 'population_slot', plan: job.job, slot })];
    if (!row) throw new KernelError('precondition_failed');
    return { slot, row };
  });
  const ops: DeltaOp[] = [{ op: 'job.complete', writer_group: 0, job_id }];
  const born = new Set<string>();
  for (const { slot, row } of slots) {
    if (
      slot > target ||
      (row.member_id !== null && row.replacement_due === null) ||
      (row.replacement_due !== null && row.replacement_due > job.due_time)
    )
      continue;
    const generation = row.generation + 1;
    const made = birth(world, job.job, slot, generation, command.id, job.due_time, mint);
    const member_id = (made[0] as Extract<DeltaOp, { op: 'entity.create' }>).identity.id;
    ops.push(...made, {
      op: 'population.slot',
      writer_group: 0,
      plan: job.job,
      slot,
      expected: row,
      value: { generation, member_id, replacement_due: null },
    });
    born.add(member_id);
  }
  if (job.due_time === control.next_wander_due) {
    const [home, nest] = plan.area.map((r) => world.roomIds[refString(r)]);
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
  }
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
  const next_job_id = mint() as JobId;
  ops.push(
    { op: 'job.schedule', writer_group: 0, job_id: next_job_id, job: job.job, due_time: next },
    {
      op: 'population.control',
      writer_group: 0,
      plan: job.job,
      expected: control,
      value: { job_id: next_job_id, next_wander_due: wander },
    },
  );
  return accepted<never>(world, 'job_ran', ops, []);
}
