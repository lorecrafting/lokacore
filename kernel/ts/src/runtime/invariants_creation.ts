// Independent creation/initial-custody proof, without compose's creation guard or result oracle.
import { validate } from '../foundation/validate.ts';
import { key, same } from '../foundation/compose.ts';

// Decoded portable observations, as in invariants.ts.
type Any = any;
// size: allow 45, one independent pass covers paired placement, origin and result rows
export function creationsHold(state: Any, ops: Any[], result: Any): boolean {
  const made = new Set<string>();
  const identities = new Map<string, Any>();
  for (const [index, op] of ops.entries()) {
    if (op.op === 'resource.initialize' && !initialized(state, ops, result, op, identities))
      return false;
    if (op.op === 'entity.transfer' && op.source_id === null) {
      const previous = ops[index - 1];
      if (
        previous?.op !== 'entity.create' ||
        previous.identity.id !== op.entity_id ||
        previous.writer_group !== op.writer_group ||
        ((state.known_entities?.[op.destination_id]?.kind !== 'room' ||
          previous.identity.origin?.role === 'pelt' ||
          (previous.identity.origin?.kind === 'spawned' &&
            state.population_specs?.[key(previous.identity.origin.by)]?.home !==
              op.destination_id)) &&
          !paired(identities.get(op.destination_id), previous.identity))
      )
        return false;
    }
    if (op.op !== 'entity.create') continue;
    const i = op.identity;
    if (validate('EntityIdentity', i).length || i.scope !== undefined || i.audience !== undefined)
      return false;
    const next = ops[index + 1];
    if (
      made.has(i.id) ||
      state.created?.[i.id] !== undefined ||
      state.known_entities?.[i.id] !== undefined ||
      state.containers?.[i.id] !== undefined ||
      next?.op !== 'entity.transfer' ||
      next.entity_id !== i.id ||
      next.source_id !== null ||
      next.writer_group !== op.writer_group
    )
      return false;
    if (!provenance(state, i)) return false;
    if (!rowsMatch(result, i)) return false;
    made.add(i.id);
    identities.set(i.id, i);
  }
  return complete(ops);
}

// size: allow 60, independent pair, HP and slot proof mirrors the contract
function complete(ops: Any[]): boolean {
  const hounds = ops.filter(
    (op) =>
      op.op === 'entity.create' &&
      op.identity.origin?.kind === 'spawned' &&
      op.identity.origin.role === 'hound',
  );
  const pelts = ops.filter(
    (op) =>
      op.op === 'entity.create' &&
      op.identity.origin?.kind === 'spawned' &&
      op.identity.origin.role === 'pelt',
  );
  const slots = ops.filter((op) => op.op === 'population.slot');
  if (hounds.length !== pelts.length) return false;
  for (const h of hounds) {
    const origin = h.identity.origin;
    if (
      pelts.filter(
        (p) => p.writer_group === h.writer_group && p.identity.origin.member_id === h.identity.id,
      ).length !== 1 ||
      ops.filter(
        (op) =>
          op.op === 'resource.initialize' &&
          op.writer_group === h.writer_group &&
          op.entity_id === h.identity.id,
      ).length !== 1 ||
      slots.filter(
        (op) =>
          op.writer_group === h.writer_group &&
          same(op.plan, origin.by) &&
          op.slot === origin.slot &&
          op.value.generation === origin.generation &&
          op.value.member_id === h.identity.id &&
          op.value.replacement_due === null,
      ).length !== 1
    )
      return false;
  }
  return (
    slots.every(
      (s) =>
        s.value.member_id === null ||
        s.value.replacement_due !== null ||
        !hounds.some((h) => h.writer_group === s.writer_group) ||
        hounds.some(
          (h) =>
            h.writer_group === s.writer_group &&
            h.identity.id === s.value.member_id &&
            h.identity.origin.slot === s.slot,
        ),
    ) &&
    pelts.every((p) =>
      hounds.some(
        (h) => h.writer_group === p.writer_group && p.identity.origin.member_id === h.identity.id,
      ),
    )
  );
}

function initialized(
  state: Any,
  ops: Any[],
  result: Any,
  op: Any,
  identities: Map<string, Any>,
): boolean {
  const i = identities.get(op.entity_id);
  const origin = i?.origin;
  const spec = origin?.kind === 'spawned' && state.population_specs?.[key(origin.by)];
  const resource = { ...origin?.by, kind: 'resource', key: 'hp' };
  const target = { kind: 'resource', resource: op.resource, entity_id: op.entity_id };
  if (
    !i ||
    origin.role !== 'hound' ||
    origin.member_id !== op.entity_id ||
    !spec ||
    op.writer_group !==
      ops.find((x: Any) => x.op === 'entity.create' && x.identity.id === op.entity_id)
        ?.writer_group ||
    !same(op.resource, resource) ||
    op.value !== spec.hp.start ||
    op.at < state.clock ||
    op.at >
      Math.max(
        state.clock,
        ...ops.filter((x: Any) => x.op === 'time.advance').map((x: Any) => x.to),
      ) ||
    state.resources?.[key(target)] !== undefined ||
    !result.changes.some(
      (c: Any) => same(c.target, target) && same(c.value, { value: op.value, at: op.at }),
    )
  )
    return false;
  return true;
}

function provenance(state: Any, i: Any): boolean {
  if (i.origin.kind === 'spawned') {
    const spec = state.population_specs?.[key(i.origin.by)];
    return (
      !!spec &&
      same(i.origin.bundle, spec.bundle) &&
      i.origin.slot <= spec.cap &&
      same(i.definition, spec[i.origin.role]) &&
      (i.origin.role === 'hound' ? i.origin.member_id === i.id : i.origin.member_id !== i.id)
    );
  }
  const victim = state.known_entities?.[i.origin.victim_id];
  const template = state.corpse_templates?.[key(i.definition)];
  return (
    i.origin.kind === 'death' &&
    (template === 'player'
      ? victim?.kind === 'body' && i.origin.owner_id === victim.owner_id
      : template === 'npc' && victim?.kind === 'npc' && i.origin.owner_id === null)
  );
}

function paired(parent: Any, child: Any): boolean {
  const a = parent?.origin,
    b = child?.origin;
  return (
    a?.kind === 'spawned' &&
    a.role === 'hound' &&
    b?.kind === 'spawned' &&
    b.role === 'pelt' &&
    parent.id === b.member_id &&
    ['by', 'bundle', 'slot', 'generation', 'occurrence_id', 'member_id'].every((field) =>
      same(a[field], b[field]),
    )
  );
}

function rowsMatch(result: Any, i: Any): boolean {
  return (
    result.changes.some(
      (c: Any) => c.target.kind === 'entity' && c.target.entity_id === i.id && same(c.value, i),
    ) &&
    result.changes.some((c: Any) => c.target.kind === 'containment' && c.target.entity_id === i.id)
  );
}
