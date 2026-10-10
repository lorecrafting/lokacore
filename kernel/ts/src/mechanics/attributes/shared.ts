import type { AncestrySpec, CharacterId, DefinitionRef, DerivedStat } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { add, divide, mul, sub } from '../../foundation/int.ts';
import { bodyOf, refString, values, type World } from '../../runtime/decision.ts';

export const initialValues = (world: World, ancestry: AncestrySpec) => {
  const starts = Object.fromEntries(
    Object.entries(world.cartridge.attributes ?? {}).map(([ref, spec]) => [ref, spec.start]),
  );
  const selected = refString(ancestry.attribute);
  return { ...starts, [selected]: starts[selected]! + ancestry.modifier };
};

export const choice = (world: World, actor: CharacterId) => world.state.characters?.[actor];

/** The actor's attribute: its selected (else starting) value plus what its worn items grant. */
export function value(world: World, actor: CharacterId, attribute: DefinitionRef) {
  const base =
    choice(world, actor)?.attributes[refString(attribute)] ?? world.attributes[key(attribute)];
  const bonus = worn(world, actor, attribute);
  return bonus === 0 ? base : add(base, bonus);
}

/** The sum of `attribute`'s affects on the items worn by the actor's body (toolbox row 3). */
export function worn(world: World, actor: CharacterId, attribute: DefinitionRef) {
  const body = bodyOf(world, actor);
  if (!body || !Object.values(world.cartridge.items ?? {}).some((i) => i.affects)) return 0;
  const holders = new Set(values(world.slots).filter((h) => world.state.containers[h] === body));
  const ref = refString(attribute);
  let sum = 0;
  // ponytail: scans every placement per read; index worn items if worlds with affects grow large.
  for (const [item, at] of Object.entries(world.state.containers)) {
    const e = holders.has(at) ? world.entities[item] : undefined;
    if (e?.kind === 'item')
      for (const a of e.affects ?? []) if (refString(a.attribute) === ref) sum = add(sum, a.by);
  }
  return sum;
}

/** A derived stat's attribute bonus (mechanics.md derived stats), floored toward minus infinity. */
export function derived(world: World, actor: CharacterId, stat: DerivedStat | undefined) {
  if (!stat) return 0;
  let sum = 0;
  for (const t of stat.terms)
    sum = add(sum, mul(t.per_point, sub(value(world, actor, t.attribute)!, t.pivot)));
  const [q, r] = divide(sum, stat.divisor ?? 1);
  return r < 0 ? q - 1 : q;
}

export const darkSight = (world: World, actor: CharacterId) => {
  const selected = choice(world, actor)?.ancestry;
  return selected !== undefined && world.cartridge.ancestries?.[selected]?.dark_sight === true;
};
