// Independent pack admission, rotation and member-exit proof.
import { key, same } from '../foundation/compose.ts';
type Any = any;

export function advancePack(
  op: Any,
  row: Any,
  containers: Map<string, Any>,
  slots: Map<string, Any>,
  state: Any,
  preceding: Any[],
) {
  return (
    Array.isArray(op.active_ids) &&
    !!op.active_ids.length &&
    !op.active_ids.some(
      (id: string, i: number) =>
        !row.active_ids.includes(id) || (i > 0 && op.active_ids[i - 1] >= id),
    ) &&
    op.active_ids.includes(op.npc_id) &&
    op.active_ids.includes(op.next_opponent_id) &&
    row.active_ids.every(
      (id: string) =>
        op.active_ids.includes(id) ===
        memberRemains(
          id,
          row.room_id,
          op.writer_group,
          state,
          containers,
          slots,
          preceding,
          state.jobs?.[op.job_id]?.due_time,
        ),
    ) &&
    rotationHolds(op, row, state)
  );
}

function rotationHolds(op: Any, row: Any, state: Any) {
  const starting = row.active_ids.filter((id: string) =>
    memberInitiallyPresent(id, row.room_id, state),
  );
  const selected = starting.includes(row.next_opponent_id)
    ? row.next_opponent_id
    : (starting.find((id: string) => id > row.next_opponent_id) ?? starting[0]);
  return (
    !!selected &&
    op.npc_id === (op.active_ids.includes(row.npc_id) ? row.npc_id : op.active_ids[0]) &&
    op.next_opponent_id === (op.active_ids.find((id: string) => id > selected) ?? op.active_ids[0])
  );
}

function memberInitiallyPresent(id: string, room: string, state: Any) {
  const origin = state.created?.[id]?.origin;
  const slot =
    origin?.kind === 'spawned' &&
    state.population_slots?.[
      key({
        kind: 'population_slot',
        plan: origin.by,
        slot: origin.slot,
      })
    ];
  return (
    state.containers?.[id] === room &&
    slot?.member_id === id &&
    slot.generation === origin.generation &&
    slot.replacement_due === null
  );
}

function memberRemains(
  id: string,
  room: string,
  group: number,
  state: Any,
  containers: Map<string, Any>,
  slots: Map<string, Any>,
  preceding: Any[],
  due: number | undefined,
) {
  const origin = state.created?.[id]?.origin;
  if (origin?.kind !== 'spawned' || !memberInitiallyPresent(id, room, state)) return false;
  const slotKey = key({ kind: 'population_slot', plan: origin.by, slot: origin.slot });
  const before = state.population_slots?.[slotKey];
  const slot = slots.get(slotKey);
  if (
    containers.get(id) === room &&
    slot?.member_id === id &&
    slot.generation === origin.generation &&
    slot.replacement_due === null
  )
    return true;
  return !memberDeparted(id, room, group, origin, before, slot, containers, preceding, due);
}

function memberDeparted(
  id: string,
  room: string,
  group: number,
  origin: Any,
  before: Any,
  slot: Any,
  containers: Map<string, Any>,
  preceding: Any[],
  due: number | undefined,
) {
  const reverse = [...preceding].reverse();
  const slotOp = reverse.find(
    (x: Any) =>
      x.op === 'population.slot' &&
      key({ kind: 'population_slot', plan: x.plan, slot: x.slot }) ===
        key({ kind: 'population_slot', plan: origin.by, slot: origin.slot }),
  );
  if (slotOp?.writer_group !== group) return false;
  const move = reverse.find((x: Any) => x.op === 'entity.transfer' && x.entity_id === id);
  const hp = reverse.find(
    (x: Any) =>
      x.op === 'resource.adjust' &&
      x.entity_id === id &&
      same(x.resource, { ...origin.by, kind: 'resource', key: 'hp' }),
  );
  const flew =
    move?.writer_group === group &&
    move.destination_id !== move.source_id &&
    containers.get(id) !== room &&
    Number.isSafeInteger(due) &&
    slot?.last_flight_at === due &&
    before?.last_flight_at !== due &&
    slot?.replacement_due === null;
  return flew || (hp?.writer_group === group && slot?.replacement_due !== null && hp?.to === 0);
}

export function packMembers(op: Any, state: Any, containers: Map<string, Any>) {
  const ids = op.active_ids;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 64 ||
    !ids.includes(op.npc_id) ||
    op.next_opponent_id !== op.npc_id ||
    ids.some((id: string, i: number) => i > 0 && ids[i - 1] >= id)
  )
    return false;
  const origin = state.created?.[op.npc_id]?.origin;
  if (origin?.kind !== 'spawned' || origin.role !== 'hound') return false;
  const spec = state.population_specs?.[key(origin.by)];
  if (!spec?.plan?.pack || !Number.isSafeInteger(spec.cap) || ids.length > spec.cap) return false;
  return ids.every((id: string) => {
    const member = state.created?.[id]?.origin;
    const slot =
      member &&
      state.population_slots?.[
        key({ kind: 'population_slot', plan: member.by, slot: member.slot })
      ];
    return (
      state.known_entities?.[id]?.kind === 'npc' &&
      containers.get(id) === op.room_id &&
      member?.kind === 'spawned' &&
      member.role === 'hound' &&
      member.member_id === id &&
      same(member.by, origin.by) &&
      slot?.member_id === id &&
      slot.generation === member.generation &&
      slot.replacement_due === null
    );
  });
}
