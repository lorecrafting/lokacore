import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';
export function fuel(c: Obj, check: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
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
