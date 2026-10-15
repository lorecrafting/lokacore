// Toolbox row W10 at the cartridge trust boundary: an NPC's schedule_cases name hours its
// daily_schedule lists, rooms and goal texts of this cartridge, and need kernel_api 1.47; any
// `walks` on a case or a population plan (toolbox row W26) needs 1.81. Twin of
// lib/loka/content/schedules.ex.
import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
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

// Realm seam 5: a job has no player, so a case `when` names no fact with player scope.
function playerFacts(c: Obj, v: unknown, at: string, out: Diagnostic[]): void {
  if (!v || typeof v !== 'object') return;
  const o = v as Obj;
  if (o.op === 'fact_compare' && c.facts?.[refString(o.fact)]?.scopes?.includes('player'))
    out.push(diag('FACT_SCOPE_UNSUPPORTED', `${at}.fact`));
  for (const [k, x] of Object.entries(o))
    playerFacts(c, x, Array.isArray(o) ? `${at}[${k}]` : `${at}${step(k)}`, out);
}

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
  const all = cases(c);
  for (const [k, at] of all) {
    named(k.room, 'room', `${at}.room`);
    text(k, ['goal'], at);
    playerFacts(c, k.when, `${at}.when`, out);
  }
  const api = c.manifest.requires.kernel_api.at_least;
  const walks =
    all.some(([k]) => k.walks) || Object.values((c.populations ?? {}) as Obj).some((p) => p.walks);
  if ((all.length && apiCmp(api, '1.47') < 0) || (walks && apiCmp(api, '1.81') < 0))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  return out;
}
