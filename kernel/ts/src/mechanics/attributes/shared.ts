import type { AncestrySpec, CharacterId, DefinitionRef } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
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

export const darkSight = (world: World, actor: CharacterId) => {
  const selected = choice(world, actor)?.ancestry;
  return selected !== undefined && world.cartridge.ancestries?.[selected]?.dark_sight === true;
};
