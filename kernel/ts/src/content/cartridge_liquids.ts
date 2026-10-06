import { checkers, diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';

/** Liquid references, initial contents and checked maximum effective vessel mass. */
export function liquids(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { named, text } = checkers(c, out);
  const declared = Object.entries((c.liquids ?? {}) as Obj);
  let opted = declared.length > 0;
  for (const [ref, liquid] of declared)
    text(liquid, ['label', 'unit_label'], `.cartridge.liquids${step(ref)}`);
  for (const [ref, item] of Object.entries((c.items ?? {}) as Obj)) {
    if (!item.vessel) continue;
    opted = true;
    vessel(c, item, `.cartridge.items${step(ref)}`, { named, text }, out);
  }
  for (const [ref, room] of Object.entries((c.rooms ?? {}) as Obj))
    for (const [key, detail] of Object.entries((room.details ?? {}) as Obj)) {
      if (!detail.liquid_source) continue;
      opted = true;
      named(
        detail.liquid_source,
        'liquid',
        `.cartridge.rooms${step(ref)}.details${step(key)}.liquid_source`,
      );
    }
  if (opted) requirements(c, out);
  return out;
}

function vessel(
  c: Obj,
  item: Obj,
  at: string,
  { named, text }: Pick<Checks, 'named' | 'text'>,
  out: Diagnostic[],
) {
  const bad = (path: string) =>
    out.push(diag('SCHEMA_VIOLATION', path, { error: 'invalid_value' }));
  if (item.location.in === 'template') bad(`${at}.vessel`);
  const v = item.vessel,
    row = v.initial;
  if ((row.kind === null) !== (row.quantity === 0) || row.quantity > v.capacity)
    bad(`${at}.vessel.initial`);
  if (row.kind !== null) named(row.kind, 'liquid', `${at}.vessel.initial.kind`);
  text(v, ['unit_label'], `${at}.vessel`);
  if (!Number.isSafeInteger(item.mass_grams)) bad(`${at}.mass_grams`);
  else if (
    Object.values((c.liquids ?? {}) as Obj).some((liquid) => {
      const mass = item.mass_grams + v.capacity * liquid.grams_per_unit;
      return !Number.isSafeInteger(mass) || mass > 2147483647;
    })
  )
    bad(`${at}.vessel.capacity`);
}

function requirements(c: Obj, out: Diagnostic[]) {
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  if (major < 1 || (major === 1 && minor < 19))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  if (c.lock.capabilities.liquid !== 1)
    out.push(
      diag(
        'UNDECLARED_CAPABILITY',
        '.cartridge.manifest.requires.capabilities.liquid',
        { capability: 'liquid' },
        ['liquid@1'],
      ),
    );
}
