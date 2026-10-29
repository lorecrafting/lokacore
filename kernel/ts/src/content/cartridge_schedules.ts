// NPC schedule cases (toolbox row W10), walked by cartridge_refs.ts nodes.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

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

/** A case hour the daily_schedule does not list never runs (its job is that hour's). */
export const schedules = (c: Obj): Diagnostic[] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) =>
    Object.keys((n.schedule_cases ?? {}) as Obj)
      .filter((h) => !Object.hasOwn(n.daily_schedule ?? {}, h))
      .map((h) =>
        diag('SCHEMA_VIOLATION', `.cartridge.npcs${step(ref)}.schedule_cases${step(h)}`, {
          error: 'invalid_value',
        }),
      ),
  );
