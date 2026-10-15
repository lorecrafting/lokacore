// Built rooms S1 at the cartridge trust boundary (twin of lib/loka/content/construction.ex): a
// room's site names no direction the room has an exit in (SITE_EXIT_CONFLICT) and only blueprints
// of this cartridge; a blueprint, a site or world.construction needs kernel_api 1.99. Blueprint
// text, tags, variants and the enter lock are checked with every other part (cartridge_refs.ts).
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function construction(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const sites = Object.entries((c.rooms ?? {}) as Obj).filter(([, r]) => r.site);
  for (const [ref, r] of sites) {
    const at = `.cartridge.rooms${step(ref)}.site`;
    r.site.directions.forEach((d: string, i: number) => {
      if (r.exits?.[d]) out.push(diag('SITE_EXIT_CONFLICT', `${at}.directions[${i}]`));
    });
    r.site.blueprints.forEach((b: Obj, i: number) => {
      const target = refString(b as DefinitionRef);
      if (!Object.hasOwn(c.blueprints ?? {}, target))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.blueprints[${i}]`, { target }));
    });
  }
  const used =
    sites.length > 0 || Object.keys(c.blueprints ?? {}).length > 0 || !!c.world?.construction;
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.99') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
