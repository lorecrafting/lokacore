// Toolbox rows 33 and 34 at the cartridge trust boundary (twin of lib/loka/content/theft.ex):
// world.theft needs kernel_api 1.94, names this cartridge's skill, attribute and an instance-scoped
// per_subject bool stolen fact, and every bank vault NPC then carries a get lock (no pickpocketing
// the shared pool). Without world.theft a stolen offer or an NPC lock is refused (ruling 2026-10-15).
import type { Diagnostic } from '../contracts.gen.ts';
import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

export function theft(c: Obj, named: Checks['named']): Diagnostic[] {
  const t = c.world?.theft;
  if (!t) return unarmed(c);
  const at = '.cartridge.world.theft';
  const out: Diagnostic[] = [];
  if (apiCmp(c.manifest.requires.kernel_api.at_least, '1.94') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  named(t.skill, 'skill', `${at}.skill`);
  named(t.attribute, 'attribute', `${at}.attribute`);
  named(t.stolen, 'fact', `${at}.stolen`);
  const f = c.facts?.[refString(t.stolen)];
  if (f && !(f.value_type.type === 'bool' && f.per_subject && same(f.scopes, ['instance'])))
    out.push(diag('FACT_SCOPE_UNSUPPORTED', `${at}.stolen`));
  for (const k of ['seen', 'unseen'])
    if (!Object.hasOwn(c.text, t.narration[k]))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.narration.${k}`, { target: t.narration[k] }));
  for (const [ref, s] of Object.entries((c.services ?? {}) as Obj)) {
    const b = s.benefit;
    if (
      (b.kind === 'deposit' || b.kind === 'withdraw') &&
      !c.npcs?.[refString(b.vault)]?.locks?.get
    )
      out.push(
        diag('SCHEMA_VIOLATION', `.cartridge.services${step(ref)}.benefit.vault`, {
          error: 'invalid_value',
        }),
      );
  }
  return out;
}

/** SCHEMA_VIOLATION at each stolen offer and NPC lock: nothing reads them without world.theft. */
function unarmed(c: Obj): Diagnostic[] {
  const bad = (at: string) => diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' });
  return Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) => [
    ...(n.locks ? [bad(`.cartridge.npcs${step(ref)}.locks`)] : []),
    ...(n.shop?.offers ?? []).flatMap((o: Obj, i: number) =>
      o.stolen ? [bad(`.cartridge.npcs${step(ref)}.shop.offers[${i}].stolen`)] : [],
    ),
  ]);
}
