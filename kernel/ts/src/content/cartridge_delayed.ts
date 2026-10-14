// Toolbox row FD1 at the cartridge trust boundary: a reaction's `after`, the fact.stamp step and the
// time_since leaf need kernel_api 1.88; a delayed rule carries no step that reads its event; a
// stamped or timed fact is an int fact that can hold any clock value. Twin of lib/loka/content/delayed.ex.
import { refString } from '../runtime/decision.ts';
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

const EVENT_BOUND = ['barrier.set', 'item.move', 'population.suppress'];

export function delayed(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const clock = (fact: DefinitionRef, at: string) => {
    const t = c.facts?.[refString(fact)]?.value_type;
    if (t && (t.type !== 'int' || t.maximum !== undefined || (t.minimum ?? 0) > 0))
      out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  };
  let used = false;
  for (const [ref, r] of Object.entries((c.reactions ?? {}) as Obj)) {
    const at = `.cartridge.reactions${step(ref)}`;
    used ||= r.after !== undefined;
    r.apply.forEach((s: Obj, i: number) => {
      if (s.op === 'fact.stamp') ((used = true), clock(s.fact, `${at}.apply[${i}].fact`));
      if (
        r.after !== undefined &&
        (EVENT_BOUND.includes(s.op) || (s.op === 'status.apply' && (s.co_present || s.tag)))
      )
        out.push(diag('SCHEMA_VIOLATION', `${at}.apply[${i}].op`, { error: 'invalid_value' }));
    });
  }
  for (const [n, at] of nodes(c))
    if (n.op === 'time_since') ((used = true), clock(n.fact, `${at}.fact`));
  if (used && apiCmp(c.manifest.requires.kernel_api.at_least, '1.88') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
