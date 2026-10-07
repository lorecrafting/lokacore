import type {
  CrowTransport,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EntityId,
  JobId,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { add } from '../../foundation/int.ts';
import { KernelError } from '../../foundation/error.ts';
import { bodyOf, refString, type Mint, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { engaged } from '../combat/shared.ts';
import { changed, empty, planRef, schedule, target, type Plan } from './shared.ts';
/** A committed player Drop binds the lowest present idle crow to the exact direct room root. */
export function dropped(world: World, cause: DomainEvent, mint: Mint): DeltaOp[] {
  if (cause.payload.type !== 'item_dropped' || !cause.actor_id) return [];
  const { item_id, room_id } = cause.payload;
  if (world.state.containers[item_id] !== room_id) return [];
  const choices = eligible(world, item_id, room_id);
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

function eligible(world: World, item_id: EntityId, room_id: EntityId) {
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
  return choices;
}
