// Toolbox row FD7 at the cartridge trust boundary (twin of lib/loka/content/asks.ex): an NPC's ask
// names topics of this cartridge and texts of its catalog, needs speech@1 and topics@1 and
// kernel_api 1.96. Its answers' conditions are walked with every other policy (cartridge_refs.ts nodes).
import type { Diagnostic } from '../contracts.gen.ts';
import { apiCmp } from './cartridge_installed.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

/** Each NPC answer's condition root, with its path. */
export const answerRoots = (c: Obj): [Obj, string][] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    (n.ask?.answers ?? []).flatMap((a: Obj, i: number): [Obj, string][] =>
      a.when ? [[a.when.root, `.cartridge.npcs${step(ref)}.ask.answers[${i}].when.root`]] : [],
    ),
  );

export function asks(c: Obj, { named, text }: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const npcs = Object.entries((c.npcs ?? {}) as Obj).filter(([, n]) => n.ask);
  for (const [ref, n] of npcs) {
    const at = `.cartridge.npcs${step(ref)}.ask`;
    for (const capability of ['speech', 'topics'])
      if (c.lock.capabilities[capability] !== 1)
        out.push(diag('UNDECLARED_CAPABILITY', at, { capability }, [`${capability}@1`]));
    text(n.ask, ['unknown'], at);
    n.ask.answers.forEach((a: Obj, i: number) => {
      named(a.topic, 'topic', `${at}.answers[${i}].topic`);
      if (a.grants) named(a.grants, 'topic', `${at}.answers[${i}].grants`);
      text(a, ['text'], `${at}.answers[${i}]`);
    });
  }
  if (npcs.length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.96') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
