// Toolbox row 2 derived-stat tables (hp_max: loka-kgd.8) and row 3 item affects in the loaded
// artifact; twin of Loka.Content.Derived.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

// hp_max needs no setting: every compiled cartridge has the hp pool (and without one it moves nothing).
const NEEDS = { hit_chance: 'combat', damage: 'combat', carry_grams: 'carry', hp_max: undefined };

export function derived(c: Obj, named: Checks['named']): Diagnostic[] {
  const out = affects(c, named);
  const table = c.world?.derived as Obj | undefined;
  if (!table) return out;
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

// Toolbox row 3: an item's affects need its slot, attributes@1, API 1.41 and real attributes.
function affects(c: Obj, named: Checks['named']): Diagnostic[] {
  const items = Object.entries((c.items ?? {}) as Obj).filter(([, i]) => i.affects);
  const out: Diagnostic[] = [];
  if (items.length > 0 && apiCmp(c.manifest.requires.kernel_api.at_least, '1.41') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, item] of items) {
    const at = `.cartridge.items${step(ref)}.affects`;
    if (c.lock.capabilities.attributes !== 1)
      out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'attributes' }, ['attributes@1']));
    if (item.slot === undefined) out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
    for (const [i, a] of (item.affects as Obj[]).entries())
      named(a.attribute, 'attribute', `${at}[${i}].attribute`);
  }
  return out;
}
