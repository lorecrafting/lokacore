import { validate } from './validate.ts';
import { encode, type Json } from './canonical.ts';
import type { DeltaOp, EncounterRow } from '../contracts.gen.ts';
import type { State } from './compose.ts';
type Obj = { readonly [key: string]: Json };
const section = (state: State, name: string): Obj => (state[name] ?? {}) as Obj;
const key = (value: Json): string => encode(value);

/** Narrow pinned provenance guard for durable corpse identities; used again on save hydration. */
export function creationValid(identity: Json, state: State): boolean {
  if (validate('EntityIdentity', identity).length) return false;
  const i = identity as Obj;
  const origin = i.origin as Obj;
  const spawned = origin.kind === 'spawned';
  const population =
    spawned && (section(state, 'population_specs')[key(origin.by)] as Obj | undefined);
  const victim = section(state, 'known_entities')[origin.victim_id as string] as Obj | undefined;
  const template = section(state, 'corpse_templates')[key(i.definition)];
  return (
    !Object.hasOwn(section(state, 'known_entities'), i.id as string) &&
    !Object.hasOwn(section(state, 'containers'), i.id as string) &&
    i.scope === undefined &&
    i.audience === undefined &&
    (spawned
      ? !!population &&
        key(origin.bundle) === key(population.bundle) &&
        (origin.slot as number) <= (population.cap as number) &&
        key(i.definition) === key(population[origin.role as string]) &&
        (origin.role === 'hound' ? origin.member_id === i.id : origin.member_id !== i.id)
      : origin.kind === 'death' &&
        (template === 'player'
          ? victim?.kind === 'body' && origin.owner_id === victim.owner_id
          : template === 'npc' && victim?.kind === 'npc' && origin.owner_id === null))
  );
}

export function initialPair(op: DeltaOp, next: DeltaOp | undefined): boolean {
  return (
    op.op !== 'entity.create' ||
    (next?.op === 'entity.transfer' &&
      next.entity_id === op.identity.id &&
      next.source_id === null &&
      next.writer_group === op.writer_group)
  );
}

export function initialPlacement(
  op: DeltaOp & { op: 'entity.transfer' },
  row: Json | undefined,
  group: number | undefined,
  state: State,
  parent?: Json,
  identity?: Json,
): boolean {
  const child = (identity as Obj | undefined)?.origin as Obj | undefined;
  const holder = (parent as Obj | undefined)?.origin as Obj | undefined;
  return (
    row === undefined &&
    group === op.writer_group &&
    (((section(state, 'known_entities')[op.destination_id] as Obj | undefined)?.kind === 'room' &&
      !(child?.kind === 'spawned' && child.role === 'pelt') &&
      (child?.kind !== 'spawned' ||
        (section(state, 'population_specs')[key(child.by)] as Obj | undefined)?.home ===
          op.destination_id)) ||
      (child?.kind === 'spawned' &&
        child.role === 'pelt' &&
        holder?.kind === 'spawned' &&
        holder.role === 'hound' &&
        op.destination_id === holder.member_id &&
        key(child.by) === key(holder.by) &&
        key(child.bundle) === key(holder.bundle) &&
        child.slot === holder.slot &&
        child.generation === holder.generation &&
        child.occurrence_id === holder.occurrence_id &&
        child.member_id === holder.member_id))
  );
}

/** A final proposal must bind each spawned pair, HP and membership in its birth group. */
// size: allow 60, one final guard checks pair, HP and slot membership together
export function completeBirths(ops: readonly DeltaOp[], state: State): boolean {
  const made = ops.filter(
    (op): op is Extract<DeltaOp, { op: 'entity.create' }> =>
      op.op === 'entity.create' && op.identity.origin.kind === 'spawned',
  );
  const hounds = made.filter(
    (op) => op.identity.origin.kind === 'spawned' && op.identity.origin.role === 'hound',
  );
  const pelts = made.filter(
    (op) => op.identity.origin.kind === 'spawned' && op.identity.origin.role === 'pelt',
  );
  const slots = ops.filter(
    (op): op is Extract<DeltaOp, { op: 'population.slot' }> => op.op === 'population.slot',
  );
  if (hounds.length !== pelts.length) return false;
  for (const h of hounds) {
    const o = h.identity.origin;
    if (o.kind !== 'spawned') return false;
    const related = pelts.filter(
      (p) =>
        p.writer_group === h.writer_group &&
        p.identity.origin.kind === 'spawned' &&
        p.identity.origin.member_id === h.identity.id,
    );
    const slot = slots.filter(
      (s) =>
        s.writer_group === h.writer_group &&
        key(s.plan) === key(o.by) &&
        s.slot === o.slot &&
        s.value.generation === o.generation &&
        s.value.member_id === h.identity.id &&
        s.value.replacement_due === null,
    );
    const hp = ops.filter(
      (op) =>
        op.op === 'resource.initialize' &&
        op.writer_group === h.writer_group &&
        op.entity_id === h.identity.id,
    );
    if (related.length !== 1 || slot.length !== 1 || hp.length !== 1) return false;
  }
  return (
    birthSlotsMatch(slots, hounds, ops, state) &&
    pelts.every((p) =>
      hounds.some(
        (h) =>
          h.writer_group === p.writer_group &&
          p.identity.origin.kind === 'spawned' &&
          p.identity.origin.member_id === h.identity.id,
      ),
    )
  );
}

