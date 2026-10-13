import type {
  CommandId,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EntityId,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { uniform } from '../../foundation/rng.ts';
import { refString, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { living } from '../death/shared.ts';
import { barrierState } from '../lookups.ts';
import { npcPassage, relock } from '../movement/shared.ts';
import { happened } from '../schedule/behavior.ts';
import { moves } from '../status/shared.ts';
import { birth } from './birth.ts';
import { bindSight } from './behavior.ts';

export type Plan = World['populationSpecs'][string]['plan'];
type Changed = Extract<DomainEvent['payload'], { type: 'barrier_changed' }>;
/** A wander job's walking members' door events (toolbox row W26). */
export type Walked = ReturnType<typeof happened<Changed>>[];
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
    if (!eligible(slot, row, target, job.due_time)) continue;
    const born = birthSlot(world, occurrence_id, job, slot, row, mint);
    ops.push(...born.ops);
    ids.add(born.member_id);
  }
  return { ops, ids };
}
/** A slot within the target with no living member whose replacement is due by `due`. */
export const eligible = (slot: number, row: Slots[number]['row'], target: number, due: number) =>
  slot <= target &&
  (row.member_id === null || row.replacement_due !== null) &&
  (row.replacement_due === null || row.replacement_due <= due);

/**
 * Births at one plan occurrence with the RNG after it. An encounter plan (toolbox row 9) draws one
 * uniform(100) per wander-boundary opportunity with an eligible slot; a roll below `chance` births
 * the first eligible slot only. An ecology plan births every eligible slot and draws nothing.
 */
export function encounter(
  world: World,
  occurrence_id: CommandId,
  job: JobRow,
  target: number,
  slots: Slots,
  mint: Mint,
  boundary: boolean,
) {
  const plan = world.populationSpecs[key(job.job)]!.plan;
  const rng = world.state.rng;
  if (!plan.chance) return { ...births(world, occurrence_id, job, target, slots, mint), rng };
  const first = slots.find(
    ({ slot, row }) => boundary && eligible(slot, row, target, job.due_time),
  );
  if (!first) return { ops: [] as DeltaOp[], ids: new Set<string>(), rng };
  const [roll, after] = uniform(rng, 100, 8);
  const born = births(world, occurrence_id, job, target, roll < plan.chance ? [first] : [], mint);
  return { ...born, rng: after };
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
  wanderDue: number,
  slots: Slots,
  born: Set<string>,
  mint: Mint,
  walked: Walked,
): DeltaOp[] {
  if (job.due_time !== wanderDue) return [];
  const [home, nest] = plan.area.map((r) => world.roomIds[refString(r)]);
  const ops: DeltaOp[] = [];
  for (const { row } of slots)
    ops.push(
      ...wanderOne(world, occurrence_id, planRef, plan, job, row, born, [home, nest], mint, walked),
    );
  return ops;
}

// size: allow 47, a walking member (row W26) commits its key passage with its move and sight
function wanderOne(
  world: World,
  occurrence_id: CommandId,
  planRef: DefinitionRef,
  plan: Plan,
  job: JobRow,
  row: Slots[number]['row'],
  born: Set<string>,
  [home, nest]: EntityId[],
  mint: Mint,
  events: Walked,
): DeltaOp[] {
  const member = row.member_id;
  if (!member || !wanderable(world, row, born, job)) return [];
  const from = world.state.containers[member];
  const to = from === home ? nest : from === nest ? home : undefined;
  const room = world.rooms[from];
  // Toolbox row W26: a walking plan crosses doors as a walking schedule step does.
  const walker = plan.walks ? (member as EntityId) : undefined;
  const edge =
    to &&
    Object.entries(room.exits).find(
      ([d, e]) => world.roomIds[refString(e.to)] === to && !npcPassage(world, room, d, walker),
    );
  if (!to || !edge || !moves(world, member)) return [];
  const door = walker && edge[1].barrier;
  const doors = door && barrierState(world, door) === 'locked' ? relock(door) : [];
  for (const d of doors)
    events.push(happened(world, { id: occurrence_id }, mint, job.due_time, d.changed));
  const transfer = moveOp(member as EntityId, from, to);
  return [
    ...doors.map((d) => d.op),
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
