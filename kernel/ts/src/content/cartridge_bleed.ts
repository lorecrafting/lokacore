import { diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

function checkItems(c: Obj, defs: Obj, items: [string, Obj][], out: Diagnostic[]) {
  for (const [ref, i] of items) {
    const at = `.cartridge.items${step(ref)}.bandage`;
    if (
      !defs[refString(i.bandage.effect)] ||
      !c.skills?.[refString(i.bandage.skill)] ||
      i.bandage.action !== 'bandage' ||
      !c.text?.[i.bandage.narration] ||
      i.container === true ||
      i.slot ||
      i.edible
    )
      out.push(diag('SCHEMA_VIOLATION', at));
  }
}

/** Checked C5 declarations in the loaded artifact, independent of source compilation. */
export function bleed(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const defs = c.bleeds ?? {};
  const hits = Object.entries(c.npcs ?? {}).filter(
    ([, n]: [string, any]) => n.attack?.on_positive_hit,
  ) as [string, Obj][];
  const items = Object.entries(c.items ?? {}).filter(([, i]: [string, any]) => i.bandage) as [
    string,
    Obj,
  ][];
  if (!Object.keys(defs).length && !hits.length && !items.length) return out;
  if (
    apiCmp(c.manifest.requires.kernel_api.at_least, '1.30') < 0 ||
    ['bleed', 'combat', 'skills', 'food'].some((k) => c.lock.capabilities[k] !== 1)
  )
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, b] of Object.entries(defs) as [string, Obj][]) {
    if (b.tick_every >= b.duration)
      out.push(diag('SCHEMA_VIOLATION', `.cartridge.bleeds${step(ref)}.tick_every`));
    if (!b.narration || Object.values(b.narration as Obj).some((key) => !c.text?.[key as string]))
      out.push(diag('SCHEMA_VIOLATION', `.cartridge.bleeds${step(ref)}.narration`));
  }
  for (const [ref, n] of hits) {
    const at = `.cartridge.npcs${step(ref)}.attack.on_positive_hit`;
    if (
      !defs[refString(n.attack.on_positive_hit.effect)] ||
      n.spawn_template !== true ||
      !Object.values(c.population_bundles ?? {}).some((b: any) => refString(b.npc) === ref)
    )
      out.push(diag('SCHEMA_VIOLATION', at));
  }
  checkItems(c, defs, items, out);
  return out;
}
