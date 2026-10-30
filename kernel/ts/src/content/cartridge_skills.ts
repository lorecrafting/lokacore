// Skill fact specs (skill@1).
export const skillSpec = (key: string) => ({
  key: `skill_${key}`,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: `Skill ${key}'s acquisition (skill@1): only skill@1 writes it.`,
});

/** Toolbox row 5: the reserved use count of a skill with growth (mechanics.md skill growth). */
export const usesSpec = (key: string, growth: number[]) => ({
  key: `uses_${key}`,
  version: 1,
  value_type: { type: 'int', default: 0, minimum: 0, maximum: growth.at(-1) },
  scopes: ['player'],
  meaning: `Skill ${key}'s use count (skill@1): only skill@1 writes it.`,
});
