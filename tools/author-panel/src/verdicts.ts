// R1's status words for the checkpoint list (docs/design/story-tooling.md §2). Kept out of
// author.ts so it stays a pure function: author.ts imports React, and a test of this must not need a
// browser.
import type { Checked } from './author.ts';

/** Each checkpoint name with its verdict: the watcher's push keyed by name. A name the watcher has
 * not pushed yet is `not replayed yet`, not a failure (a checkpoint saved moments ago). */
export function verdicts(
  names: string[],
  checked: Checked[] | undefined,
): { name: string; said: string; ok: boolean }[] {
  return names.map((name) => {
    const v = checked?.find((c) => c.name === name);
    if (!v) return { name, ok: true, said: 'not replayed yet' };
    if (v.ok) return { name, ok: true, said: 'ok' };
    const at = v.step ? `step ${v.step}, ` : '';
    return { name, ok: false, said: `${at}refused: ${v.why}` };
  });
}
