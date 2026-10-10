import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';
// Items and NPCs start in containers that form no cycle (CONTAINMENT_CYCLE, at each item on
// one) and hold at most their capacity (CAPACITY_EXCEEDED).
export function holders(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const items: Obj = c.items ?? {};
  const inside = (i?: Obj) => (i?.location.in === 'item' ? refString(i.location.item) : undefined);
  const held: Record<string, number> = {};
  for (const [ref, i] of Object.entries(items)) {
    const path = `.cartridge.items${step(ref)}`;
    if (i.container !== true)
      for (const field of ['capacity', 'barrier'])
        if (i[field] !== undefined)
          out.push(diag('SCHEMA_VIOLATION', `${path}.${field}`, { error: 'invalid_value' }));
    const holder = items[inside(i) ?? ''];
    if (holder && holder.container !== true)
      out.push(diag('SCHEMA_VIOLATION', `${path}.location.item`, { error: 'invalid_value' }));
    if (i.location.in === 'template') continue;
    const at = refString(i.location[i.location.in]);
    held[at] = (held[at] ?? 0) + 1;
    let up = inside(i);
    for (let n = 0; up !== undefined && up !== ref && n < Object.keys(items).length; n++)
      up = inside(items[up]);
    if (up === ref)
      out.push(diag('CONTAINMENT_CYCLE', `.cartridge.items${step(ref)}.location.item`));
  }
  for (const map of ['npcs', 'items'])
    for (const [ref, h] of Object.entries((c[map] ?? {}) as Obj))
      if (h.capacity !== undefined && (held[ref] ?? 0) > h.capacity)
        out.push(
          diag('CAPACITY_EXCEEDED', `.cartridge.${map}${step(ref)}.capacity`, {
            capacity: h.capacity,
            held: held[ref],
          }),
        );
  return out;
}
