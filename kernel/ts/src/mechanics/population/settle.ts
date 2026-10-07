import type { CommandId, DefinitionRef, DeltaOp, EntityId } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { refString, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { living } from '../death/shared.ts';
import { passage } from '../movement/shared.ts';
import { birth } from './birth.ts';
import { bindSight } from './behavior.ts';

export type Plan = World['populationSpecs'][string]['plan'];
export type Slots = {
  slot: number;
  row: NonNullable<World['state']['population_slots']>[string];
}[];

export function births(
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
    const born = birthSlot(world, occurrence_id, job, slot, row, mint);
    ops.push(...born.ops);
    ids.add(born.member_id);
  }
  return { ops, ids };
}
function birthSlot(
  world: World,
  occurrence_id: CommandId,
  job: JobRow,
  slot: number,
  row: Slots[number]['row'],
  mint: Mint,
) {
  const generation = row.generation + 1;
  const made = birth(world, job.job, slot, generation, occurrence_id, job.due_time, mint);
  const member_id = (made[0] as Extract<DeltaOp, { op: 'entity.create' }>).identity.id;
  const spec = world.populationSpecs[key(job.job)]!;
  const value = {
    generation,
    member_id,
    replacement_due: null,
    ...((spec.plan.pack || spec.plan.sight) && { last_flight_at: null }),
    ...(spec.plan.sight && { sight_job_id: null }),
  };
  const sight = birthSight(world, occurrence_id, job, slot, value, member_id, mint);
  const binding = sight.find((op) => op.op === 'population.slot');
  const ops: DeltaOp[] = [
    ...made,
    ...sight.filter((op) => op.op !== 'population.slot'),
    {
      op: 'population.slot',
      writer_group: 0,
      plan: job.job,
      slot,
      expected: row,
      value: binding?.op === 'population.slot' ? binding.value : value,
    },
  ];
  return { ops, member_id };
}

function birthSight(
  world: World,
  occurrence_id: CommandId,
  job: JobRow,
  slot: number,
  value: Slots[number]['row'],
  member_id: EntityId,
  mint: Mint,
): DeltaOp[] {
  const spec = world.populationSpecs[key(job.job)]!;
  return spec.plan.sight && world.state.containers[world.body] === spec.home
    ? bindSight(
        world,
        job.job,
        slot,
        value,
        member_id,
        null,
        spec.home,
        occurrence_id,
        'population_transfer',
        job.due_time,
        mint,
      )
    : [];
}

export function wanders(
  world: World,
  occurrence_id: CommandId,
  planRef: DefinitionRef,
  plan: Plan,
  job: JobRow,
  control: NonNullable<World['state']['population_plans']>[string],
  slots: Slots,
  born: Set<string>,
  mint: Mint,
): DeltaOp[] {
  if (job.due_time !== control.next_wander_due) return [];
  const [home, nest] = plan.area.map((r) => world.roomIds[refString(r)]);
  const ops: DeltaOp[] = [];
  for (const { row } of slots)
    ops.push(...wanderOne(world, occurrence_id, planRef, plan, job, row, born, home, nest, mint));
  return ops;
}

function wanderOne(
  world: World,
  occurrence_id: CommandId,
  planRef: DefinitionRef,
  plan: Plan,
  job: JobRow,
  row: Slots[number]['row'],
  born: Set<string>,
  home: EntityId,
  nest: EntityId,
  mint: Mint,
): DeltaOp[] {
  const member = row.member_id;
  if (!member || !wanderable(world, row, born, job)) return [];
  const from = world.state.containers[member];
  const to = from === home ? nest : from === nest ? home : undefined;
  const room = world.rooms[from];
  const edge =
    to && Object.entries(room.exits).find(([, e]) => world.roomIds[refString(e.to)] === to);
  if (!to || !edge || passage(world, room, edge[0] as never)) return [];
  const transfer = moveOp(member as EntityId, from, to);
  return [
    transfer,
    ...arrivalSight(
      world,
      occurrence_id,
      planRef,
      plan,
      job,
      row,
      member as EntityId,
      from,
      to,
      mint,
    ),
  ];
}

function arrivalSight(
  world: World,
  occurrence_id: CommandId,
  planRef: DefinitionRef,
  plan: Plan,
  job: JobRow,
  row: Slots[number]['row'],
  member: EntityId,
  from: EntityId,
  to: EntityId,
  mint: Mint,
): DeltaOp[] {
  if (!plan.sight || to !== world.state.containers[world.body]) return [];
  const origin = world.state.created?.[member]?.origin;
  return origin?.kind === 'spawned'
    ? bindSight(
        world,
        planRef,
        origin.slot,
        row,
        member,
        from,
        to,
        occurrence_id,
        'population_transfer',
        job.due_time,
        mint,
      )
    : [];
}

function wanderable(
  world: World,
  row: Slots[number]['row'],
  born: Set<string>,
  job: JobRow,
): boolean {
  const member = row.member_id;
  return (
    !!member &&
    row.replacement_due === null &&
    !born.has(member) &&
    row.last_flight_at !== job.due_time &&
    !Object.values(world.state.crows ?? {}).some(
      (crow) => crow.member_id === member && crow.phase !== 'idle',
    ) &&
    !Object.values(world.state.jobs ?? {}).some(
      (due) =>
        due.crow_member_id === member &&
        due.due_time === job.due_time &&
        (due.crow_phase === 'leg' || due.crow_phase === 'return'),
    ) &&
    living(world, member) &&
    !engaged(world, member as EntityId)
  );
}

function moveOp(member: EntityId, from: EntityId, to: EntityId): DeltaOp {
  return {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: member,
    source_id: from,
    destination_id: to,
  };
}
