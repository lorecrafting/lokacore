import { skillSpec, usesSpec } from './cartridge_skills.ts';
import { tipSpec } from './cartridge_recipes.ts';
import { trailFacts } from './cartridge_trails.ts';
// Engine-owned fact specs (position@1, scene, skill, marker and tip facts), kept for
// cartridge_services.ts and play/reach.ts; the compiler checks RESERVED_FACT (position.ex).
import { markerSpec, spec } from './cartridge_scenes.ts';
import type { Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';

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

/** The facts a presentation_only scene credits or assigns (dream-owned). */
const dreams = (c: Obj): string[] =>
  Object.values((c.scenes ?? {}) as Obj).flatMap((s) =>
    s.control === 'presentation_only'
      ? [refString(s.on.rest.credit), ...s.on_end.assign.map((a: Obj) => refString(a.fact))]
      : [],
  );

/**
 * Authored facts only the engine writes: each quest patrol's trust_fact, each entitlement service's
 * fact and, with `accounts`, each deposit or withdraw service's account (toolbox row 25).
 */
export const engineWrittenRefs = (c: Obj, accounts = true): string[] => [
  ...Object.values((c.quests ?? {}) as Obj).flatMap((q) =>
    q.patrol ? [refString(q.patrol.trust_fact)] : [],
  ),
  ...Object.values((c.services ?? {}) as Obj).flatMap((s) =>
    s.benefit.kind === 'entitlement'
      ? [refString(s.benefit.fact)]
      : s.benefit.account && accounts
        ? [refString(s.benefit.account)]
        : [],
  ),
];

/** Every fact an engine writer other than the bank owns; no bank account may be one (row 25). */
export const foreignRefs = (c: Obj): string[] => [
  ...Object.keys(expectedFacts(c)).map((k) => `${c.manifest.id}@${c.manifest.version}:fact/${k}`),
  ...dreams(c),
  ...engineWrittenRefs(c, false),
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
  for (const r of Object.values((c.recipes ?? {}) as Obj))
    if (r.tip) expected[`seen_tip_${r.key}`] = tipSpec(r.key);
  return { ...expected, ...trailFacts(c) };
}
