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
  return (
    destination?.kind !== 'consumed' ||
    (known[op.entity_id]?.kind === 'item' &&
      (op.consumption === 'bandaged'
        ? known[op.entity_id]?.bandage === true
        : known[op.entity_id]?.edible === true) &&
      source?.kind === 'body')
  );
}
