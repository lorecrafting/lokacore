import { refString } from '../runtime/decision.ts';
import { checkers, diag, step, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function food(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [],
    check = checkers(c, out);
  for (const [ref, item] of Object.entries((c.items ?? {}) as Obj)) {
    if (!item.edible) continue;
    const e = item.edible,
      at = `.cartridge.items${step(ref)}.edible`;
    check.text(e, ['label', 'narration'], at);
    check.named(e.resource, 'resource', `${at}.resource`);
    const recovery = c.resources?.[refString(e.resource)];
    const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < 27))
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
  }
  return out;
}
