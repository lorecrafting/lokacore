// Toolbox rows 15 and G11 at the cartridge trust boundary (twin of lib/loka/content/standing.ex):
// a reaction's fact.adjust names a bounded int fact (FACT_TYPE_MISMATCH); an NPC's disposition
// is on an authored NPC, with an engage line exactly when it is hostile and has an attack
// (SCHEMA_VIOLATION), a text of this cartridge; either, or a friendly buy_discount, needs
// kernel_api 1.47. Its conditions are walked with every other policy (cartridge_refs.ts nodes).
import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

/** Each NPC's disposition condition root, with its path. */
export const dispositions = (c: Obj): [Obj, string][] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    ['hostile', 'friendly']
      .filter((f) => n.disposition?.[f])
      .map((f): [Obj, string] => [
        n.disposition[f].root,
        `.cartridge.npcs${step(ref)}.disposition.${f}.root`,
      ]),
  );

export function standing(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  let used = false;
  let arrest = false;
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj)) {
    const d = n.disposition;
    if (n.shop?.buy_discount?.friendly) used = true;
    if (!d) continue;
    used = true;
    const at = `.cartridge.npcs${step(ref)}.disposition`;
    // Row 35: an arrest replaces the engage line, so it needs `hostile` and no `engage`.
    const bad = d.arrest
      ? !d.hostile || d.engage !== undefined
      : !!d.engage !== !!(d.hostile && n.attack);
    if (n.spawn_template || bad) out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
    if (d.engage !== undefined && !Object.hasOwn(c.text, d.engage))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.engage`, { target: d.engage }));
    if (d.arrest) arrest = true;
    if (d.arrest && !Object.hasOwn(c.text, d.arrest.narration))
      out.push(
        diag('UNRESOLVED_REFERENCE', `${at}.arrest.narration`, { target: d.arrest.narration }),
      );
  }
  for (const [ref, r] of Object.entries((c.reactions ?? {}) as Obj))
    r.apply.forEach((s: Obj, i: number) => {
      if (s.op !== 'fact.adjust') return;
      used = true;
      const t = c.facts[refString(s.fact)]?.value_type;
      if (t && (t.type !== 'int' || t.minimum === undefined || t.maximum === undefined))
        out.push(diag('FACT_TYPE_MISMATCH', `.cartridge.reactions${step(ref)}.apply[${i}].fact`));
    });
  const floor = arrest ? '1.105' : '1.47';
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, floor) < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
