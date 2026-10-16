// Toolbox rows 15 and G11 at the cartridge trust boundary (twin of lib/loka/content/standing.ex):
// a reaction's fact.adjust names a bounded int fact (FACT_TYPE_MISMATCH); an NPC's disposition
// is on an authored NPC, with an engage line exactly when it is hostile and has an attack
// (SCHEMA_VIOLATION), a text of this cartridge; either, or a friendly buy_discount, needs
// kernel_api 1.47, a refuse line (Book hostile refusal) 1.104; asides (row FD10) are never on a
// spawn template (SCHEMA_VIOLATION). Its conditions are walked with
// every other policy (cartridge_refs.ts nodes).
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

// Row FD10: a spawned copy has no authored presence to remark from.
const templates = (c: Obj): Diagnostic[] =>
  Object.entries((c.npcs ?? {}) as Obj)
    .filter(([, n]) => n.spawn_template && n.asides)
    .map(([ref]) =>
      diag('SCHEMA_VIOLATION', `.cartridge.npcs${step(ref)}.asides`, { error: 'invalid_value' }),
    );

export function standing(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = templates(c);
  let used = false;
  let arrest = false;
  let refuse = false;
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
    if (n.spawn_template || bad || (d.refuse !== undefined && !d.hostile))
      out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
    for (const f of ['engage', 'refuse'])
      if (d[f] !== undefined && !Object.hasOwn(c.text, d[f]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${f}`, { target: d[f] }));
    if (d.refuse !== undefined) refuse = true;
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
  const floor = arrest ? '1.105' : refuse ? '1.104' : '1.47';
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, floor) < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
