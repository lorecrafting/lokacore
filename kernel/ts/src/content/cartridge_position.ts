// The loader's engine-fact check (cartridge.md Compiler; DiagnosticCode RESERVED_FACT), twin of
// lib/loka/content/position.ex: under position@1 the fact position is the engine's, so the
// scene@1 also reserves each scene_<key> fact. The artifact must carry exactly these FactSpecs,
// and no recipe outcome, reaction apply or
// dialogue choice may fact.assign it. Reading it (fact_compare, on.fact) is allowed.
import { spec } from './cartridge_scenes.ts';
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
  const expected: Obj = Object.hasOwn(c.lock.capabilities, 'position') ? { position: SPEC } : {};
  if (Object.hasOwn(c.lock.capabilities, 'scene'))
    for (const s of Object.values((c.scenes ?? {}) as Obj))
      expected[`scene_${s.key}`] = spec(
        s.key,
        s.steps.filter((x: Obj) => x.type === 'narrate').length,
      );
  const refs = Object.keys(expected).map((k) => `${c.manifest.id}@${c.manifest.version}:fact/${k}`);
  const out: Diagnostic[] = [];
  refs.forEach((ref, i) => {
    if (!Object.hasOwn(c.facts, ref) || encode(c.facts[ref]) !== encode(Object.values(expected)[i]))
      out.push(diag('RESERVED_FACT', `.cartridge.facts${step(ref)}`));
  });
  const write = (s: Obj, at: string) => {
    if (s.op === 'fact.assign' && refs.includes(refString(s.fact)))
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
  return out;
}
