// Independent fuel preconditions; never call the composer to compute an expected row.
export function fuelValid(op: any, s: any): boolean {
  const spec = s.fuel_specs?.[op.item_id];
  const valid = (r: any) =>
    !!spec &&
    ['source', 'supply'].includes(spec.kind) &&
    Number.isSafeInteger(spec.capacity) &&
    spec.capacity > 0 &&
    !!r &&
    Object.keys(r).length === 3 &&
    Number.isSafeInteger(r.remaining) &&
    r.remaining >= 0 &&
    r.remaining <= spec.capacity &&
    Number.isSafeInteger(r.at) &&
    r.at >= 0 &&
    r.at <= s.clock &&
    typeof r.lit === 'boolean' &&
    (spec.kind === 'source' || !r.lit);
  return valid(op.from) && valid(op.to) && op.to.at === s.clock;
}
