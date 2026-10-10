import { diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

/**
 * Checked toolbox row 1, G3, 2c and G13 (liquid cures) declarations in the loaded artifact, independent of source
 * compilation; only a status with `modifies` (row 2c) may omit `per_tick`.
 */
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
  const { immune, named, drinks, lone, g3 } = api146(c);
  if (!Object.keys(defs).length && !applies.length && !cures.length && !g3) return out;
  if (
    apiCmp(c.manifest.requires.kernel_api.at_least, g3 ? '1.46' : '1.38') < 0 ||
    ['status', 'death'].some((k) => c.lock.capabilities[k] !== 1) // a fatal hp tick needs death
  )
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, s] of Object.entries(defs)) {
    const at = `.cartridge.statuses${step(ref)}`;
    if (!c.resources?.[refString(s.resource)])
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.resource`));
    if (s.tick_every >= s.duration) out.push(diag('SCHEMA_VIOLATION', `${at}.tick_every`));
    if (s.per_tick === 0 || (s.per_tick === undefined && !s.modifies))
      out.push(diag('SCHEMA_VIOLATION', `${at}.per_tick`));
    if (!c.text?.[s.label]) out.push(diag('SCHEMA_VIOLATION', `${at}.label`));
    if (Object.values(s.narration as Obj).some((k) => !c.text?.[k as string]))
      out.push(diag('SCHEMA_VIOLATION', `${at}.narration`));
  }
  for (const [at, ref] of [...applies, ...cures, ...drinks, ...immune])
    if (!defs[refString(ref as never)]) out.push(diag('UNRESOLVED_REFERENCE', at));
  for (const [at, ref, table] of named)
    if (!c[table]?.[refString(ref as never)]) out.push(diag('UNRESOLVED_REFERENCE', at));
  return [...out, ...lone.map((at) => diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }))];
}

// The fields needing kernel_api 1.46: row G3's immune list entries, steps naming an item and tick or
// expiry triggers; row 2c's status modifiers (each attribute, with the table it names); row G13's
// liquid cures (ended by Drink). `g3` says whether any is used.
function api146(c: Obj) {
  const immune = (['npcs', 'items'] as const).flatMap((kind) =>
    Object.entries(c[kind] ?? {}).flatMap(([ref, e]: [string, any]) =>
      ((e.immune ?? []) as Obj[]).map((s, n) => [`.cartridge.${kind}${step(ref)}.immune[${n}]`, s]),
    ),
  ) as [string, Obj][];
  const items = Object.entries(c.reactions ?? {}).flatMap(([ref, r]: [string, any]) =>
    (r.apply as Obj[]).flatMap((s, i) =>
      s.op !== 'status.apply'
        ? []
        : (['item', 'npc'] as const)
            .filter((f) => s[f])
            .map((f) => [`.cartridge.reactions${step(ref)}.apply[${i}].${f}`, s[f], `${f}s`, s]),
    ),
  ) as [string, Obj, string, Obj][];
  // Row 42: a step names one holder, and a spawn template has no instance to take it.
  const lone = items.flatMap(([at, ref, table, s]) =>
    table === 'npcs' && (c.npcs?.[refString(ref as never)]?.spawn_template || s.item) ? [at] : [],
  );
  const modifies = Object.entries(c.statuses ?? {}).flatMap(([ref, s]: [string, any]) =>
    ((s.modifies ?? []) as Obj[]).map((m, n) => [
      `.cartridge.statuses${step(ref)}.modifies[${n}].attribute`,
      m.attribute,
      'attributes',
    ]),
  ) as [string, Obj, string][];
  const drinks = Object.entries(c.liquids ?? {}).flatMap(([ref, l]: [string, any]) =>
    ((l.cures ?? []) as Obj[]).map((s, n) => [`.cartridge.liquids${step(ref)}.cures[${n}]`, s]),
  ) as [string, Obj][];
  const g3 =
    immune.length ||
    drinks.length ||
    items.length ||
    modifies.length ||
    Object.values(c.reactions ?? {}).some((r: any) => r.on.event.startsWith('status_'));
  return { immune, named: [...items, ...modifies], drinks, lone, g3 };
}
