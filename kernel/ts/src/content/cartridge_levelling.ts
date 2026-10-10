// Toolbox row 4 experience and levelling in the loaded artifact; twin of Loka.Content.Levelling.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function levelling(c: Obj, { named, text }: Checks): Diagnostic[] {
  const l = c.world?.levelling as Obj | undefined;
  const grants = Object.entries((c.reactions ?? {}) as Obj).flatMap(([ref, r]) =>
    (r.apply as Obj[]).flatMap((s, i) =>
      s.op === 'experience.grant' ? [`.cartridge.reactions${step(ref)}.apply[${i}].op`] : [],
    ),
  );
  const out: Diagnostic[] = [];
  const bad = (at: string) => out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  if ((l || grants.length) && apiCmp(c.manifest.requires.kernel_api.at_least, '1.42') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  if (!l) {
    grants.forEach(bad);
    return out;
  }
  const at = '.cartridge.world.levelling';
  if (c.lock.capabilities.attributes !== 1)
    out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'attributes' }, ['attributes@1']));
  const thresholds = l.thresholds as number[];
  thresholds.forEach((t, i) => i && t <= thresholds[i - 1]! && bad(`${at}.thresholds[${i}]`));
  for (const [i, k] of ((l.kills ?? []) as Obj[]).entries())
    named(k.npc, 'npc', `${at}.kills[${i}].npc`);
  text(l, ['level_up'], at);
  return out;
}
