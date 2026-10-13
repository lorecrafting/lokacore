import { diag, step, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';

/** Authored identities, starting custody and explicitly funded conserved currency. */
export function commerce(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [ref, npc] of Object.entries((c.npcs ?? {}) as Obj)) {
    if (!npc.shop) continue;
    const at = `.cartridge.npcs${step(ref)}.shop`;
    const s = npc.shop,
      resource = c.resources?.[refString(s.resource)];
    const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < 16)) out.push(diag('KERNEL_API_RANGE_INVALID', at));
    if (s.offers.some((o: Obj) => o.stock) && (major < 1 || (major === 1 && minor < 82)))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    const ids = s.offers.map((o: Obj) => refString(o.item));
    if (new Set(ids).size !== ids.length) out.push(diag('DUPLICATE_DEFINITION', at));
    if (
      !resource ||
      resource.gain !== 0 ||
      resource.regen ||
      resource.start < resource.minimum ||
      npc.resource_starts?.[s.resource.key] === undefined
    )
      out.push(diag('RESOURCE_SPEC_INVALID', at));
    const plain = s.offers.filter((o: Obj) => !o.stock).map((o: Obj) => refString(o.item));
    s.offers.forEach((o: Obj, i: number) =>
      out.push(...stock(c, o, `${at}.offers[${i}].stock`, plain)),
    );
    for (const o of s.offers) {
      const item = c.items?.[refString(o.item)];
      if (
        !item ||
        o.item.kind !== 'item' ||
        item.location.in !== 'npc' ||
        refString(item.location.npc) !== ref
      )
        out.push(diag('UNRESOLVED_REFERENCE', at));
    }
    if (!discountValid(c, s, npc)) out.push(diag('RESOURCE_SPEC_INVALID', `${at}.buy_discount`));
    for (const field of ['bought', 'sold'])
      if (!Object.hasOwn(c.text, s[field]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${field}`));
  }
  return out;
}

// A skill of this cartridge, or (row 15) friendly with a friendly disposition (the schema admits exactly one).
function discountValid(c: Obj, s: Obj, npc: Obj) {
  const d = s.buy_discount;
  return (
    !d ||
    ((d.friendly
      ? npc.disposition?.friendly
      : c.manifest.requires.capabilities.skills &&
        d.skill?.kind === 'skill' &&
        c.skills?.[refString(d.skill)]) &&
      d.numerator <= d.denominator &&
      s.offers
        .flatMap((o: Obj) => [o.buy, ...(o.stock?.buy ?? [])])
        .every((buy: number) => d.minimum <= buy && Number.isSafeInteger(buy * d.numerator)))
  );
}

// Toolbox row W11: a price per count of a set of distinct items led by the offer's own.
function stock(c: Obj, o: Obj, at: string, plain: string[]): Diagnostic[] {
  if (!o.stock) return [];
  const { items, buy } = o.stock,
    keys = items.map((r: Obj) => refString(r as never));
  const out = items.flatMap((r: Obj, i: number) =>
    r.kind === 'item' && c.items?.[keys[i]]
      ? []
      : [diag('UNRESOLVED_REFERENCE', `${at}.items[${i}]`)],
  );
  if (new Set(keys).size !== keys.length || keys.some((k: string) => plain.includes(k)))
    out.push(diag('DUPLICATE_DEFINITION', `${at}.items`));
  if (buy.length !== items.length || keys[0] !== refString(o.item) || buy[0] !== o.buy)
    out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  return out;
}
