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
    const items = r.items as DefinitionRef[];
    if (new Set(items.map(refString)).size !== items.length)
      out.push(diag('DUPLICATE_DEFINITION', `${at}.items`));
    items.forEach((i, n) => named(i, 'item', `${at}.items[${n}]`));
    for (const end of ['from', 'to']) {
      const { in: k } = r[end];
      if (k === 'template') out.push(diag('SCHEMA_VIOLATION', `${at}.${end}`));
      else named(r[end][k], k, `${at}.${end}.${k}`);
    }
    if (same(r.from, r.to)) out.push(diag('SCHEMA_VIOLATION', `${at}.from`));
  }
  return out;
}

/** The items a replenish entry refills into `room` (a harvest seam's stock may start elsewhere). */
export const refilled = (c: Obj, room: DefinitionRef): Set<string> =>
  new Set(
    Object.values((c.replenish ?? {}) as Obj)
      .filter((r) => r.to.in === 'room' && same(r.to.room, room))
      .flatMap((r) => r.items.map(refString)),
  );
