// The story model's counts (kernel/ts/play/story.ts): Pacing's words by node and Knowledge's
// choices by dialogue (docs/design/editor-map-and-story-rulings.md S2).
import { isObj, type Obj } from '../src/content/cartridge_refs.ts';

// Every string in a definition: among them, the text keys it names.
export const keysIn = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : isObj(v) || Array.isArray(v)
      ? Object.values(v).flatMap(keysIn)
      : [];

/** Pacing's mass: the words written (no `~`) in the text keys each definition names, inline and
 * scene prose included (both compile to text keys); a node with none is absent. */
export function wordsByNode(defs: Map<string, unknown>, text: Record<string, unknown>) {
  const out: Record<string, number> = {};
  for (const [ref, def] of defs) {
    // ponytail: a key two nodes name counts in each, and a scene's nested sets are their own nodes; dedupe by key if a part's sum misleads
    const n = [...new Set(keysIn(def))]
      .flatMap((k) => (typeof text[k] === 'string' ? text[k].split('\n') : []))
      .filter((l) => l.trim() !== '~')
      .reduce((a, l) => a + l.split(/\s+/).filter(Boolean).length, 0);
    if (n) out[ref] = n;
  }
  return out;
}

// each dialogue's choice count: Knowledge tells "every choice sets it" from "one of several"
export const choiceCounts = (c: Obj) =>
  Object.fromEntries(
    Object.entries((c.dialogues ?? {}) as Record<string, Obj>).map(([r, d]) => [
      r,
      Object.keys(d.choices ?? {}).length,
    ]),
  );
