import type {
  Command,
  CrowTransport,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EncounterId,
  EntityId,
  EventPayload,
  JobId,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { add } from '../../foundation/int.ts';
import { KernelError } from '../../foundation/error.ts';
import {
  accepted,
  bodyOf,
  event,
  refString,
  rejected,
  type JobRow,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { engaged } from '../combat/shared.ts';
import { passage } from '../movement/shared.ts';
import { entered } from '../schedule/behavior.ts';
import { standing } from '../position/shared.ts';

type Plan = World['populationSpecs'][string];
type Binding = { plan: DefinitionRef; slot: number; row: CrowTransport; spec: Plan };
const target = (plan: DefinitionRef, slot: number) => key({ kind: 'crow', plan, slot });
const planRef = (world: World, name: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: name as DefinitionRef['key'],
});
const empty = (row: CrowTransport): CrowTransport => ({
  phase: 'idle',
  member_id: row.member_id,
  generation: row.generation,
  item_id: null,
  nest_id: null,
  job_id: null,
  drop_event_id: null,
  encounter_id: null,
});
const changed = (b: Binding, value: CrowTransport): DeltaOp => ({
  op: 'crow.transition',
  writer_group: 0,
  plan: b.plan,
  slot: b.slot,
  expected: b.row,
  value,
});
const schedule = (
  b: Binding,
  job_id: JobId,
  due_time: number,
  crow_phase: 'acquire' | 'leg' | 'return',
): DeltaOp => ({
  op: 'job.schedule',
  writer_group: 0,
  job_id,
  job: b.spec.bundle,
  due_time,
  crow_member_id: b.row.member_id,
  crow_generation: b.row.generation,
  crow_phase,
});
const next = (
  b: Binding,
  mint: Mint,
  at: number,
  phase: 'acquire' | 'leg' | 'return',
  item_id: EntityId | null,
) => {
  const job_id = mint() as JobId;
  const due_time = add(at, b.spec.plan.scavenge!.interval);
  return {
    value: { ...b.row, phase, item_id, job_id, encounter_id: null } as CrowTransport,
    op: schedule(b, job_id, due_time, phase),
  };
};

/** A committed player Drop binds the lowest present idle crow to the exact direct room root. */
export function dropped(world: World, cause: DomainEvent, mint: Mint): DeltaOp[] {
  if (cause.payload.type !== 'item_dropped' || !cause.actor_id) return [];
  const { item_id, room_id } = cause.payload;
  if (world.state.containers[item_id] !== room_id) return [];
  const choices: {
    id: EntityId;
    plan: DefinitionRef;
    slot: number;
    row: CrowTransport | null;
    spec: Plan;
  }[] = [];
  for (const p of Object.values(world.cartridge.populations ?? {})) {
    const s = p.scavenge;
    if (
      !s ||
      !s.drop_rooms.some((r) => world.roomIds[refString(r)] === room_id) ||
      !s.items.some((r) => world.entityIds[refString(r)] === item_id)
    )
      continue;
    const plan = planRef(world, p.key);
    const spec = world.populationSpecs[key(plan)];
    for (let slot = 1; slot <= p.cap; slot++) {
      const member = world.state.population_slots?.[key({ kind: 'population_slot', plan, slot })];
      const id = member?.member_id;
      const row = world.state.crows?.[target(plan, slot)] ?? null;
      if (
        !id ||
        member.replacement_due !== null ||
        world.state.containers[id] !== room_id ||
        !living(world, id) ||
        engaged(world, id) ||
        (row && row.phase !== 'idle')
      )
        continue;
      choices.push({ id, plan, slot, row, spec });
    }
  }
  choices.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const choice = choices[0];
  if (!choice) return [];
  const member =
    world.state.population_slots![
      key({ kind: 'population_slot', plan: choice.plan, slot: choice.slot })
    ]!;
  const job_id = mint() as JobId;
  const value: CrowTransport = {
    phase: 'acquire',
    member_id: choice.id,
    generation: member.generation,
    item_id,
    nest_id: world.entityIds[refString(choice.spec.plan.scavenge!.nest)],
    job_id,
    drop_event_id: cause.id,
    encounter_id: null,
  };
  return [
    {
      op: 'crow.transition',
      writer_group: 0,
      plan: choice.plan,
      slot: choice.slot,
      expected: choice.row,
      value,
    },
    schedule(
      { ...choice, row: value },
      job_id,
      add(cause.logical_time, choice.spec.plan.scavenge!.interval),
      'acquire',
    ),
  ];
}

/** A player Take before acquisition invalidates that exact Drop intent. */
export function taken(world: World, cause: DomainEvent): DeltaOp[] {
  if (
    cause.payload.type !== 'item_acquired' ||
    !cause.actor_id ||
    cause.payload.holder_id !== bodyOf(world, cause.actor_id)
  )
    return [];
  for (const row of Object.values(world.state.crows ?? {})) {
    if (row.phase !== 'acquire' || row.item_id !== cause.payload.item_id) continue;
    const origin = world.state.created?.[row.member_id]?.origin;
    if (origin?.kind !== 'spawned') throw new KernelError('precondition_failed');
    return [
      changed(
        { plan: origin.by, slot: origin.slot, row, spec: world.populationSpecs[key(origin.by)] },
        empty(row),
      ),
    ];
  }
  return [];
}

export function binding(world: World, job_id: JobId): Binding | undefined {
  for (const [at, row] of Object.entries(world.state.crows ?? {})) {
    if (row.job_id !== job_id) continue;
    const origin = world.state.created?.[row.member_id]?.origin;
    if (
      origin?.kind !== 'spawned' ||
      origin.role !== 'hound' ||
      target(origin.by, origin.slot) !== at ||
      origin.generation !== row.generation
    )
      throw new KernelError('precondition_failed');
    const spec = world.populationSpecs[key(origin.by)];
    if (!spec?.plan.scavenge) throw new KernelError('precondition_failed');
    return { plan: origin.by, slot: origin.slot, row, spec };
  }
}

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
    [
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: row.item_id!,
        source_id: p.crow_id,
        destination_id: room,
      },
      {
        op: 'job.cancel',
        writer_group: 0,
        job_id: row.job_id!,
        crow_member_id: p.crow_id,
        crow_generation: row.generation,
      },
      changed(b, scheduled?.value ?? empty(row)),
      ...(scheduled ? [scheduled.op] : []),
    ],
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

