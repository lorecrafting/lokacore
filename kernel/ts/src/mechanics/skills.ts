import { key } from '../foundation/compose.ts';
import type { CharacterId, DefinitionRef } from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type Steps, type World } from '../runtime/decision.ts';
import { assigned, scopeOf, value, type Assigned } from './fact.ts';
import { holds } from './policy.ts';
import { npcValue, value as attributeValue } from './attributes/shared.ts';

export const acquisition = (skill: DefinitionRef): DefinitionRef => ({
  ...skill,
  kind: 'fact',
  key: `skill_${skill.key}` as DefinitionRef['key'],
});

/** Toolbox row 5: the reserved count fact of a skill with growth (mechanics.md skill growth). */
export const practice = (skill: DefinitionRef): DefinitionRef => ({
  ...skill,
  kind: 'fact',
  key: `uses_${skill.key}` as DefinitionRef['key'],
});

/** The actor's level: 1 when acquired, plus the growth thresholds its count has reached. */
export function level(world: World, actor: CharacterId, skill: DefinitionRef) {
  const growth = world.cartridge.skills![refString(skill)]!.growth ?? [];
  const uses = growth.length ? (value(world, actor, practice(skill)) as number) : 0;
  return Number(membership(world, actor, skill)) + growth.filter((t) => t <= uses).length;
}

/**
 * `run` with one use of the skill an opposed check (a recipe's, row 5; a choice's, row 14) names, unless the check
 * names none, the skill has no growth or its count is at the last threshold.
 */
export function practised<R extends Assigned>(
  world: World,
  actor: CharacterId,
  run: R,
  check: { kind: string; skill?: DefinitionRef } | undefined,
) {
  const skill = check?.kind === 'opposed' ? check.skill : undefined;
  const growth = skill && world.cartridge.skills![refString(skill)]!.growth;
  if (!growth) return run;
  const uses = value(world, actor, practice(skill!)) as number;
  if (uses >= growth.at(-1)!) return run;
  return assigned(world, actor, run, { fact: practice(skill!), value: uses + 1 }, 'skills');
}

export function status(world: World, actor: CharacterId, skill: DefinitionRef, steps: Steps) {
  const definition = world.cartridge.skills?.[refString(skill)];
  if (!definition) throw new KernelError('precondition_failed');
  const acquired = membership(world, actor, skill);
  const qualified = holds(world, actor, definition.qualification.root, { steps });
  return { acquired, qualified, usable: acquired && qualified };
}

export function acquire(world: World, actor: CharacterId, run: Assigned, skill: DefinitionRef) {
  if (!world.cartridge.skills?.[refString(skill)] || membership(world, actor, skill) !== false)
    throw new KernelError('precondition_failed');
  return assigned(world, actor, run, { fact: acquisition(skill), value: true }, 'skills');
}

export function membership(world: World, actor: CharacterId, skill: DefinitionRef) {
  const fact = acquisition(skill);
  const at = key({ kind: 'fact', fact, scope: scopeOf(world, actor, fact) });
  const current = Object.hasOwn(world.state.facts ?? {}, at) ? world.state.facts![at] : false;
  if (typeof current !== 'boolean') throw new KernelError('precondition_failed');
  return current;
}

// An opposed check (rows 5, G5, G3; dialogue choices, row 14): the actor's skill level or attribute
// value at least the named NPC's value of the attribute, read at use wherever the NPC is (row G3;
// no leaf gates its presence yet), else `rating` (the target detail's or the choice check's).
export const opposed = (
  world: World,
  actor: CharacterId,
  check: { skill?: DefinitionRef; attribute?: DefinitionRef; npc?: DefinitionRef },
  rating: number,
) =>
  (check.skill
    ? level(world, actor, check.skill)
    : attributeValue(world, actor, check.attribute!)) >=
  (check.npc ? npcValue(world, world.entityIds[refString(check.npc)]!, check.attribute!)! : rating);
