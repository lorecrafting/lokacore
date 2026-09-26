// The loader's barrier checks (barrier@1; room.schema.json BarrierDefinition, Connection.barrier;
// 21 §5 Barrier; 05 §17, §25), twin of lib/loka/content/barriers.ex: references, coherent faces
// and keys that can be reached.
import type { DefinitionRef, Diagnostic } from './contracts.gen.ts';
import { same } from './compose.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from './decision.ts';

type Named = (r: Obj, kind: string, path: string) => void;
const OPPOSITE: Readonly<Record<string, string>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
};

// Each exit's barrier names a barrier of this cartridge; an exit with a barrier and its reciprocal
// face (its destination's exit in the opposite direction, when that leads back) name the same
// one (BARRIER_MISMATCH at each face that has a barrier or a disagreeing reciprocal); each
// barrier's key_item names an item of it; and no locked barrier's key is out of reach
// (BARRIER_UNREACHABLE_KEY, lockout).
export function barriers(c: Obj, named: Named): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [ref, r] of Object.entries(c.rooms as Obj))
    for (const [dir, exit] of Object.entries(r.exits as Obj)) {
      const at = `.cartridge.rooms${step(ref)}.exits.${dir}`;
      if (exit.barrier) named(exit.barrier, 'barrier', `${at}.barrier`);
      const back = c.rooms[refString(exit.to)]?.exits?.[OPPOSITE[dir]];
      const face = back && refString(back.to) === ref ? back : undefined;
      if ((exit.barrier || face?.barrier) && !(face && same(face.barrier, exit.barrier)))
        out.push(diag('BARRIER_MISMATCH', at));
    }
  for (const [ref, b] of Object.entries((c.barriers ?? {}) as Obj))
    if (b.key_item) named(b.key_item, 'item', `.cartridge.barriers${step(ref)}.key_item`);
  return [...out, ...lockout(c)];
}

/**
 * BARRIER_UNREACHABLE_KEY at each locked barrier on an exit of a room reachable from the entry
 * whose key never comes within reach: rooms are reached from the entry through exits without a
 * barrier or whose barrier starts open, closed, or locked with a key already in reach; a key is in
 * reach when it starts in a reached room or inside an item in reach. A barrier whose key_item names
 * no item is left to UNRESOLVED_REFERENCE. ponytail: initial states and item locations only, no
 * recipes, facts or NPCs; 05 §17 reachability and the Lab's state-space search replace it.
 */
function lockout(c: Obj): Diagnostic[] {
  const barrier = (r?: DefinitionRef) => (r ? c.barriers?.[refString(r)] : undefined);
  const items = Object.entries((c.items ?? {}) as Obj);
  const rooms = new Set([refString(c.entry)]);
  const keys = new Set<string>();
  const passable = (e: Obj) => {
    const b = barrier(e.barrier);
    return b?.initial !== 'locked' || (b.key_item && keys.has(refString(b.key_item)));
  };
  for (let grew = true; grew;) {
    grew = false;
    const reach = (set: Set<string>, ref: string) => !set.has(ref) && (set.add(ref), (grew = true));
    for (const [ref, i] of items) {
      const at = refString(i.location[i.location.in]);
      if ((i.location.in === 'room' && rooms.has(at)) || (i.location.in === 'item' && keys.has(at)))
        reach(keys, ref);
    }
    for (const r of rooms)
      for (const e of Object.values((c.rooms[r]?.exits ?? {}) as Obj))
        if (passable(e) && c.rooms[refString(e.to)]) reach(rooms, refString(e.to));
  }
  const stuck = new Set<string>();
  for (const r of rooms)
    for (const e of Object.values((c.rooms[r]?.exits ?? {}) as Obj)) {
      const b = barrier(e.barrier);
      const known = !b?.key_item || c.items?.[refString(b.key_item)];
      if (b && known && !passable(e)) stuck.add(refString(e.barrier));
    }
  return [...stuck].map((ref) =>
    diag('BARRIER_UNREACHABLE_KEY', `.cartridge.barriers${step(ref)}`),
  );
}
