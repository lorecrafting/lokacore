// NPC ask answer conditions (toolbox row FD7), walked by cartridge_refs.ts nodes.
import { step, type Obj } from './cartridge_refs.ts';

/** Each NPC answer's condition root, with its path. */
export const answerRoots = (c: Obj): [Obj, string][] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    (n.ask?.answers ?? []).flatMap((a: Obj, i: number): [Obj, string][] =>
      a.when ? [[a.when.root, `.cartridge.npcs${step(ref)}.ask.answers[${i}].when.root`]] : [],
    ),
  );
