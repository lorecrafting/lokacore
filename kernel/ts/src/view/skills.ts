import { concealed, status } from '../mechanics/skills.ts';
import { level } from '../mechanics/skill_level.ts';
import { holds } from '../mechanics/policy.ts';
import { refString, type World } from '../runtime/decision.ts';
import type { CharacterId, DefinitionRef, Key, SkillDefinition } from '../contracts.gen.ts';
import { choice, value, worn } from '../mechanics/attributes/shared.ts';
import { levelling } from '../mechanics/levelling/shared.ts';

export function skillViews(world: World, actor: CharacterId, steps = { n: 0 }) {
  const ref = (kind: string, key: DefinitionRef['key']): DefinitionRef => ({
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind,
    key,
  });
  const skills = Object.values(world.cartridge.skills ?? {}).flatMap((s) =>
    skillView(world, actor, s, ref('skill', s.key), steps),
  );
  const attributes = attributeViews(world, actor, ref);
  const selected = choice(world, actor);
  return {
    ...levellingView(world, actor),
    ...(skills.length && { skills }),
    ...(attributes.length && { attributes }),
    ...(selected && { ancestry: selected.ancestry }),
    ...(!selected &&
      world.cartridge.ancestries && {
        ancestry_choices: Object.entries(world.cartridge.ancestries).map(([key, declaration]) => ({
          key: key as Key,
          label: declaration.name,
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

// Homestead hs-14: level only with growth, locked only with a prerequisite, and a concealed skill
// (mechanics/skills.ts) is left out.
function skillView(
  world: World,
  actor: CharacterId,
  s: SkillDefinition,
  skill: DefinitionRef,
  steps: { n: number },
) {
  if (concealed(world, actor, skill, steps)) return [];
  const locked = s.prerequisite && !holds(world, actor, s.prerequisite, { steps });
  const st = status(world, actor, skill, steps);
  return [
    {
      skill,
      label: s.name,
      requirement: s.requirement,
      ...st,
      ...(s.growth && { level: level(world, actor, skill) }),
      ...(s.prerequisite && { locked: locked! }),
      ...(s.profession && { profession: s.profession }),
    },
  ];
}

/** The player's level, experience, next threshold (absent at the top) and unspent points (row 4). */
function levellingView(world: World, actor: CharacterId) {
  const l = levelling(world, actor);
  if (!l) return {};
  const { level, experience, next, unspent } = l;
  return { levelling: { level, experience, ...(next !== undefined && { next }), unspent } };
}

/**
 * Original free-bound lessons identify the existing actor SkillViews; no second acquisition
 * projection. A lesson for a skill the view leaves out (hs-14) is left out too.
 */
export function freeLessons(world: World, npc: string, actor: CharacterId, steps = { n: 0 }) {
  const refs = Object.values(world.cartridge.dialogues ?? {})
    .filter((d) => world.entityIds[refString(d.npc)] === npc)
    .flatMap((d) =>
      Object.values(d.choices).flatMap((o) =>
        o.lesson_payment
          ? []
          : (o.sequence ?? []).flatMap((s) => (s.op === 'skill.acquire' ? [s.skill] : [])),
      ),
    )
    .filter((r) => !concealed(world, actor, r, steps));
  return refs.length ? { lessons: refs } : {};
}

/**
 * Each authored attribute's value and, when nonzero, what identified worn items grant (toolbox
 * rows 3 and 27).
 */
function attributeViews(
  world: World,
  actor: CharacterId,
  ref: (kind: string, key: Key) => DefinitionRef,
) {
  return Object.values(world.cartridge.attributes ?? {}).map((a) => {
    const bonus = worn(world, actor, ref('attribute', a.key), true);
    return {
      attribute: ref('attribute', a.key),
      value: value(world, actor, ref('attribute', a.key)),
      ...(bonus !== 0 && { worn: bonus }),
    };
  });
}
