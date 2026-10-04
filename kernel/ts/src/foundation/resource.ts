// Resource arithmetic for the portable delta algebra; invariant replay stays independent.
import type { Json } from './canonical.ts';
import type { DeltaOp, ResourceSpec, ErrorCode } from '../contracts.gen.ts';
type Outcome = { value: Json } | { code: ErrorCode };

/** Stored resource value/time, with rate and fraction required by opted recovery. */
export type Stored = {
  readonly value: number;
  readonly at: number;
  readonly rate?: number;
  readonly remainder?: number;
};
type Recovering = Stored & { readonly rate: number; readonly remainder: number };

// Only opted rows have fractions; legacy rows retain their frozen hourly semantics.
function settled(row: Stored | undefined, spec: ResourceSpec, now: number): Recovering | undefined {
  const regen = spec.regen!;
  if (
    !row ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isInteger(row.value) ||
    row.value < spec.minimum ||
    row.value > spec.maximum ||
    !Number.isSafeInteger(row.at) ||
    row.at < 0 ||
    row.at > now ||
    !Number.isInteger(row.rate) ||
    !Object.values(regen.by_position).includes(row.rate!) ||
    !Number.isSafeInteger(row.remainder) ||
    row.remainder! < 0 ||
    row.remainder! >= regen.every ||
    (row.value === spec.maximum && row.remainder !== 0)
  )
    return undefined;
  const { value, rate, remainder } = row as Recovering;
  const dt = now - row.at;
  const whole = Math.floor(dt / regen.every);
  const room = spec.maximum - value;
  if (value === spec.maximum || (rate > 0 && whole >= Math.ceil(room / rate)))
    return { value: spec.maximum, at: now, rate, remainder: 0 };
  const numerator = remainder + (dt % regen.every) * rate;
  const gained = whole * rate + Math.floor(numerator / regen.every);
  const next = value + gained;
  return {
    value: Math.min(spec.maximum, next),
    at: now,
    rate,
    remainder: next >= spec.maximum ? 0 : numerator % regen.every,
  };
}

/**
 * A resource's current value at `now` (ResourceSpec regeneration): the stored value (start at
 * time 0 when unset) plus gain for each hour boundary crossed since it was stored, stopping at
 * maximum for legacy rows. Their product past 2^53 is still above maximum. Opted rows
 * settle exact fractional credit using the old stored rate, returning NaN for corrupt rows.
 */
export function current(row: Stored | undefined, spec: ResourceSpec, now: number): number {
  if (spec.regen) return settled(row, spec, now)?.value ?? NaN;
  const { value, at } = row ?? { value: spec.start, at: 0 };
  const ticks = Math.floor(now / 3600) - Math.floor(at / 3600);
  return Math.min(spec.maximum, value + spec.gain * ticks);
}

// `from` is the resource's current (regenerated) value and `to` within its spec's bounds.
export function adjusted(
  op: DeltaOp & { op: 'resource.adjust' },
  row: Stored | undefined,
  spec: ResourceSpec | undefined,
  now: number,
): Outcome {
  if (!spec || !Number.isInteger(op.to) || op.to < spec.minimum || op.to > spec.maximum)
    return { code: 'precondition_failed' };
  if (spec.regen) {
    const before = settled(row, spec, now);
    if (
      !before ||
      before.value !== op.from ||
      (op.next_rate !== undefined &&
        (!Number.isInteger(op.next_rate) ||
          !Object.values(spec.regen.by_position).includes(op.next_rate)))
    )
      return { code: 'precondition_failed' };
    return {
      value: {
        value: op.to,
        at: now,
        rate: op.next_rate ?? before.rate,
        remainder: op.to === spec.maximum ? 0 : before.remainder,
      },
    };
  }
  return op.next_rate === undefined && current(row, spec, now) === op.from
    ? { value: { value: op.to, at: now } }
    : { code: 'precondition_failed' };
}