function birthSlotsMatch(
  slots: Extract<DeltaOp, { op: 'population.slot' }>[],
  hounds: Extract<DeltaOp, { op: 'entity.create' }>[],
  ops: readonly DeltaOp[],
  state: State,
) {
  return slots.every(
    (s) =>
      s.value.member_id === null ||
      s.value.replacement_due !== null ||
      hounds.some(
        (h) =>
          h.writer_group === s.writer_group &&
          h.identity.id === s.value.member_id &&
          h.identity.origin.kind === 'spawned' &&
          key(h.identity.origin.by) === key(s.plan) &&
          h.identity.origin.slot === s.slot &&
          h.identity.origin.generation === s.value.generation,
      ) ||
      flightSlot(s, ops, state),
  );
}

function flightSlot(
  s: Extract<DeltaOp, { op: 'population.slot' }>,
  ops: readonly DeltaOp[],
  state: State,
) {
  const id = s.value.member_id;
  const prior = s.expected;
  const origin =
    id && (((state.created ?? {}) as Record<string, Obj>)[id]?.origin as Obj | undefined);
  const spec = ((state.population_specs ?? {}) as Record<string, Obj>)[key(s.plan as Json)];
  const round = ops.find(
    (op) =>
      (op.op === 'encounter.advance' || op.op === 'encounter.close') &&
      op.writer_group === s.writer_group &&
      op.expected?.active_ids?.includes(id!) &&
      selectedFlight(op.expected, id!, state) &&
      (op.op === 'encounter.close' || !op.active_ids?.includes(id!)),
  );
  const due =
    round && 'job_id' in round
      ? ((state.jobs ?? {}) as Record<string, Obj>)[round.job_id]?.due_time
      : undefined;
  return (
    id !== null &&
    prior?.member_id === id &&
    prior.generation === s.value.generation &&
    prior.replacement_due === null &&
    s.value.replacement_due === null &&
    Number.isSafeInteger(due) &&
    s.value.last_flight_at === due &&
    prior.last_flight_at !== due &&
    origin?.kind === 'spawned' &&
    origin.role === 'hound' &&
    origin.member_id === id &&
    key(origin.by) === key(s.plan as Json) &&
    origin.slot === s.slot &&
    origin.generation === s.value.generation &&
    (spec?.plan as Obj | undefined)?.pack !== undefined &&
    ops.filter(
      (op) =>
        op.op === 'entity.transfer' &&
        op.writer_group === s.writer_group &&
        op.entity_id === id &&
        op.source_id === ((state.containers ?? {}) as Record<string, Json>)[id] &&
        op.destination_id !== op.source_id,
    ).length === 1
  );
}

function selectedFlight(row: EncounterRow, id: string, state: State) {
  const containers = (state.containers ?? {}) as Record<string, Json>;
  const created = (state.created ?? {}) as Record<string, Obj>;
  const slots = (state.population_slots ?? {}) as Record<string, Obj>;
  const present =
    row.active_ids?.filter((member) => {
      const origin = created[member]?.origin as Obj | undefined;
      const slot =
        origin && slots[key({ kind: 'population_slot', plan: origin.by, slot: origin.slot })];
      return (
        containers[member] === row.room_id &&
        origin?.kind === 'spawned' &&
        origin.role === 'hound' &&
        origin.member_id === member &&
        slot?.member_id === member &&
        slot.generation === origin.generation &&
        slot.replacement_due === null
      );
    }) ?? [];
  const cursor = row.next_opponent_id!;
  return (
    (present.includes(cursor)
      ? cursor
      : (present.find((member) => member > cursor) ?? present[0])) === id
  );
}
