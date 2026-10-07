import type { Command, DeltaOp, EncounterId, EntityId } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { KernelError } from '../../foundation/error.ts';
import {
  accepted,
  bodyOf,
  event,
  refString,
  rejected,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { engaged } from '../combat/shared.ts';
import { standing } from '../position/shared.ts';
import { binding, changed, current, empty, held, next, rootRoom, type Binding } from './shared.ts';
export { binding } from './shared.ts';
export { dropped, taken } from './intent.ts';
export { runCrow } from './job.ts';
/** Shared projection and execution admission for the exact currently carried root. */
export function shooRefused(world: World, actor: World['character'], crow_id: EntityId) {
  const body = bodyOf(world, actor);
  if (!body || !world.entities[crow_id]) return 'not_found' as const;
  if (world.entities[crow_id].kind !== 'npc') return 'invalid_target' as const;
  const room = world.state.containers[body];
  if (!world.rooms[room] || world.state.containers[crow_id] !== room) return 'not_present' as const;
  if (
    !living(world, body) ||
    !standing(world, actor) ||
    engaged(world, body) ||
    !living(world, crow_id)
  )
    return 'invalid_state' as const;
  const row = Object.values(world.state.crows ?? {}).find(
    (c) => c.member_id === crow_id && c.phase === 'leg' && c.item_id !== null && c.job_id !== null,
  );
  const b = row && binding(world, row.job_id!);
  const job = row && world.state.jobs?.[row.job_id!];
  if (
    !row ||
    !b ||
    !current(world, b) ||
    job?.status !== 'pending' ||
    world.state.containers[row.item_id!] !== crow_id ||
    row.nest_id !== world.entityIds[refString(b.spec.plan.scavenge!.nest)] ||
    !b.spec.plan.scavenge!.items.some((r) => world.entityIds[refString(r)] === row.item_id)
  )
    return 'invalid_state' as const;
}

export function carrying(world: World, crow_id: EntityId) {
  const row = Object.values(world.state.crows ?? {}).find(
    (c) =>
      c.member_id === crow_id &&
      c.phase === 'leg' &&
      c.item_id !== null &&
      world.state.containers[c.item_id] === crow_id,
  );
  return row && binding(world, row.job_id!)?.spec.plan.scavenge?.narration.carrying;
}

/** Accepted combat stops a live transport before its next due leg. */
export function attacked(world: World, crow_id: EntityId, encounter_id: EncounterId): DeltaOp[] {
  const row = Object.values(world.state.crows ?? {}).find(
    (c) => c.member_id === crow_id && (c.phase === 'leg' || c.phase === 'return'),
  );
  if (!row) return [];
  const b = binding(world, row.job_id!)!;
  const room = rootRoom(world, b);
  return [
    ...(held(world, b)
      ? [
          {
            op: 'entity.transfer' as const,
            writer_group: 0,
            entity_id: row.item_id!,
            source_id: crow_id,
            destination_id: room,
          },
        ]
      : []),
    {
      op: 'job.cancel',
      writer_group: 0,
      job_id: row.job_id!,
      crow_member_id: crow_id,
      crow_generation: row.generation,
    },
    changed(b, { ...row, phase: 'paused_return', item_id: null, job_id: null, encounter_id }),
  ];
}

/** The closed encounter either restarts a checked return or leaves an already-home crow idle. */
export function settled(world: World, crow_id: EntityId, mint: Mint): DeltaOp[] {
  const row = Object.values(world.state.crows ?? {}).find(
    (c) => c.member_id === crow_id && c.phase === 'paused_return',
  );
  if (!row) return [];
  const origin = world.state.created?.[crow_id]?.origin;
  if (origin?.kind !== 'spawned') throw new KernelError('precondition_failed');
  const b = {
    plan: origin.by,
    slot: origin.slot,
    row,
    spec: world.populationSpecs[key(origin.by)],
  };
  if (!living(world, crow_id)) return [changed(b, empty(row))];
  const scheduled =
    rootRoom(world, b) === b.spec.home
      ? undefined
      : next(b, mint, world.state.clock, 'return', null);
  return [changed(b, scheduled?.value ?? empty(row)), ...(scheduled ? [scheduled.op] : [])];
}

export function died(world: World, crow_id: EntityId, writer_group: number): DeltaOp[] {
  const row = Object.values(world.state.crows ?? {}).find(
    (c) => c.member_id === crow_id && c.phase !== 'idle',
  );
  if (!row) return [];
  const origin = world.state.created?.[crow_id]?.origin;
  if (origin?.kind !== 'spawned') throw new KernelError('precondition_failed');
  return [
    {
      ...changed(
        { plan: origin.by, slot: origin.slot, row, spec: world.populationSpecs[key(origin.by)] },
        empty(row),
      ),
      writer_group,
    },
  ];
}

export const shoo = (
  world: World,
  command: Omit<Command, 'payload'> & {
    payload: Extract<Command['payload'], { type: 'shoo' }>;
  },
  mint: Mint,
) => {
  const p = command.payload;
  const refused = shooRefused(world, p.actor_id, p.crow_id);
  if (refused) return rejected(refused);
  const row = Object.values(world.state.crows ?? {}).find(
    (c) => c.member_id === p.crow_id && c.phase === 'leg',
  )!;
  const b = binding(world, row.job_id!)!;
  const room = world.state.containers[p.crow_id];
  const scheduled =
    room === b.spec.home ? undefined : next(b, mint, world.state.clock, 'return', null);
  return accepted(
    world,
    'shooed',
    shooOps(b, room, p.crow_id, scheduled),
    [
      event(world, command, mint, 1, {
        type: 'shooed',
        crow_id: p.crow_id,
        item_id: row.item_id!,
        room_id: room,
      }),
    ],
    [{ key: b.spec.plan.scavenge!.narration.shoo }],
  );
};

function shooOps(
  b: Binding,
  room: EntityId,
  crow_id: EntityId,
  scheduled: ReturnType<typeof next> | undefined,
): DeltaOp[] {
  const row = b.row;
  return [
    {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: row.item_id!,
      source_id: crow_id,
      destination_id: room,
    },
    {
      op: 'job.cancel',
      writer_group: 0,
      job_id: row.job_id!,
      crow_member_id: crow_id,
      crow_generation: row.generation,
    },
    changed(b, scheduled?.value ?? empty(row)),
    ...(scheduled ? [scheduled.op] : []),
  ];
}
