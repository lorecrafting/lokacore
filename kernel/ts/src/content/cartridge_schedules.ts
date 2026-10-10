// Toolbox row W10 at the cartridge trust boundary: an NPC's schedule_cases name hours its
// daily_schedule lists, rooms and goal texts of this cartridge, and need kernel_api 1.47. Twin of
// lib/loka/content/schedules.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { checkers, diag, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

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

export function schedules(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { named, text } = checkers(c, out);
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj))
    for (const h of Object.keys((n.schedule_cases ?? {}) as Obj))
      if (!Object.hasOwn(n.daily_schedule ?? {}, h))
        out.push(
          diag('SCHEMA_VIOLATION', `.cartridge.npcs${step(ref)}.schedule_cases${step(h)}`, {
            error: 'invalid_value',
          }),
        );
  for (const [k, at] of cases(c)) {
    named(k.room, 'room', `${at}.room`);
    text(k, ['goal'], at);
  }
  if (cases(c).length && apiCmp(c.manifest.requires.kernel_api.at_least, '1.47') < 0)
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
