// Toolbox row W6 at the cartridge trust boundary: an entity text variant (all but an item's older
// room_line_variants) or a status_active or npc_present leaf needs kernel_api 1.46; a status_active
// leaf reading self or subject (status reader 1, row G3) 1.53; a resource_compare with subject or
// at_least_percent (row 39) 1.87; a room's or detail's asides or a skill_compare leaf (row FD2)
// 1.91; world.identity (rows W15, FD9) 1.97; an item_present leaf (Homestead hs-6) 1.102; an
// NPC's asides (row FD10) 1.107; an NPC's or item's name words (loka-6qi) 1.118; a detail's title
// (loka-x6t.120) 1.120. Twin of lib/loka/content/variants.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { asideParts, diag, nodes, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

const titledDetail = (c: Obj) =>
  Object.values((c.rooms ?? {}) as Obj).some((r) =>
    Object.values((r.details ?? {}) as Obj).some((d) => d.title),
  );

export function variants(c: Obj): Diagnostic[] {
  const item = (e: Obj) => e.short_variants || e.description_variants;
  const leaves = nodes(c).map(([p]) => p);
  const relative = leaves.some(
    (p) => p.op === 'resource_compare' && (p.subject || p.at_least_percent),
  );
  const voices = asideParts(c).length > 0 || leaves.some((p) => p.op === 'skill_compare');
  const furnish = leaves.some((p) => p.op === 'item_present');
  const remarks = Object.values((c.npcs ?? {}) as Obj).some((n) => n.asides);
  const words = [c.npcs, c.items].some((m) => Object.values((m ?? {}) as Obj).some((e) => e.words));
  const titled = titledDetail(c);
  const used =
    titled ||
    words ||
    furnish ||
    !!c.world?.identity ||
    voices ||
    relative ||
    Object.values((c.npcs ?? {}) as Obj).some((n) => item(n) || n.room_line_variants) ||
    Object.values((c.items ?? {}) as Obj).some(item) ||
    leaves.some((p) => p.op === 'status_active' || p.op === 'npc_present');
  const reader = leaves.some((p) => p.op === 'status_active' && p.subject !== 'target');
  const floor =
    (
      [
        [titled, '1.120'],
        [words, '1.118'],
        [remarks, '1.107'],
        [furnish, '1.102'],
        [c.world?.identity, '1.97'],
        [voices, '1.91'],
        [relative, '1.87'],
        [reader, '1.53'],
      ] as const
    ).find(([on]) => on)?.[1] ?? '1.46';
  return used && apiCmp(c.manifest.requires.kernel_api.at_least, floor) < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}