function current(world: World, b: Binding): boolean {
  const slot =
    world.state.population_slots?.[key({ kind: 'population_slot', plan: b.plan, slot: b.slot })];
  return (
    slot?.member_id === b.row.member_id &&
    slot.generation === b.row.generation &&
    slot.replacement_due === null &&
    living(world, b.row.member_id)
  );
}

const rootRoom = (world: World, b: Binding) => world.state.containers[b.row.member_id];
const held = (world: World, b: Binding) =>
  b.row.item_id !== null && world.state.containers[b.row.item_id] === b.row.member_id;
const corridor = (world: World, b: Binding) =>
  b.spec.plan.scavenge!.corridor.map((r) => world.roomIds[refString(r)]);
function openNest(world: World, b: Binding) {
  const nest = b.row.nest_id!;
  const rooms = corridor(world, b);
  const item = world.entities[nest];
  const barrier = item?.kind === 'item' && item.barrier;
  return (
    world.state.containers[nest] === rooms.at(-1) &&
    (!barrier ||
      (world.state.barriers?.[key({ kind: 'barrier', barrier })] ??
        world.barrierInitial[key(barrier)]) === 'open') &&
    Object.values(world.state.containers).filter((holder) => holder === nest).length <
      world.capacities[nest]
  );
}
function edge(world: World, from: EntityId, to: EntityId): boolean {
  const room = world.rooms[from];
  const found = Object.entries(room.exits).find(([, x]) => world.roomIds[refString(x.to)] === to);
  return !!found && !passage(world, room, found[0] as never);
}
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

/** One due crow job, using ordinary checked transfers and a bounded declared corridor. */
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
  const s = b.spec.plan.scavenge!;
  const room = rootRoom(world, b);
  const route = corridor(world, b);
  const index = route.indexOf(room);
  if (index < 0) throw new KernelError('precondition_failed');
  const item = b.row.item_id;
  if (b.row.phase === 'acquire') {
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
  if (b.row.phase === 'leg') {
    if (!held(world, b))
      return accepted<never>(world, 'job_ran', [done, changed(b, empty(b.row))], []);
    if (!openNest(world, b) || (index < route.length - 1 && !edge(world, room, route[index + 1]))) {
      const scheduled =
        room === b.spec.home ? undefined : next(b, mint, job.due_time, 'return', null);
      return accepted<never>(
        world,
        'job_ran',
        [
          done,
          {
            op: 'entity.transfer',
            writer_group: 0,
            entity_id: item!,
            source_id: b.row.member_id,
            destination_id: room,
          },
          changed(b, scheduled?.value ?? empty(b.row)),
          ...(scheduled ? [scheduled.op] : []),
        ],
        [],
        [{ key: s.narration.fallback }],
      );
    }
    if (index === route.length - 1) {
      const scheduled =
        room === b.spec.home ? undefined : next(b, mint, job.due_time, 'return', null);
      return accepted<never>(
        world,
        'job_ran',
        [
          done,
          {
            op: 'entity.transfer',
            writer_group: 0,
            entity_id: item!,
            source_id: b.row.member_id,
            destination_id: b.row.nest_id!,
          },
          changed(b, scheduled?.value ?? empty(b.row)),
          ...(scheduled ? [scheduled.op] : []),
        ],
        [],
        [{ key: s.narration.delivered }],
      );
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
