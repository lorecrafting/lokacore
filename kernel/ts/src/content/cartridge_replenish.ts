// Compiler twin (lib/loka/content/replenish.ex): replenish entries (toolbox row 19b,
// docs/system/cartridge.md Replenish declarations).
import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { apiCmp } from './cartridge_installed.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';

export function replenish(c: Obj, { named }: Checks): Diagnostic[] {
  const entries = Object.entries((c.replenish ?? {}) as Obj);
  const out: Diagnostic[] =
    entries.length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.71') < 0
      ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
      : [];
  for (const [ref, r] of entries) {
    const at = `.cartridge.replenish${step(ref)}`;
    out.push(...stock(c, named, at, r.items, { from: r.from, to: r.to }));
    if (same(r.from, r.to)) out.push(diag('SCHEMA_VIOLATION', `${at}.from`));
  }
  return out;
}

/** Homestead hs-10: each craft recipe's consume and yield (docs/system/cartridge.md Craft). */
export function craft(c: Obj, { named, text }: Checks): Diagnostic[] {
  const crafts = Object.entries((c.recipes ?? {}) as Obj).filter(([, r]) => r.craft);
  const out: Diagnostic[] =
    crafts.length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.101') < 0
      ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
      : [];
  for (const [ref, r] of crafts) {
    const at = `.cartridge.recipes${step(ref)}.craft`;
    const { consume, yield: made } = r.craft;
    // A spell or storylet has no station whose stock it could use (craft recipes are station recipes).
    if (['spell', 'storylet'].includes(r.target.kind))
      out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
    if (consume) {
      out.push(...stock(c, named, `${at}.consume`, consume.items, { to: consume.to }));
      text(consume, ['reason'], `${at}.consume`);
    }
    if (made) out.push(...stock(c, named, `${at}.yield`, made.items, { from: made.from }));
  }
  return out;
}

// Replenish's item and holder rules, shared with craft: no duplicate item, each item and holder
// resolves, and each holder (`ends`, by field) is placed.
function stock(
  c: Obj,
  named: Checks['named'],
  at: string,
  items: DefinitionRef[],
  ends: Obj,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (new Set(items.map(refString)).size !== items.length)
    out.push(diag('DUPLICATE_DEFINITION', `${at}.items`));
  items.forEach((i, n) => named(i, 'item', `${at}.items[${n}]`));
  const nests = items.some((i) => c.items?.[refString(i)]?.container === true);
  for (const [end, l] of Object.entries(ends)) {
    if (l.in === 'template' || !placed(c, l, end === 'to' && nests))
      out.push(diag('SCHEMA_VIOLATION', `${at}.${end}`));
    else named(l[l.in], l.in, `${at}.${end}.${l.in}`);
  }
  return out;
}

// A holder needs a placed entity, and an item holder must be a container: a spawn template has
// none (nor a template item), a non-container takes nothing. An item target also refuses any
// listed container (`nests`): it may be or hold the target, so the move would nest it in itself.
function placed(c: Obj, l: Obj, nests: boolean): boolean {
  const { in: k, [l.in]: ref } = l;
  const d = k === 'room' ? undefined : (k === 'npc' ? c.npcs : c.items)?.[refString(ref)];
  if (!d) return true;
  if (d.spawn_template || d.location?.in === 'template') return false;
  return k !== 'item' || (d.container === true && !nests);
}

/** The items a replenish entry refills into `room` (a harvest seam's stock may start elsewhere). */
export const refilled = (c: Obj, room: DefinitionRef): Set<string> =>
  new Set(
    Object.values((c.replenish ?? {}) as Obj)
      .filter((r) => r.to.in === 'room' && same(r.to.room, room))
      .flatMap((r) => r.items.map(refString)),
  );
