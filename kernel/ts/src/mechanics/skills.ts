import type { CharacterId, DefinitionRef, EntityId } from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';
import { actorOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { assigned, value, type Assigned } from './fact.ts';
import { holds } from './policy.ts';
import { npcValue, value as attributeValue } from './attributes/shared.ts';
import { acquisition, level, membership, practice } from './skill_level.ts';

export { acquisition, level, membership, practice };

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

/**
 * Row 16: the seer's `attribute` (an NPC's declared value, a player's value) is greater than the
 * holder's `skill` level; a holder without a character (a hidden NPC) is never pierced. No draw.
 */
export function pierces(
  world: World,
  { skill, attribute }: { skill: DefinitionRef; attribute: DefinitionRef },
  holder: EntityId,
  seer: EntityId | undefined,
) {
  const actor = actorOf(world, holder);
  if (actor === undefined || seer === undefined) return false;
  const player = actorOf(world, seer);
  const sees =
    player === undefined
      ? npcValue(world, seer, attribute)
      : attributeValue(world, player, attribute);
  return sees !== undefined && sees > level(world, actor, skill);
}
