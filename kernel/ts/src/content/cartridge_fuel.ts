import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';
export function fuel(c: Obj, check: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const rooms = Object.values((c.rooms ?? {}) as Obj);
  // A dark flag (loka-x6t.36) needs 1.114; fuel or a dark_description 1.19.
  const floor = rooms.some((r) => r.dark)
    ? 114
    : [...Object.values((c.items ?? {}) as Obj), ...rooms].some((d) => d.fuel || d.dark_description)
      ? 19
      : 0;
  if (floor) {
    const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < floor))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
  }
  for (const [ref, item] of Object.entries((c.items ?? {}) as Obj)) {
    const f = item.fuel;
    if (!f) continue;
    const at = `.cartridge.items${step(ref)}.fuel`;
    if (f.initial > f.capacity || item.location.in === 'template')
      out.push(diag('SCHEMA_VIOLATION', at));
    if (f.kind === 'source') {
      check.named(f.supply, 'item', `${at}.supply`);
      const supply = c.items[refString(f.supply)]?.fuel;
      if (!supply || supply.kind !== 'supply' || supply.unit !== f.unit)
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.supply`));
      check.text(f, ['ignited', 'doused', 'refueled'], at);
    }
  }
  return out;
}
