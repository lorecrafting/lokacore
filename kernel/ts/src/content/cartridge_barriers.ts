// Exit directions and barrier reach (barrier@1; 05 §17), kept for runtime/created.ts,
// mechanics/movement/sequence.ts and play/reach.ts; the compiler checks barriers (barriers.ex).
import type { DefinitionRef } from '../contracts.gen.ts';
import type { Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';

export const OPPOSITE: Readonly<Record<string, string>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
};

const barrierOf = (c: Obj, r?: DefinitionRef) => (r ? c.barriers?.[refString(r)] : undefined);

// A barrier passes when it does not start locked, or its key is among `keys`.
const opens = (c: Obj, r: DefinitionRef | undefined, keys: Set<string>) => {
  const b = barrierOf(c, r);
  return b?.initial !== 'locked' || (b.key_item && keys.has(refString(b.key_item)));
};

/**
 * The rooms and placed items in reach: rooms are reached from the entry through exits without a
 * barrier or whose barrier starts open, closed, or (with `keys`) locked with a key already in
 * reach; an item is in reach when it starts in a reached room, inside an item in reach that
 * passes so, or is receivable from a co-located NPC. Without `keys` every locked barrier stays
 * shut (the content reports, cartridge.md). ponytail: initial states and item locations only, no
 * scripted actions, facts or NPC movement; 05 §17 reachability and the Lab's state-space search replace it.
 */
export function reach(c: Obj, keys = true): { rooms: Set<string>; items: Set<string> } {
  const items = Object.entries((c.items ?? {}) as Obj);
  const rooms = new Set<string>(c.entry ? [refString(c.entry)] : []);
  const held = new Set<string>();
  const usable = keys ? held : new Set<string>();
  const open = (r?: DefinitionRef) => opens(c, r, usable);
  for (let grew = true; grew;) {
    grew = false;
    const add = (set: Set<string>, ref: string) => !set.has(ref) && (set.add(ref), (grew = true));
    for (const [ref, i] of items) {
      if (i.location.in === 'template') continue;
      const at = refString(i.location[i.location.in]);
      const inside = i.location.in === 'item' && held.has(at) && open(c.items[at].barrier);
      if ((i.location.in === 'room' && rooms.has(at)) || inside || receivable(c, ref, i, rooms))
        add(held, ref);
    }
    for (const r of rooms)
      for (const e of Object.values((c.rooms[r]?.exits ?? {}) as Obj))
        if (open(e.barrier) && c.rooms[refString(e.to)]) add(rooms, refString(e.to));
  }
  return { rooms, items: held };
}

// Static potential only: runtime still requires live/present bound roles and quest/carry admission.
function receivable(c: Obj, item: string, i: Obj, rooms: Set<string>): boolean {
  if (i.location.in !== 'npc') return false;
  const npc = refString(i.location.npc);
  const holder = c.npcs?.[npc];
  if (!holder || !rooms.has(refString(holder.room))) return false;
  return Object.values((c.dialogues ?? {}) as Obj).some((d) => {
    const speaker = c.npcs?.[refString(d.npc)];
    if (!speaker || refString(speaker.room) !== refString(holder.room)) return false;
    return Object.values(d.choices as Obj).some((o) => {
      const h = o.receive;
      const from = h && d.roles[h.from];
      const reward = h && d.roles[h.item];
      return (
        from?.role === 'npc' &&
        refString(from.npc) === npc &&
        reward?.role === 'item' &&
        refString(reward.item) === item
      );
    });
  });
}
