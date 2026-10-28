// Toolbox row G7 lock roots, kept for nodes() in cartridge_refs.ts; the compiler checks locks
// (lib/loka/content/locks.ex).
import { step, type Obj } from './cartridge_refs.ts';

/** Each lock's policy root and its path: room and blueprint enter, exit traverse, item get and put. */
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
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj))
    if (n.locks) out.push([n.locks.get.root, `.cartridge.npcs${step(ref)}.locks.get.root`]);
  for (const [ref, b] of Object.entries((c.blueprints ?? {}) as Obj))
    if (b.locks)
      out.push([b.locks.enter.root, `.cartridge.blueprints${step(ref)}.locks.enter.root`]);
  return out;
}
