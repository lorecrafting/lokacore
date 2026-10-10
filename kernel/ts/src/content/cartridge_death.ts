// Only the corpse/return settings used by death@1; no general spawning surface.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { same } from '../foundation/compose.ts';
import { apiCmp } from './cartridge_installed.ts';
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
    const ordinary = d && [d.player_corpse, d.npc_corpse].some((r) => refString(r) === ref);
    const bundleRoles = Object.values(c.population_bundles ?? {}).flatMap((b: any) =>
      ['item', 'corpse'].filter((role) => b[role] && refString(b[role]) === ref),
    );
    if (!ordinary && bundleRoles.length === 0) bad(`${at}.location`);
    if (ordinary || bundleRoles.includes('corpse')) {
      if (i.container !== true) bad(`${at}.container`);
    } else if (i.container !== undefined) bad(`${at}.container`);
    for (const field of ['capacity', 'slot', 'barrier'])
      if (i[field] !== undefined) bad(`${at}.${field}`);
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj))
    if (i.location.in === 'item' && c.items[refString(i.location.item)]?.location.in === 'template')
      bad(`.cartridge.items${step(ref)}.location.item`);
  out.push(...drops(c, named));
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

// Toolbox row 8: each drop names a distinct item its NPC holds at genesis.
function drops(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  const tables = Object.entries((c.npcs ?? {}) as Obj).filter(([, n]) => n.drops);
  if (tables.length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.43') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, npc] of tables) {
    const at = `.cartridge.npcs${step(ref)}.drops`;
    // Only combat kills an NPC: a table needs world.death, hp and a genesis (not template) NPC.
    if (!c.world?.death || !npc.hp || npc.spawn_template)
      out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
    const seen = new Set<string>();
    for (const [i, { item }] of (npc.drops as Obj[]).entries()) {
      named(item, 'item', `${at}[${i}].item`);
      const location = c.items?.[refString(item)]?.location;
      const held = location?.in === 'npc' && refString(location.npc) === ref;
      if (seen.has(refString(item)) || (location && !held))
        out.push(diag('SCHEMA_VIOLATION', `${at}[${i}]`, { error: 'invalid_value' }));
      seen.add(refString(item));
    }
  }
  return out;
}
