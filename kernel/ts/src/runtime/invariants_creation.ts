// Independent creation/initial-custody proof, without compose's creation guard or result oracle.
import { validate } from '../foundation/validate.ts';
import { key, same } from '../foundation/compose.ts';

// Decoded portable observations, as in invariants.ts.
type Any = any;
export function creationsHold(state: Any, ops: Any[], result: Any): boolean {
  const made = new Set<string>();
  for (const [index, op] of ops.entries()) {
    if (op.op === 'entity.transfer' && op.source_id === null) {
      const previous = ops[index - 1];
      if (
        previous?.op !== 'entity.create' ||
        previous.identity.id !== op.entity_id ||
        previous.writer_group !== op.writer_group ||
        state.known_entities?.[op.destination_id]?.kind !== 'room'
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
  }
  return true;
}

function provenance(state: Any, i: Any): boolean {
  const victim = state.known_entities?.[i.origin.victim_id];
  const template = state.corpse_templates?.[key(i.definition)];
  return (
    i.origin.kind === 'death' &&
    (template === 'player'
      ? victim?.kind === 'body' && i.origin.owner_id === victim.owner_id
      : template === 'npc' && victim?.kind === 'npc' && i.origin.owner_id === null)
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
