import { validate } from '../foundation/validate.ts';
import { same } from '../foundation/compose.ts';

// Independent shape/capacity checks against the committed immutable specifications.
function valid(row: any, spec: any): boolean {
  if (
    !row ||
    !spec ||
    !Number.isSafeInteger(spec.capacity) ||
    spec.capacity < 1 ||
    spec.capacity > 2_147_483_647 ||
    !Array.isArray(spec.kinds) ||
    Object.keys(row).length !== 2 ||
    !Object.hasOwn(row, 'kind')
  )
    return false;
  const q = row.quantity;
  if (!Number.isSafeInteger(q) || q < 0 || q > spec.capacity) return false;
  return q === 0
    ? row.kind === null
    : validate('DefinitionRef', row.kind).length === 0 &&
        spec.kinds.some((kind: any) => same(kind, row.kind));
}

export function liquidRowsValid(state: any, result: any): boolean {
  if ('fault' in result) return true;
  const specs = state.liquid_specs ?? {};
  const rows = state.liquids ?? {};
  return (
    Object.keys(specs).every((id) => Object.hasOwn(rows, id)) &&
    Object.entries(rows).every(([id, row]) => valid(row, specs[id])) &&
    result.changes.every(
      (row: any) => row.target.kind !== 'liquid' || valid(row.value, specs[row.target.item_id]),
    )
  );
}

// Independent ordered preconditions and final-row proof, including both Pour participants.
export function liquidsHold(state: any, ops: any[], result: any): boolean {
  const written = new Map<string, any>();
  for (const op of ops) {
    if (op.op !== 'liquid.set') continue;
    const before = written.has(op.item_id) ? written.get(op.item_id) : state.liquids?.[op.item_id];
    const spec = state.liquid_specs?.[op.item_id];
    if (!valid(before, spec) || !valid(op.to, spec) || !same(before, op.from)) return false;
    written.set(op.item_id, op.to);
  }
  return [...written].every(([id, value]) =>
    result.changes.some(
      (row: any) =>
        row.target.kind === 'liquid' && row.target.item_id === id && same(row.value, value),
    ),
  );
}
