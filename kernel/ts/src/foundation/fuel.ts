import type { Json } from './canonical.ts';
import type { DeltaOp, FuelRow, FuelSpec } from '../contracts.gen.ts';

/** A stored interval is independent of custody; exhaust before multiplying a large interval. */
export function fuelAt(row: FuelRow, spec: FuelSpec, now: number): FuelRow {
  const elapsed = now - row.at;
  const remaining =
    row.lit && spec.kind === 'source'
      ? elapsed >= Math.ceil(row.remaining / spec.rate)
        ? 0
        : row.remaining - elapsed * spec.rate
      : row.remaining;
  return { remaining, at: now, lit: row.lit && remaining > 0 };
}

export function validFuel(row: unknown, spec: FuelSpec | undefined, now: number): row is FuelRow {
  if (
    !row ||
    typeof row !== 'object' ||
    !spec ||
    !['source', 'supply'].includes(spec.kind) ||
    !Number.isSafeInteger(spec.capacity) ||
    spec.capacity <= 0
  )
    return false;
  const r = row as FuelRow;
  return (
    Object.keys(r).length === 3 &&
    Number.isSafeInteger(r.remaining) &&
    r.remaining >= 0 &&
    r.remaining <= spec.capacity &&
    Number.isSafeInteger(r.at) &&
    r.at >= 0 &&
    r.at <= now &&
    typeof r.lit === 'boolean' &&
    (spec.kind === 'source' || !r.lit)
  );
}

export function composeFuel(
  op: Extract<DeltaOp, { op: 'fuel.set' }>,
  row: unknown,
  state: { readonly clock: number; readonly [section: string]: unknown },
) {
  const spec = (state.fuel_specs as Record<string, FuelSpec> | undefined)?.[op.item_id];
  const valid =
    validFuel(row, spec, state.clock) &&
    validFuel(op.from, spec, state.clock) &&
    row.remaining === op.from.remaining &&
    row.at === op.from.at &&
    row.lit === op.from.lit &&
    validFuel(op.to, spec, state.clock) &&
    op.to.at === state.clock;
  return valid ? { value: op.to as unknown as Json } : { code: 'precondition_failed' as const };
}
