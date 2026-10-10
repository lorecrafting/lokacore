// The loader's reaction checks (reaction@1; reaction.schema.json ReactionRule; 06 §14: referenced
// facts and targets are compile-validated), twin of lib/loka/content/reactions.ex: what each
// reaction uses, for the lock stage (content/cartridge.ts): its own kind, its trigger's event and each
// consequence's event; its trigger and consequences name local fact, room or quest definitions,
// with typed fact values and restricted quest activation. Its `when` is walked
// with every other policy (content/cartridge_refs.ts nodes).
import { refString } from '../runtime/decision.ts';
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.reactions ?? {}) as Obj).map(([ref, r]) => [
    r,
    `.cartridge.reactions${step(ref)}`,
  ]);

/** Each owner reference of each reaction: [registry field, name, path]. */
export const uses = (c: Obj) =>
  each(c).flatMap(([r, at]) => [
    ['definition', 'reaction', at],
    ['event', r.on.event, `${at}.on.event`],
    ...r.apply.flatMap((s: Obj, i: number) =>
      s.op === 'population.suppress'
        ? []
        : [
            [
              'event',
              s.op === 'quest.activate'
                ? 'quest_activated'
                : s.op === 'quest.resolve'
                  ? 'quest_resolved'
                  : 'fact_changed',
              `${at}.apply[${i}].op`,
            ],
          ],
    ),
  ]) as ['definition' | 'event', string, string][];

// size: allow 53, finite reaction API, typed suppression and status references stay in one ordered check
export function reactions(c: Obj, { named, typedValue }: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  for (const [r, at] of each(c)) {
    if (
      (r.on.quest || r.apply.some((s: Obj) => s.op === 'quest.activate')) &&
      (major < 1 || (major === 1 && minor < 8))
    )
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    if (
      r.apply.some((s: Obj) => s.op === 'quest.resolve' || s.op === 'quest.fail') &&
      (major < 1 || (major === 1 && minor < 12))
    )
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    if (
      r.apply.some((s: Obj) => s.op === 'population.suppress') &&
      (major < 1 || (major === 1 && minor < 35))
    )
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    if (r.on.fact) named(r.on.fact, 'fact', `${at}.on.fact`);
    if (r.on.room) named(r.on.room, 'room', `${at}.on.room`);
    if (r.on.quest) named(r.on.quest, 'quest', `${at}.on.quest`);
    r.apply.forEach((s: Obj, i: number) => {
      if (s.op === 'quest.activate') {
        named(s.quest, 'quest', `${at}.apply[${i}].quest`);
        if (r.on.event !== 'quest_resolved')
          out.push(diag('OUTCOME_MISMATCH', `${at}.apply[${i}].op`));
      } else if (s.op === 'quest.resolve' || s.op === 'quest.fail') {
        named(s.quest, 'quest', `${at}.apply[${i}].quest`);
        if (r.on.event !== 'fact_changed')
          out.push(diag('OUTCOME_MISMATCH', `${at}.apply[${i}].op`));
      } else if (s.op === 'population.suppress') {
        named(s.plan, 'population', `${at}.apply[${i}].plan`);
        if (r.on.fact) typedValue(r.on.fact, true, `${at}.on.fact`);
        if (!c.populations?.[refString(s.plan)]?.pack)
          out.push(diag('SCHEMA_VIOLATION', `${at}.apply[${i}].plan`));
        if (r.on.event !== 'fact_changed')
          out.push(diag('OUTCOME_MISMATCH', `${at}.apply[${i}].op`));
      } else if (s.op !== 'status.apply') {
        // status.apply references are checked with the status declarations (cartridge_status.ts).
        named(s.fact, 'fact', `${at}.apply[${i}].fact`);
        typedValue(s.fact, s.value, `${at}.apply[${i}].value`);
      }
    });
  }
  return out;
}
