// Where an op leaves focus (docs/design/scene-structure-rulings.md §5): the row the Scene card jumps
// to once the reload lands, or nothing for a refused op. Split from scene_structure.ts to stay under
// the file size limit.
import { type Op, scene } from './scene_structure.ts';

/** Where an op left the line to focus (rulings §5): the row the card jumps to once the reload lands.
 * A refused op focuses nothing, so a refusal never moves the caret. A move names the moved line by
 * its text, taking the occurrence nearest the destination so duplicate lines focus the right one.
 * It names the row only: a `~` has no field until the compile gives it words, so the row takes
 * focus and Tab reaches whatever field exists there. */
export function landed(bytes: string[], op: Op): { n: number } | undefined {
  const after = scene(bytes.join('\n'), op);
  if ('refused' in after) return undefined;
  const now = after.after.split('\n');
  if ('remove' in op) {
    // the line that took the removed one's place, skipping the blank run a removal leaves behind:
    // a blank row is nothing to put focus on
    let n = Math.max(1, op.remove);
    while (n < now.length && now[n - 1].trim() === '') n++;
    return { n: Math.min(n, Math.max(1, now.length)) };
  }
  if ('add' in op) {
    const at = now.findIndex((t, i) => t !== bytes[i]);
    return at < 0 ? undefined : { n: at + 1 };
  }
  if (!('move' in op)) return undefined;
  const moved = bytes[op.move - 1];
  const want = op.move + op.by;
  let best: number | undefined;
  now.forEach((t, i) => {
    if (t !== moved) return;
    if (best === undefined || Math.abs(i + 1 - want) < Math.abs(best! - want)) best = i + 1;
  });
  return best === undefined ? undefined : { n: best };
}
