import { key } from '../foundation/compose.ts';
import type { CharacterId, DefinitionRef } from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type World } from '../runtime/decision.ts';
import { scopeOf, value } from './fact.ts';

// Skill level reads (row 5), apart from skills.ts so policy.ts (skill_compare, row FD2) reads them
// without importing skills.ts, which imports policy.ts.
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

export function membership(world: World, actor: CharacterId, skill: DefinitionRef) {
  const fact = acquisition(skill);
  const at = key({ kind: 'fact', fact, scope: scopeOf(world, actor, fact) });
  const current = Object.hasOwn(world.state.facts ?? {}, at) ? world.state.facts![at] : false;
  if (typeof current !== 'boolean') throw new KernelError('precondition_failed');
  return current;
}
