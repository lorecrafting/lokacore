// scene@1's ordered subset, trigger/text references and engine FactSpec (mechanics.md).
import type { Diagnostic } from '../contracts.gen.ts';
import { checkers, diag, step, type Obj } from './cartridge_refs.ts';
import { refString } from '../runtime/decision.ts';

/** Byte-exact FactSpec; only key and narrate count substitute. Twin of content/scenes.ex. */
export const spec = (key: string, n: number) => ({
  key: `scene_${key}`,
  version: 1,
  value_type: { type: 'int', minimum: -1, maximum: n, default: 0 },
  scopes: ['player'],
  meaning: `Scene ${key}'s line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.`,
});

// size: allow 41, one scene pass validates trigger and ordered lines together
export function scenes(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { named, text } = checkers(c, out);
  const triggers: Record<string, string[]> = {};
  for (const [k, s] of Object.entries((c.scenes ?? {}) as Obj)) {
    const at = `.cartridge.scenes${step(k)}`;
    const quest = !!s.on.quest;
    if (quest === !!s.on.story_point) out.push(diag('SCHEMA_VIOLATION', `${at}.on`));
    if (quest || s.on.story_point)
      named(
        s.on[quest ? 'quest' : 'story_point'],
        quest ? 'quest' : 'story_point',
        `${at}.on.${quest ? 'quest' : 'story_point'}`,
      );
    const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (quest && (major < 1 || (major === 1 && minor < 12)))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    const point =
      quest || !s.on.story_point ? undefined : c.story_points?.[refString(s.on.story_point)];
    if (point && !Object.hasOwn(point.outcomes, s.on.outcome))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.on.outcome`, { target: s.on.outcome }));
    s.steps.forEach((s: Obj, i: number) => text(s, ['text'], `${at}.steps[${i}]`));
    const n = s.steps.findIndex((s: Obj) => s.type !== 'narrate');
    const count = n === -1 ? s.steps.length : n;
    const want = [...Array(Math.max(1, count)).fill('narrate'), 'await_ack', 'end'];
    const i = want.findIndex((t, i) => s.steps[i]?.type !== t);
    if (i !== -1 || s.steps.length !== want.length)
      out.push(
        diag('SCHEMA_VIOLATION', `${at}.steps[${i === -1 ? want.length : i}].type`, {
          error: 'not_in_enum',
        }),
      );
    const trigger = `${quest ? 'quest' : 'story_point'}/${s.on[quest ? 'quest' : 'story_point'] ? refString(s.on[quest ? 'quest' : 'story_point']) : ''}/${s.on.outcome}`;
    (triggers[trigger] ??= []).push(`${at}.on`);
  }
  for (const paths of Object.values(triggers))
    if (paths.length > 1) out.push(...paths.map((p) => diag('DUPLICATE_DEFINITION', p)));
  return out;
}
