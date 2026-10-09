// Toolbox row 2 derived-stat tables (hp_max: loka-kgd.8) in the loaded artifact; twin of Loka.Content.Derived.
import { diag, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

// hp_max needs no setting: every compiled cartridge has the hp pool (and without one it moves nothing).
const NEEDS = { hit_chance: 'combat', damage: 'combat', carry_grams: 'carry', hp_max: undefined };

export function derived(c: Obj, named: Checks['named']): Diagnostic[] {
  const table = c.world?.derived as Obj | undefined;
  if (!table) return [];
  const out: Diagnostic[] = [];
  const at = '.cartridge.world.derived';
  if (apiCmp(c.manifest.requires.kernel_api.at_least, table.hp_max ? '1.40' : '1.39') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  if (c.lock.capabilities.attributes !== 1)
    out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'attributes' }, ['attributes@1']));
  for (const [stat, needs] of Object.entries(NEEDS)) {
    if (!table[stat]) continue;
    if (needs && !c.world[needs])
      out.push(diag('SCHEMA_VIOLATION', `${at}.${stat}`, { error: 'invalid_value' }));
    for (const [i, term] of (table[stat].terms as Obj[]).entries())
      named(term.attribute, 'attribute', `${at}.${stat}.terms[${i}].attribute`);
  }
  return out;
}
