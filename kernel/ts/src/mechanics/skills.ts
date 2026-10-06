import { key } from '../foundation/compose.ts';
import type { CharacterId, DefinitionRef } from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type Steps, type World } from '../runtime/decision.ts';
import { assigned, scopeOf, type Assigned } from './fact.ts';
import { holds } from './policy.ts';

export const acquisition = (skill: DefinitionRef): DefinitionRef => ({
  ...skill,
  kind: 'fact',
  key: `skill_${skill.key}` as DefinitionRef['key'],
});

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
