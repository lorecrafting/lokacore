import { refString } from '../runtime/decision.ts';
import { checkers, diag, step, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';
import { apiCmp } from './cartridge_installed.ts';

export function food(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [],
    check = checkers(c, out),
    hp = ((c.world?.derived?.hp_max?.terms ?? []) as Obj[]).map((t) => refString(t.attribute));
  for (const [ref, item] of Object.entries((c.items ?? {}) as Obj)) {
    if (!item.edible) continue;
    const e = item.edible,
      at = `.cartridge.items${step(ref)}.edible`;
    check.text(e, ['label', 'narration'], at);
    check.named(e.resource, 'resource', `${at}.resource`);
    const recovery = c.resources?.[refString(e.resource)];
    // Row hs-5: a meal's `applies` needs 1.101.
    if (apiCmp(c.manifest.requires.kernel_api.at_least, e.applies ? '1.101' : '1.27') < 0)
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    if (
      recovery?.key !== 'mv' ||
      !recovery?.regen ||
      recovery.regen.by_position.standing <= 0 ||
      item.container ||
      ['capacity', 'slot', 'weapon', 'block_chance', 'fuel', 'vessel'].some(
        (k) => item[k] !== undefined,
      ) ||
      c.lock.capabilities.containment !== 1 ||
      c.lock.capabilities.resource !== 1
    )
      out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
    // Row hs-5: a meal's status never moves the derived hp maximum (loka-kgd.50).
    ((e.applies ?? []) as Obj[]).forEach((s, n) => {
      const modifies = (c.statuses?.[refString(s as never)]?.modifies ?? []) as Obj[];
      if (modifies.some((m) => hp.includes(refString(m.attribute as never))))
        out.push(diag('SCHEMA_VIOLATION', `${at}.applies[${n}]`));
    });
  }
  return out;
}
