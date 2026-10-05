import { key, target } from '../foundation/compose.ts';
import type { Json } from '../foundation/canonical.ts';
// Decoded observations, independently replayed like the Elixir twin.
type Any = any;

// Independent opted-row replay; never call composition's current/settlement helper.
function valid(op: Any, spec: Any, row: Any, now: number): boolean {
  const { every, by_position: rates } = spec.regen;
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
    !Object.values(rates).includes(row.rate) ||
    !Number.isSafeInteger(row.remainder) ||
    row.remainder < 0 ||
    row.remainder >= every ||
    (row.value === spec.maximum && row.remainder !== 0) ||
    !Number.isInteger(op.to) ||
    op.to < spec.minimum ||
    op.to > spec.maximum ||
    (op.next_rate !== undefined &&
      (!Number.isInteger(op.next_rate) || !Object.values(rates).includes(op.next_rate)))
  )
    return false;
  return true;
}

export function recovered(op: Any, spec: Any, row: Any, now: number): Json | undefined {
  if (!valid(op, spec, row, now)) return undefined;
  const { every } = spec.regen;
  const intervals = Math.floor((now - row.at) / every);
  const space = spec.maximum - row.value;
  let value = row.value;
  let fraction = row.remainder;
  if (space === 0 || (row.rate > 0 && intervals >= Math.ceil(space / row.rate))) {
    value = spec.maximum;
    fraction = 0;
  } else {
    const credit = fraction + ((now - row.at) % every) * row.rate;
    value += intervals * row.rate + Math.floor(credit / every);
    fraction = value >= spec.maximum ? 0 : credit % every;
    value = Math.min(spec.maximum, value);
  }
  return value === op.from
    ? {
        value: op.to,
        at: now,
        rate: op.next_rate ?? row.rate,
        remainder: op.to === spec.maximum ? 0 : fraction,
      }
    : undefined;
}

export const effectiveSpec = (op: Any, s: Any) =>
  s.entity_resource_specs?.[key(target(op))] ?? s.resource_specs?.[key(op.resource)];

// Legacy rows also retain timestamps in the replay overlay: later ops cannot settle backwards.
export function resourceAfter(op: Any, s: Any, row: Any, horizon: number): Json | undefined {
  const spec = effectiveSpec(op, s);
  const now = op.at === undefined ? s.clock : op.at;
  if (
    !spec ||
    !Number.isSafeInteger(now) ||
    (op.at !== undefined && (now < s.clock || now > horizon)) ||
    (row !== undefined && (!Number.isSafeInteger(row?.at) || row.at < 0 || row.at > now))
  )
    return undefined;
  if (spec.regen) return recovered(op, spec, row, now);
  if (
    s.entity_resource_specs?.[key(target(op))] &&
    (!row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).length !== 2 ||
      !Number.isInteger(row.value) ||
      row.value < spec.minimum ||
      row.value > spec.maximum)
  )
    return undefined;
  const before = row ?? { value: spec.start, at: 0 };
  if (
    !Number.isInteger(before.value) ||
    !Number.isInteger(before.at) ||
    op.next_rate !== undefined ||
    !Number.isInteger(op.to) ||
    op.to < spec.minimum ||
    op.to > spec.maximum
  )
    return undefined;
  const value = Math.min(
    spec.maximum,
    before.value + spec.gain * (Math.floor(now / 3600) - Math.floor(before.at / 3600)),
  );
  return value === op.from ? { value: op.to, at: now } : undefined;
}
