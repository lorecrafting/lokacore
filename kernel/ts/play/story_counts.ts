// The story model's counts (kernel/ts/play/story.ts): Pacing's words by node and Knowledge's
// choices by dialogue (docs/design/editor-map-and-story-rulings.md S2); the story cards' gates' facts;
// the short refs outline.json's beats may name.
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

// ponytail: by key, as a source names them; two areas' same-key skills or dialogues merge (upgrade: refs)
const short = (r: string) => r.slice(r.lastIndexOf('/') + 1);
/** The hidden skills' keys (skills.ex hidden/2), as a choice's `skill.acquire` step names them. */
export const hiddenSkills = (c: Obj) =>
  Object.entries((c.skills ?? {}) as Record<string, Obj>)
    .filter(([, s]) => s.hidden === true)
    .map(([r]) => short(r));
/** Each dialogue a then cannot enter, by key, with the part that refuses it (dialogue_links.ex:388). */
export const unlinkable = (c: Obj) =>
  Object.fromEntries(
    Object.entries((c.dialogues ?? {}) as Record<string, Obj>).flatMap(([r, d]) => {
      const part = ['keyword', 'quest', 'riddle'].find((f) => d[f] !== undefined);
      return part ? [[short(r), part]] : [];
    }),
  );

const choicesOf = (d: unknown) => (isObj(d) && isObj(d.choices) ? Object.keys(d.choices) : []);

// A short ref's node: a dialogue choice `dialogues/<d>/<c>` is its dialogue's, when it has that choice.
export function resolve(short: string, refs: Map<string, string>, defs: Map<string, unknown>) {
  const [dir, key, choice] = short.split('/');
  const ref = refs.get(`${dir}/${key}`);
  if (choice === undefined || !ref) return ref;
  return dir === 'dialogues' && choicesOf(defs.get(ref)).includes(choice) ? ref : undefined;
}

// Every short ref resolve() takes: what Bind may write.
export const shorts = (refs: Map<string, string>, defs: Map<string, unknown>) =>
  [...refs].flatMap(([s, ref]) => [
    s,
    ...(s.startsWith('dialogues/') ? choicesOf(defs.get(ref)).map((c) => `${s}/${c}`) : []),
  ]);
