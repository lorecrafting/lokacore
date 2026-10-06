import { skillSpec } from './cartridge_skills.ts';
// The loader's engine-fact check (cartridge.md Compiler; DiagnosticCode RESERVED_FACT), twin of
// lib/loka/content/position.ex: under position@1 the fact position is the engine's, so the
// scene@1 also reserves each scene_<key> fact. The artifact must carry exactly these FactSpecs,
// and no recipe outcome, reaction apply or
// dialogue choice or scene ending may assign it. Skill acquisition and story-point markers
// have the same ownership check. Reading it (fact_compare, on.fact) is allowed.
import { markerSpec, spec } from './cartridge_scenes.ts';
import { encode } from '../foundation/canonical.ts';
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
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

export function reserved(c: Obj): Diagnostic[] {
  const expected = expectedFacts(c);
  const patrolRefs = Object.values((c.quests ?? {}) as Obj).flatMap((q) =>
    q.patrol ? [refString(q.patrol.trust_fact)] : [],
  );
  const serviceRefs = Object.values((c.services ?? {}) as Obj).flatMap((s) =>
    s.benefit.kind === 'entitlement' ? [refString(s.benefit.fact)] : [],
  );
  const refs = Object.keys(expected).map((k) => `${c.manifest.id}@${c.manifest.version}:fact/${k}`);
  const out: Diagnostic[] = [];
  for (const [i, ref] of refs.entries())
    if (!Object.hasOwn(c.facts, ref) || encode(c.facts[ref]) !== encode(Object.values(expected)[i]))
      out.push(diag('RESERVED_FACT', `.cartridge.facts${step(ref)}`));
  const write = (s: Obj, at: string) => {
    if (
      (s.op === 'fact.assign' || s.op === 'fact.adjust') &&
      [...refs, ...patrolRefs, ...serviceRefs].includes(refString(s.fact))
    )
      out.push(diag('RESERVED_FACT', `${at}.fact`));
  };
  const each = (map: string) => Object.entries((c[map] ?? {}) as Obj);
  for (const [k, r] of each('recipes'))
    for (const [name, o] of Object.entries(r.outcomes as Obj))
      o.sequence.forEach((s: Obj, i: number) =>
        write(s, `.cartridge.recipes${step(k)}.outcomes.${name}.sequence[${i}]`),
      );
  for (const [k, r] of each('reactions'))
    r.apply.forEach((s: Obj, i: number) => write(s, `.cartridge.reactions${step(k)}.apply[${i}]`));
  for (const [k, d] of each('dialogues'))
    for (const [id, o] of Object.entries(d.choices as Obj))
      (o.sequence ?? []).forEach((s: Obj, i: number) =>
        write(s, `.cartridge.dialogues${step(k)}.choices${step(id)}.sequence[${i}]`),
      );
  for (const [k, s] of each('scenes'))
    (s.on_end?.assign ?? []).forEach((a: Obj, i: number) =>
      write({ ...a, op: 'fact.assign' }, `.cartridge.scenes${step(k)}.on_end.assign[${i}]`),
    );
  return out;
}

function expectedFacts(c: Obj): Obj {
  const expected: Obj = Object.hasOwn(c.lock.capabilities, 'position') ? { position: SPEC } : {};
  if (Object.hasOwn(c.lock.capabilities, 'scene'))
    Object.values((c.scenes ?? {}) as Obj).forEach((s) => {
      const lines = s.steps.filter((x: Obj) => x.type === 'narrate').length;
      expected[`scene_${s.key}`] = spec(s.key, lines);
    });
  for (const p of Object.values((c.story_points ?? {}) as Obj))
    if (Object.values(p.outcomes as Obj).some((t: Obj) => !!t.scene))
      expected[`story_point_${p.key}`] = markerSpec(p.key, Object.keys(p.outcomes));
  for (const s of Object.values((c.skills ?? {}) as Obj))
    expected[`skill_${s.key}`] = skillSpec(s.key);
  return expected;
}
