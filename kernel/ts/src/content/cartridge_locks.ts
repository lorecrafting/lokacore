// Toolbox row G7 at the cartridge trust boundary (twin of lib/loka/content/locks.ex): any access
// lock needs kernel_api 1.78, and a put lock only a container item may carry.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

/** Each lock's policy root and its path: room enter, exit traverse, item get and put. */
export function lockRoots(c: Obj): [Obj, string][] {
  const out: [Obj, string][] = [];
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    if (r.locks) out.push([r.locks.enter.root, `${at}.locks.enter.root`]);
    for (const [dir, e] of Object.entries((r.exits ?? {}) as Obj))
      if (e.locks) out.push([e.locks.traverse.root, `${at}.exits${step(dir)}.locks.traverse.root`]);
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj))
    for (const f of ['get', 'put'])
      if (i.locks?.[f]) out.push([i.locks[f].root, `.cartridge.items${step(ref)}.locks.${f}.root`]);
  return out;
}

/** KERNEL_API_RANGE_INVALID for any lock below 1.78; SCHEMA_VIOLATION for a put lock on a non-container. */
export function locks(c: Obj): Diagnostic[] {
  const floor =
    lockRoots(c).length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.78') < 0
      ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
      : [];
  return [
    ...floor,
    ...Object.entries((c.items ?? {}) as Obj)
      .filter(([, i]) => i.locks?.put && i.container !== true)
      .map(([ref]) =>
        diag('SCHEMA_VIOLATION', `.cartridge.items${step(ref)}.locks.put`, {
          error: 'invalid_value',
        }),
      ),
  ];
}
