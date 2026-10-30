import { skillSpec, usesSpec } from './cartridge_skills.ts';
import { trailFacts } from './cartridge_trails.ts';
// Engine-owned fact specs (position@1, scene, skill, marker and tip facts), read by
// play/reach.ts; the compiler checks RESERVED_FACT (position.ex).
import { markerSpec, spec } from './cartridge_scenes.ts';
import type { Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';

/** Toolbox row W23: the FactSpec the compiler adds for a scripted action's tip (action_tips.ex tip_spec). */
const tipSpec = (key: string) => ({
  key: `seen_tip_${key}`,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: `Scripted action ${key}'s tip was shown (scripted_action@1): only that scripted action writes it.`,
});

/** The FactSpec the compiler adds under position@1 (cartridge.md Compiler), byte for byte. */
const SPEC = {
  key: 'position',
  version: 1,
  value_type: {
    type: 'enum',
    values: ['standing', 'sitting', 'resting', 'sleeping'],
    default: 'standing',
  },
  scopes: ['player'],
  meaning: "The character's position (position@1): only its rule writes it.",
};

/**
 * Authored facts only the engine writes: each quest patrol's trust_fact, each entitlement service's
 * fact and each deposit or withdraw service's account (toolbox row 25).
 */
export const engineWrittenRefs = (c: Obj): string[] => [
  ...Object.values((c.quests ?? {}) as Obj).flatMap((q) =>
    q.patrol ? [refString(q.patrol.trust_fact)] : [],
  ),
  ...Object.values((c.services ?? {}) as Obj).flatMap((s) =>
    s.benefit.op === 'entitlement'
      ? [refString(s.benefit.fact)]
      : s.benefit.account
        ? [refString(s.benefit.account)]
        : [],
  ),
];

export function expectedFacts(c: Obj): Obj {
  const expected: Obj = Object.hasOwn(c.lock.capabilities, 'position') ? { position: SPEC } : {};
  if (Object.hasOwn(c.lock.capabilities, 'scene'))
    Object.values((c.scenes ?? {}) as Obj).forEach((s) => {
      const lines =
        s.control === 'presentation_only'
          ? s.steps.length - 2
          : s.steps.filter((x: Obj) => x.type === 'narrate').length;
      expected[`scene_${s.key}`] = spec(s.key, lines);
    });
  for (const p of Object.values((c.story_points ?? {}) as Obj))
    if (Object.values(p.outcomes as Obj).some((t: Obj) => !!t.scene))
      expected[`story_point_${p.key}`] = markerSpec(p.key, Object.keys(p.outcomes));
  for (const s of Object.values((c.skills ?? {}) as Obj)) {
    expected[`skill_${s.key}`] = skillSpec(s.key);
    if (s.growth) expected[`uses_${s.key}`] = usesSpec(s.key, s.growth);
  }
  for (const r of Object.values((c.scripted_actions ?? {}) as Obj))
    if (r.tip) expected[`seen_tip_${r.key}`] = tipSpec(r.key);
  return { ...expected, ...trailFacts(c) };
}
