// Toolbox row 2 derived-stat tables (hp_max: loka-kgd.8) and row 3 item affects in the loaded
// artifact; twin of Loka.Content.Derived.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

// hp_max needs no setting: every compiled cartridge has the hp pool (and without one it moves nothing).
const NEEDS = { hit_chance: 'combat', damage: 'combat', carry_grams: 'carry', hp_max: undefined };

const API = '.cartridge.manifest.requires.kernel_api.at_least';
const OWNER = ['UNDECLARED_CAPABILITY', { capability: 'attributes' }, ['attributes@1']] as const;

export function derived(c: Obj, named: Checks['named']): Diagnostic[] {
  const table = c.world?.derived as Obj | undefined;
  const items = Object.entries((c.items ?? {}) as Obj) as [string, Obj][];
  // Finger slots and affects are row 3 (API 1.41); hp_max 1.40; the other tables 1.39.
  const row3 = items.some(([, i]) => i.affects || i.slot === 'finger');
  const floor = row3 ? '1.41' : table?.hp_max ? '1.40' : table && '1.39';
  const out: Diagnostic[] = [];
  if (floor && apiCmp(c.manifest.requires.kernel_api.at_least, floor) < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', API));
  if (table) out.push(...tables(c, table, named));
  for (const [ref, item] of items) if (item.affects) out.push(...affects(c, ref, item, named));
  return out;
}

function tables(c: Obj, table: Obj, named: Checks['named']): Diagnostic[] {
  const at = '.cartridge.world.derived';
  const out: Diagnostic[] = [];
  if (c.lock.capabilities.attributes !== 1) out.push(diag(OWNER[0], at, OWNER[1], [...OWNER[2]]));
  for (const [stat, needs] of Object.entries(NEEDS)) {
    if (!table[stat]) continue;
    if (needs && !c.world[needs])
      out.push(diag('SCHEMA_VIOLATION', `${at}.${stat}`, { error: 'invalid_value' }));
    for (const [i, term] of (table[stat].terms as Obj[]).entries())
      named(term.attribute, 'attribute', `${at}.${stat}.terms[${i}].attribute`);
  }
  return out;
}

// Toolbox row 3: an item's affects need its slot, attributes@1 and real attributes.
function affects(c: Obj, ref: string, item: Obj, named: Checks['named']): Diagnostic[] {
  const at = `.cartridge.items${step(ref)}.affects`;
  const out: Diagnostic[] = [];
  if (c.lock.capabilities.attributes !== 1) out.push(diag(OWNER[0], at, OWNER[1], [...OWNER[2]]));
  if (item.slot === undefined) out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  for (const [i, a] of (item.affects as Obj[]).entries())
    named(a.attribute, 'attribute', `${at}[${i}].attribute`);
  return out;
}
