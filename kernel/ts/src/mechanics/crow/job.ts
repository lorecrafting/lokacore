import type {
  Command,
  DeltaOp,
  DomainEvent,
  EntityId,
  EventPayload,
  JobId,
} from '../../contracts.gen.ts';
import { KernelError } from '../../foundation/error.ts';
import { accepted, refString, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { entered } from '../schedule/behavior.ts';
import {
  changed,
  corridor,
  current,
  edge,
  empty,
  held,
  next,
  openNest,
  rootRoom,
  type Binding,
} from './shared.ts';
const acquired = (
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  item_id: EntityId,
  holder_id: EntityId,
  at: number,
): Omit<DomainEvent, 'payload'> & {
  payload: Extract<EventPayload, { type: 'item_acquired' }>;
} => ({
  id: mint() as DomainEvent['id'],
  world_context_id: world.context,
  scope: { kind: 'instance', world_context_id: world.context },
  logical_time: at,
  position: 1,
  causation_id: command.id as string as DomainEvent['causation_id'],
  correlation_id: command.id as string as DomainEvent['correlation_id'],
  payload: { type: 'item_acquired', item_id, holder_id },
});

export function runCrow(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  b: Binding | undefined,
  mint: Mint,
) {
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  if (!b) return accepted<never>(world, 'job_ran', [done], []);
  if (
    job.job.kind !== 'population_bundle' ||
    refString(job.job) !== refString(b.spec.bundle) ||
    job.crow_member_id !== b.row.member_id ||
    job.crow_generation !== b.row.generation ||
    job.crow_phase !== b.row.phase
  )
    throw new KernelError('precondition_failed');
  if (!current(world, b))
    return accepted<never>(world, 'job_ran', [done, changed(b, empty(b.row))], []);
  const room = rootRoom(world, b);
  const route = corridor(world, b);
  const index = route.indexOf(room);
  if (index < 0) throw new KernelError('precondition_failed');
  if (b.row.phase === 'acquire') return acquire(world, command, mint, job, b, done, room);
  if (b.row.phase === 'leg') return leg(world, command, mint, job, b, done, room, route, index);
  return returning(world, command, mint, job, b, done, room, route, index);
}

function acquire(
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  job: JobRow,
  b: Binding,
  done: DeltaOp,
  room: EntityId,
) {
  const item = b.row.item_id;
  const s = b.spec.plan.scavenge!;

  if (item === null || world.state.containers[item] !== room)
    return accepted<never>(world, 'job_ran', [done, changed(b, empty(b.row))], []);
  const scheduled = next(b, mint, job.due_time, 'leg', item);
  return accepted(
    world,
    'job_ran',
    [
      done,
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: item,
        source_id: room,
        destination_id: b.row.member_id,
      },
      changed(b, scheduled.value),
      scheduled.op,
    ],
    [acquired(world, command, mint, item, b.row.member_id, job.due_time)],
    [{ key: s.narration.acquired }],
  );
}

function leg(
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  job: JobRow,
  b: Binding,
  done: DeltaOp,
  room: EntityId,
  route: EntityId[],
  index: number,
) {
  const item = b.row.item_id;

  if (!held(world, b))
    return accepted<never>(world, 'job_ran', [done, changed(b, empty(b.row))], []);
  if (!openNest(world, b) || (index < route.length - 1 && !edge(world, room, route[index + 1]))) {
    return discharge(world, b, done, job, mint, room, 'fallback');
  }
  if (index === route.length - 1) {
    return discharge(world, b, done, job, mint, b.row.nest_id!, 'delivered');
  }
  const scheduled = next(b, mint, job.due_time, 'leg', item);
  return accepted(
    world,
    'job_ran',
    [
      done,
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: b.row.member_id,
        source_id: room,
        destination_id: route[index + 1],
      },
      changed(b, scheduled.value),
      scheduled.op,
    ],
    [entered(world, command, mint, b.row.member_id, route[index + 1], job.due_time)],
  );
}

function returning(
  world: World,
  command: Pick<Command, 'id'>,
  mint: Mint,
  job: JobRow,
  b: Binding,
  done: DeltaOp,
  room: EntityId,
  route: EntityId[],
  index: number,
) {
  if (b.row.phase !== 'return') throw new KernelError('precondition_failed');
  const home = b.spec.home;
  if (room === home) return accepted<never>(world, 'job_ran', [done, changed(b, empty(b.row))], []);
  const homeIndex = route.indexOf(home);
  const toward = route[index + (index > homeIndex ? -1 : 1)];
  if (!toward || !edge(world, room, toward)) throw new KernelError('precondition_failed');
  const arrived = toward === home;
  const scheduled = arrived ? undefined : next(b, mint, job.due_time, 'return', null);
  return accepted(
    world,
    'job_ran',
    [
      done,
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: b.row.member_id,
        source_id: room,
        destination_id: toward,
      },
      changed(b, scheduled?.value ?? empty(b.row)),
      ...(scheduled ? [scheduled.op] : []),
    ],
    [entered(world, command, mint, b.row.member_id, toward, job.due_time)],
  );
}

function discharge(
  world: World,
  b: Binding,
  done: DeltaOp,
  job: JobRow,
  mint: Mint,
  destination_id: EntityId,
  narration: 'fallback' | 'delivered',
) {
  const room = rootRoom(world, b);
  const scheduled = room === b.spec.home ? undefined : next(b, mint, job.due_time, 'return', null);
  return accepted<never>(
    world,
    'job_ran',
    [
      done,
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: b.row.item_id!,
        source_id: b.row.member_id,
        destination_id,
      },
      changed(b, scheduled?.value ?? empty(b.row)),
      ...(scheduled ? [scheduled.op] : []),
    ],
    [],
    [{ key: b.spec.plan.scavenge!.narration[narration] }],
  );
}
