import { status } from '../mechanics/skills.ts';
import { refString, type World } from '../runtime/decision.ts';
import type { DefinitionRef, Key } from '../contracts.gen.ts';
import { choice, value, worn } from '../mechanics/attributes/shared.ts';

export function skillViews(world: World, steps = { n: 0 }) {
  const ref = (kind: string, key: DefinitionRef['key']): DefinitionRef => ({
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind,
    key,
  });
  const skills = Object.values(world.cartridge.skills ?? {}).map((s) => {
    const skill = ref('skill', s.key);
    return {
      skill,
      label: s.label,
      requirement: s.requirement,
      ...status(world, world.character, skill, steps),
    };
  });
  const attributes = attributeViews(world, ref);
  const selected = choice(world, world.character);
  return {
    ...(skills.length && { skills }),
    ...(attributes.length && { attributes }),
    ...(selected && { ancestry: selected.ancestry }),
    ...(!selected &&
      world.cartridge.ancestries && {
        ancestry_choices: Object.entries(world.cartridge.ancestries).map(([key, declaration]) => ({
          key: key as Key,
          label: declaration.label,
          description: declaration.description,
          attribute: declaration.attribute,
          modifier: declaration.modifier,
          ...(declaration.skill && { skill: declaration.skill }),
          ...(declaration.faction && { faction: declaration.faction }),
          ...(declaration.dark_sight && { dark_sight: true as const }),
        })),
      }),
  };
}

/** Original free-bound lessons identify the existing actor SkillViews; no second acquisition projection. */
export function freeLessons(world: World, npc: string) {
  const refs = Object.values(world.cartridge.dialogues ?? {})
    .filter((d) => world.entityIds[refString(d.npc)] === npc)
    .flatMap((d) =>
      Object.values(d.choices).flatMap((o) =>
        o.lesson_payment
          ? []
          : (o.sequence ?? []).flatMap((s) => (s.op === 'skill.acquire' ? [s.skill] : [])),
      ),
    );
  return refs.length ? { lessons: refs } : {};
}

/** Each authored attribute's value and, when nonzero, what worn items grant (toolbox row 3). */
function attributeViews(world: World, ref: (kind: string, key: Key) => DefinitionRef) {
  return Object.values(world.cartridge.attributes ?? {}).map((a) => {
    const bonus = worn(world, world.character, ref('attribute', a.key));
    return {
      attribute: ref('attribute', a.key),
      value: value(world, world.character, ref('attribute', a.key)),
      ...(bonus !== 0 && { worn: bonus }),
    };
  });
}
