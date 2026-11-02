// Independent precondition observation; does not call composition.
export function foodTransferValid(op: Record<string, any>, state: Record<string, any>): boolean {
  const known = state.known_entities ?? {};
  const source = known[op.source_id],
    destination = known[op.destination_id];
  if (
    known[op.entity_id]?.kind === 'consumed' ||
    source?.kind === 'consumed' ||
    (op.consumption === 'bandaged' && destination?.kind !== 'consumed')
  )
    return false;
  // death@1 decay: a death-created corpse leaves its room for the consumed holder.
  const decayed =
    op.consumption === undefined &&
    state.created?.[op.entity_id]?.origin?.kind === 'death' &&
    source?.kind === 'room';
  return (
    destination?.kind !== 'consumed' ||
    decayed ||
    (known[op.entity_id]?.kind === 'item' &&
      (op.consumption === 'bandaged'
        ? known[op.entity_id]?.bandage === true
        : known[op.entity_id]?.edible === true) &&
      source?.kind === 'body')
  );
}
