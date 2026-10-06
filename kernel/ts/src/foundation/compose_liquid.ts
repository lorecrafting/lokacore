import type { DefinitionRef, DeltaOp, ErrorCode, LiquidRow } from '../contracts.gen.ts';
import { validate } from './validate.ts';
import type { Json } from './canonical.ts';
import { same, type State } from './compose.ts';

export function composeLiquid(
  op: Extract<DeltaOp, { op: 'liquid.set' }>,
  row: Json | undefined,
  state: State,
): { value: Json } | { code: ErrorCode } {
  const spec = (state.liquid_specs as any)?.[op.item_id];
  return liquidRowValid(row, spec) && liquidRowValid(op.to, spec) && same(row, op.from)
    ? { value: op.to }
    : { code: 'precondition_failed' };
}

export function liquidRowValid(
  row: unknown,
  spec: { capacity: number; kinds: readonly DefinitionRef[] } | undefined,
): row is LiquidRow {
  if (
    !spec ||
    !Number.isSafeInteger(spec.capacity) ||
    spec.capacity <= 0 ||
    spec.capacity > 2_147_483_647 ||
    !Array.isArray(spec.kinds) ||
    !row ||
    typeof row !== 'object' ||
    Array.isArray(row)
  )
    return false;
  const value = row as LiquidRow;
  return (
    Object.keys(value).length === 2 &&
    Object.hasOwn(value, 'kind') &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity >= 0 &&
    value.quantity <= spec.capacity &&
    (value.quantity === 0
      ? value.kind === null
      : validate('DefinitionRef', value.kind).length === 0 &&
        spec.kinds.some((kind) => same(kind, value.kind)))
  );
}
