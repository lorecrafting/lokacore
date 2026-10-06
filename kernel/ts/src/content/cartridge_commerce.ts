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
    if (!discountValid(c, s)) out.push(diag('RESOURCE_SPEC_INVALID', `${at}.buy_discount`));
    for (const field of ['bought', 'sold'])
      if (!Object.hasOwn(c.text, s[field]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${field}`));
  }
  return out;
}

function discountValid(c: Obj, s: Obj) {
  const d = s.buy_discount;
  return (
    !d ||
    (c.manifest.requires.capabilities.skills &&
      d.skill.kind === 'skill' &&
      c.skills?.[refString(d.skill)] &&
      d.numerator <= d.denominator &&
      s.offers.every((o: Obj) => d.minimum <= o.buy && Number.isSafeInteger(o.buy * d.numerator)))
  );
}
