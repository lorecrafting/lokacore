// Declared cues as definition parts (toolbox row G6), read by cartridge_refs.ts parts.
import { step, type Obj } from './cartridge_refs.ts';

/** Each cue of a room, detail, item (and its source fuel), NPC, status or recipe outcome. */
export function cueParts(c: Obj): [string, Obj, string][] {
  const out: [string, Obj, string][] = [];
  const add = (d: Obj | undefined, at: string) =>
    (d?.cues ?? []).forEach((q: Obj, i: number) => out.push(['cue', q, `${at}.cues[${i}]`]));
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    add(r, `.cartridge.rooms${step(ref)}`);
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj))
      add(d, `.cartridge.rooms${step(ref)}.details${step(key)}`);
  }
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj))
    add(n, `.cartridge.npcs${step(ref)}`);
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    add(i, `.cartridge.items${step(ref)}`);
    add(i.fuel, `.cartridge.items${step(ref)}.fuel`);
  }
  for (const [ref, s] of Object.entries((c.statuses ?? {}) as Obj))
    add(s, `.cartridge.statuses${step(ref)}`);
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj))
    for (const [name, o] of Object.entries(r.outcomes as Obj))
      add(o, `.cartridge.recipes${step(ref)}.outcomes.${name}`);
  return out;
}
