// The Dialogue card's choice tree (docs/rnd/gui-editor-design-2026-11-04.md §4.4): what a dialogue's
// choices hold together, as the compiler accepts them. The card draws; this decides.
import { teaches } from './allowed.ts';

type Obj = Record<string, unknown>;
const has = (o: Obj, f: string) => Object.hasOwn(o, f);
const choicesOf = (doc: Obj) => (doc.choices ?? {}) as Record<string, Obj>;

/** The badges a folded choice shows: what gates or charges taking it. */
export const BADGES = ['policy', 'once', 'accept', 'hand_over', 'payment'];

// a .scene choice's slug is its words (loka-vduxr.51); every reference names the key
export const RENAME =
  "a choice's key is its id: links, story points, reactions and saves name it, so it is not renamed (add a choice instead)";

/**
 * Why the dialogue `doc` would not compile for what its choices hold; undefined when it would.
 * `hidden` are the hidden skills' keys. Fields count by presence, as the compiler's is_map_key does.
 */
export function refuseChoices(doc: Obj, hidden: string[] = []): string | undefined {
  for (const [k, c] of Object.entries(choicesOf(doc))) {
    if (has(c, 'accept') && has(doc, 'quest'))
      return `${k}: accept would resolve this dialogue's own quest`; // dialogues.ex:367
    if (has(c, 'accept') && has(c, 'hand_over'))
      return `${k}: accept and hand_over do not go together`; // dialogues.ex:368
    if (has(c, 'receive') && has(c, 'hand_over'))
      return `${k}: receive and hand_over do not go together`; // dialogues.ex:386
    if (has(c, 'then_failed') && !has(c, 'check')) return `${k}: then_failed needs a check`; // dialogue_links.ex:45
    if (has(c, 'patrol') && [c.then, c.then_failed].some((t) => t !== undefined && t !== 'end'))
      return `${k}: a patrol ends the talk: no then`; // dialogue_links.ex:393
    if (has(c, 'asked') && (doc.riddle as Obj | undefined)?.choice_id === k)
      return `${k}: the riddle's answer is never asked`; // dialogue_asked.ex:32
  }
  const named = ['name', 'riddle'].find((f) => has(doc, f));
  return teaches(doc, hidden) && named
    ? `a dialogue with a ${named} teaches no hidden skill`
    : undefined; // skills.ex:157-158
}

/** Why choice `k` cannot be removed from `doc`; undefined when it can. */
export function refuseRemove(doc: Obj, k: string): string | undefined {
  if (Object.keys(choicesOf(doc)).length === 1) return 'a dialogue keeps one choice at least'; // dialogues.ex:315
  if ((doc.riddle as Obj | undefined)?.choice_id === k) return `the riddle's answer is ${k}`; // dialogues.ex:288
  return undefined;
}

/** `doc` with choice `k` set to `c` (undefined: removed). */
export function withChoice(doc: Obj, k: string, c?: Obj): Obj {
  const { [k]: _gone, ...rest } = choicesOf(doc);
  return { ...doc, choices: c ? { ...choicesOf(doc), [k]: c } : rest };
}

/** The fields of `menu` choice `k` can take without refusal, each tried present as `[]` (steps is
 * read as a list); never `order`, a scene's mark the compiler writes (scene_merge.ex:56-57). */
export const choiceMenu = (doc: Obj, k: string, menu: string[], hidden: string[] = []) =>
  menu.filter(
    (f) =>
      f !== 'order' &&
      !has(choicesOf(doc)[k], f) &&
      !refuseChoices(withChoice(doc, k, { ...choicesOf(doc)[k], [f]: [] }), hidden),
  );
