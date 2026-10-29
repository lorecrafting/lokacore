// Toolbox row G11 (twin of lib/loka/content/standing.ex): each NPC's disposition condition roots,
// walked with every other policy (cartridge_refs.ts nodes).
import { step, type Obj } from './cartridge_refs.ts';

/** Each NPC's disposition condition root, with its path. */
export const dispositions = (c: Obj): [Obj, string][] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    ['hostile', 'friendly']
      .filter((f) => n.disposition?.[f])
      .map((f): [Obj, string] => [
        n.disposition[f].root,
        `.cartridge.npcs${step(ref)}.disposition.${f}.root`,
      ]),
  );
