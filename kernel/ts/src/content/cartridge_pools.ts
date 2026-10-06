import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

// Each resource's bounds hold its start (RESOURCE_SPEC_INVALID), each band table (a pool's,
// the world's) is well formed (bands), and the world's move cost names a resource of this
// cartridge.
export function pools(c: Obj, named: Checks['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [ref, s] of Object.entries((c.resources ?? {}) as Obj)) {
    const at = `.cartridge.resources${step(ref)}`;
    if (!(s.minimum <= s.start && s.start <= s.maximum))
      out.push(diag('RESOURCE_SPEC_INVALID', at));
    if (s.regen) {
      const { every, by_position } = s.regen;
      if (
        every >
        Math.floor(
          Number.MAX_SAFE_INTEGER / (Math.max(...(Object.values(by_position) as number[])) + 1),
        )
      )
        out.push(diag('RESOURCE_SPEC_INVALID', `${at}.regen`));
      if (c.lock.capabilities.position !== 1)
        out.push(
          diag('UNDECLARED_CAPABILITY', `${at}.regen`, { capability: 'position' }, ['position@1']),
        );
      if (c.manifest.time_policy?.profile !== 'real_elapsed')
        out.push(diag('INVALID_TIME_POLICY', `${at}.regen`));
      const api = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
      if (api[0] < 1 || (api[0] === 1 && api[1] < 2))
        out.push(
          diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
        );
    }
    if (s.bands) out.push(...bands(c, s.bands, `${at}.bands`));
  }
  out.push(...npcHp(c));
  out.push(...npcStarts(c));
  if (c.world?.bands) out.push(...bands(c, c.world.bands, '.cartridge.world.bands'));
  const cost = c.world?.movement?.cost;
  if (cost) named(cost.resource, 'resource', '.cartridge.world.movement.cost.resource');
  return out;
}

function npcHp(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [ref, npc] of Object.entries(c.npcs ?? {}) as [string, Obj][]) {
    if (!npc.hp) continue;
    const at = `.cartridge.npcs${step(ref)}.hp`;
    if (!(npc.hp.minimum <= npc.hp.start && npc.hp.start <= npc.hp.maximum))
      out.push(diag('RESOURCE_SPEC_INVALID', at));
    const api = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (api[0] < 1 || (api[0] === 1 && api[1] < 4))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    if (!Object.values(c.resources ?? {}).some((s: any) => s.key === 'hp'))
      out.push(diag('RESOURCE_SPEC_INVALID', at));
  }
  return out;
}

// A condition band table (resource.schema.json BandTable) at `at`: cuts strictly descending to a
// last 0 and keys unique (RESOURCE_SPEC_INVALID at the table), each key's band.<key> text in the
// catalog (UNRESOLVED_REFERENCE at the key).
function bands(c: Obj, table: Obj[], at: string): Diagnostic[] {
  const sorted = table.every((b, i) => i === 0 || b.at_percent < table[i - 1].at_percent);
  const unique = new Set(table.map((b) => b.key)).size === table.length;
  const out =
    sorted && unique && table.at(-1)!.at_percent === 0 ? [] : [diag('RESOURCE_SPEC_INVALID', at)];
  table.forEach(({ key }, i) => {
    if (!Object.hasOwn(c.text, `band.${key}`))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}[${i}].key`, { target: `band.${key}` }));
  });
  return out;
}

function npcStarts(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [ref, npc] of Object.entries((c.npcs ?? {}) as Obj))
    for (const [name, value] of Object.entries((npc.resource_starts ?? {}) as Obj)) {
      const spec = Object.values((c.resources ?? {}) as Obj).find((r) => r.key === name);
      if (!spec || (value as number) < spec.minimum || (value as number) > spec.maximum)
        out.push(
          diag('RESOURCE_SPEC_INVALID', `.cartridge.npcs${step(ref)}.resource_starts${step(name)}`),
        );
    }
  return out;
}
