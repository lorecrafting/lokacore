// NPC schedule cases (toolbox row W10), walked by cartridge_refs.ts nodes.
import { step, type Obj } from './cartridge_refs.ts';

/** Each schedule case of every NPC, with its path. */
export const cases = (c: Obj): [Obj, string][] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    Object.entries((n.schedule_cases ?? {}) as Obj).flatMap(([h, list]) =>
      (list as Obj[]).map((k, i): [Obj, string] => [
        k,
        `.cartridge.npcs${step(ref)}.schedule_cases${step(h)}[${i}]`,
      ]),
    ),
  );
