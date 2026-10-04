// Only the corpse/return settings used by death@1; no general spawning surface.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { same } from '../foundation/compose.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function death(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  const d = c.world?.death;
  const bad = (at: string) => out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  const templates = Object.entries((c.items ?? {}) as Obj).filter(
    ([, i]) => i.location.in === 'template',
  );
  for (const [ref, i] of templates) {
    const at = `.cartridge.items${step(ref)}`;
    if (!d || ![d.player_corpse, d.npc_corpse].some((r) => refString(r) === ref))
      bad(`${at}.location`);
    for (const field of ['capacity', 'slot', 'barrier'])
      if (i[field] !== undefined) bad(`${at}.${field}`);
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj))
    if (i.location.in === 'item' && c.items[refString(i.location.item)]?.location.in === 'template')
      bad(`.cartridge.items${step(ref)}.location.item`);
  if (!d) return out;
  out.push(...requirements(c));
  named(d.shrine, 'room', '.cartridge.world.death.shrine');
  for (const field of ['player_corpse', 'npc_corpse']) {
    named(d[field], 'item', `.cartridge.world.death.${field}`);
    const item = c.items?.[refString(d[field])];
    if (item && item.location.in !== 'template') bad(`.cartridge.world.death.${field}`);
  }
  if (same(d.player_corpse, d.npc_corpse)) bad('.cartridge.world.death.npc_corpse');
  for (const pool of ['hp', 'mv']) {
    const spec = Object.values((c.resources ?? {}) as Obj).find((s) => s.key === pool);
    if (!spec || d.restore[pool] < spec.minimum || d.restore[pool] > spec.maximum)
      bad(`.cartridge.world.death.restore.${pool}`);
  }
  return out;
}

function requirements(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  if (major < 1 || (major === 1 && minor < 5))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const capability of ['death', 'containment', 'position'])
    if (c.lock.capabilities[capability] !== 1)
      out.push(
        diag('UNDECLARED_CAPABILITY', '.cartridge.world.death', { capability }, [
          `${capability}@1`,
        ]),
      );
  return out;
}
