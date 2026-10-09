import type {
  CrowTransport,
  DefinitionRef,
  DeltaOp,
  EntityId,
  JobId,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { add } from '../../foundation/int.ts';
import { KernelError } from '../../foundation/error.ts';
import { refString, type Mint, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { passage } from '../movement/shared.ts';
import { barrierState } from '../lookups.ts';
export type Plan = World['populationSpecs'][string];
export type Binding = { plan: DefinitionRef; slot: number; row: CrowTransport; spec: Plan };
export const target = (plan: DefinitionRef, slot: number) => key({ kind: 'crow', plan, slot });
export const planRef = (world: World, name: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: name as DefinitionRef['key'],
});
export const empty = (row: CrowTransport): CrowTransport => ({
  phase: 'idle',
  member_id: row.member_id,
  generation: row.generation,
  item_id: null,
  nest_id: null,
  job_id: null,
  drop_event_id: null,
  encounter_id: null,
});
export const changed = (b: Binding, value: CrowTransport): DeltaOp => ({
  op: 'crow.transition',
  writer_group: 0,
  plan: b.plan,
  slot: b.slot,
  expected: b.row,
  value,
});
export const schedule = (
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
export const next = (
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

export function current(world: World, b: Binding): boolean {
  const slot =
    world.state.population_slots?.[key({ kind: 'population_slot', plan: b.plan, slot: b.slot })];
  return (
    slot?.member_id === b.row.member_id &&
    slot.generation === b.row.generation &&
    slot.replacement_due === null &&
    living(world, b.row.member_id)
  );
}

export const rootRoom = (world: World, b: Binding) => world.state.containers[b.row.member_id];
export const held = (world: World, b: Binding) =>
  b.row.item_id !== null && world.state.containers[b.row.item_id] === b.row.member_id;
export const corridor = (world: World, b: Binding) =>
  b.spec.plan.scavenge!.corridor.map((r) => world.roomIds[refString(r)]);
export function openNest(world: World, b: Binding) {
  const nest = b.row.nest_id!;
  const rooms = corridor(world, b);
  const item = world.entities[nest];
  const barrier = item?.kind === 'item' && item.barrier;
  return (
    world.state.containers[nest] === rooms.at(-1) &&
    (!barrier || barrierState(world, barrier) === 'open') &&
    Object.values(world.state.containers).filter((holder) => holder === nest).length <
      world.capacities[nest]
  );
}
export function edge(world: World, from: EntityId, to: EntityId): boolean {
  const room = world.rooms[from];
  const found = Object.entries(room.exits).find(([, x]) => world.roomIds[refString(x.to)] === to);
  return !!found && !passage(world, room, found[0] as never);
}
