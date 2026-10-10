// Toolbox row W6 at the cartridge trust boundary: an entity text variant (all but an item's older
// room_line_variants) or a status_active or position leaf needs kernel_api 1.46. Twin of
// lib/loka/content/variants.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

export function variants(c: Obj): Diagnostic[] {
  const item = (e: Obj) => e.short_variants || e.description_variants;
  const used =
    Object.values((c.npcs ?? {}) as Obj).some((n) => item(n) || n.room_line_variants) ||
    Object.values((c.items ?? {}) as Obj).some(item) ||
    nodes(c).some(([p]) => p.op === 'status_active' || p.op === 'position');
  return used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.46') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}
