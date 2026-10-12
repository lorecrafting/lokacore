// Toolbox row 2 derived-stat tables (hp_max: loka-kgd.8), row 3 item affects, row 27 identified
// items, row G3 NPC attributes and balance 6b's gear budget in the loaded artifact; twin of
// Loka.Content.Derived.
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';
import { refString } from '../runtime/decision.ts';
import type { Diagnostic } from '../contracts.gen.ts';

// hp_max needs no setting: every compiled cartridge has the hp pool (and without one it moves nothing).
const NEEDS = { hit_chance: 'combat', damage: 'combat', carry_grams: 'carry', hp_max: undefined };

const API = '.cartridge.manifest.requires.kernel_api.at_least';
const OWNER = ['UNDECLARED_CAPABILITY', { capability: 'attributes' }, ['attributes@1']] as const;

export function derived(c: Obj, named: Checks['named']): Diagnostic[] {
  const table = c.world?.derived as Obj | undefined;
  const items = Object.entries((c.items ?? {}) as Obj) as [string, Obj][];
  const npcs = Object.entries((c.npcs ?? {}) as Obj) as [string, Obj][];
  // A gear budget or an intended level is balance 6b (1.72); an identified item is row 27 (1.68);
  // NPC attributes are row G3 (API 1.46, with an opposed check naming an NPC); finger slots and
  // affects row 3 (1.41); hp_max 1.40; the other tables 1.39.
  const g3 =
    npcs.some(([, n]) => n.attributes) ||
    Object.values((c.recipes ?? {}) as Obj).some((r) => r.check?.npc);
  const row3 = items.some(([, i]) => i.affects || i.slot === 'finger');
  const row27 = items.some(([, i]) => i.identified);
  const budget = c.world?.gear_budget;
  const floor =
    budget || items.some(([, i]) => i.intended_level !== undefined)
      ? '1.72'
      : row27
        ? '1.68'
        : g3
          ? '1.46'
          : row3
            ? '1.41'
            : table?.hp_max
              ? '1.40'
              : table && '1.39';
  const out: Diagnostic[] = [];
  if (floor && apiCmp(c.manifest.requires.kernel_api.at_least, floor) < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', API));
  if (table) out.push(...tables(c, table, named));
  out.push(...gearBudget(c, items));
  for (const [ref, item] of items) if (item.affects) out.push(...affects(c, ref, item, named));
  for (const [ref, item] of items)
    if (item.identified) out.push(...identified(c, ref, item, named));
  for (const [ref, npc] of npcs) if (npc.attributes) out.push(...npcAttributes(c, ref, npc, named));
  return out;
}

// Balance 6b: a gear budget needs attributes@1; an intended level sits beside affects.
function gearBudget(c: Obj, items: [string, Obj][]): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (c.world?.gear_budget && c.lock.capabilities.attributes !== 1)
    out.push(diag(OWNER[0], '.cartridge.world.gear_budget', OWNER[1], [...OWNER[2]]));
  for (const [ref, item] of items)
    if (item.intended_level !== undefined && !item.affects)
      out.push(
        diag('SCHEMA_VIOLATION', `.cartridge.items${step(ref)}.intended_level`, {
          error: 'invalid_value',
        }),
      );
  return out;
}

// Row G3: an NPC's attributes each name a distinct real attribute (an attributes section already
// needs attributes@1).
function npcAttributes(c: Obj, ref: string, npc: Obj, named: Checks['named']): Diagnostic[] {
  const at = `.cartridge.npcs${step(ref)}.attributes`;
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const [i, a] of (npc.attributes as Obj[]).entries()) {
    named(a.attribute, 'attribute', `${at}[${i}].attribute`);
    if (seen.has(refString(a.attribute)))
      out.push(diag('SCHEMA_VIOLATION', `${at}[${i}].attribute`, { error: 'invalid_value' }));
    seen.add(refString(a.attribute));
  }
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

// Toolbox row 27: an item's identified names a bool fact of this cartridge and sits beside affects
// (a per_subject fact there is FACT_SCOPE_UNSUPPORTED in the W2 site walk).
function identified(c: Obj, ref: string, item: Obj, named: Checks['named']): Diagnostic[] {
  const at = `.cartridge.items${step(ref)}.identified`;
  const out: Diagnostic[] = [];
  named(item.identified, 'fact', at);
  const spec = c.facts[refString(item.identified)];
  if (spec && spec.value_type.type !== 'bool') out.push(diag('FACT_TYPE_MISMATCH', at));
  if (!item.affects) out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  return out;
}
