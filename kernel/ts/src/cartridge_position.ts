// The loader's position@1 check (cartridge.md Compiler; DiagnosticCode RESERVED_FACT), twin of
// lib/loka/content/position.ex: under position@1 the fact position is the engine's, so the
// artifact must carry exactly the engine's FactSpec, and no recipe outcome, reaction apply or
// dialogue choice may fact.assign it. Reading it (fact_compare, on.fact) is allowed.
import { encode } from './canonical.ts';
import type { Diagnostic } from './contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from './decision.ts';

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
  if (!Object.hasOwn(c.lock.capabilities, 'position')) return [];
  const ref = `${c.manifest.id}@${c.manifest.version}:fact/position`;
  const out: Diagnostic[] = [];
  if (!Object.hasOwn(c.facts, ref) || encode(c.facts[ref]) !== encode(SPEC))
    out.push(diag('RESERVED_FACT', `.cartridge.facts${step(ref)}`));
  const write = (s: Obj, at: string) => {
    if (s.op === 'fact.assign' && refString(s.fact) === ref)
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
