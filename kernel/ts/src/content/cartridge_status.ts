import { diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

/** Checked toolbox row 1 declarations in the loaded artifact, independent of source compilation. */
export function status(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const defs = (c.statuses ?? {}) as Record<string, Obj>;
  const applies = Object.entries(c.reactions ?? {}).flatMap(([ref, r]: [string, any]) =>
    (r.apply as Obj[]).flatMap((s, i) =>
      s.op === 'status.apply'
        ? [[`.cartridge.reactions${step(ref)}.apply[${i}].status`, s.status]]
        : [],
    ),
  ) as [string, Obj][];
  const cures = Object.entries(c.items ?? {}).flatMap(([ref, i]: [string, any]) =>
    ((i.edible?.cures ?? []) as Obj[]).map((s, n) => [
      `.cartridge.items${step(ref)}.edible.cures[${n}]`,
      s,
    ]),
  ) as [string, Obj][];
  if (!Object.keys(defs).length && !applies.length && !cures.length) return out;
  if (
    apiCmp(c.manifest.requires.kernel_api.at_least, '1.38') < 0 ||
    ['status', 'death'].some((k) => c.lock.capabilities[k] !== 1) // a fatal hp tick needs death
  )
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, s] of Object.entries(defs)) {
    const at = `.cartridge.statuses${step(ref)}`;
    if (!c.resources?.[refString(s.resource)])
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.resource`));
    if (s.tick_every >= s.duration) out.push(diag('SCHEMA_VIOLATION', `${at}.tick_every`));
    if (s.per_tick === 0) out.push(diag('SCHEMA_VIOLATION', `${at}.per_tick`));
    if (!c.text?.[s.label]) out.push(diag('SCHEMA_VIOLATION', `${at}.label`));
    if (Object.values(s.narration as Obj).some((k) => !c.text?.[k as string]))
      out.push(diag('SCHEMA_VIOLATION', `${at}.narration`));
  }
  for (const [at, ref] of [...applies, ...cures])
    if (!defs[refString(ref as never)]) out.push(diag('UNRESOLVED_REFERENCE', at));
  return out;
}
