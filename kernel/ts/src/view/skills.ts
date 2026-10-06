import { status } from '../mechanics/skills.ts';
import { refString, type World } from '../runtime/decision.ts';
import type { DefinitionRef } from '../contracts.gen.ts';

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
  const attributes = Object.values(world.cartridge.attributes ?? {}).map((a) => ({
    attribute: ref('attribute', a.key),
    value: a.start,
  }));
  return { ...(skills.length && { skills }), ...(attributes.length && { attributes }) };
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
