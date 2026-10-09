import type { AncestrySpec, CharacterId, DefinitionRef, DerivedStat } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { add, divide, mul, sub } from '../../foundation/int.ts';
import { refString, type World } from '../../runtime/decision.ts';

export const initialValues = (world: World, ancestry: AncestrySpec) => {
  const starts = Object.fromEntries(
    Object.entries(world.cartridge.attributes ?? {}).map(([ref, spec]) => [ref, spec.start]),
  );
  const selected = refString(ancestry.attribute);
  return { ...starts, [selected]: starts[selected]! + ancestry.modifier };
};

export const choice = (world: World, actor: CharacterId) => world.state.characters?.[actor];

export const value = (world: World, actor: CharacterId, attribute: DefinitionRef) =>
  choice(world, actor)?.attributes[refString(attribute)] ?? world.attributes[key(attribute)];

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
