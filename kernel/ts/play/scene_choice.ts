// A choice's key (docs/design/scene-structure-rulings.md §2): the compiler's `choice_key`
// (lib/loka/content/scene_lines.ex) and the card's same answer, kept in one place so the two cannot
// disagree about which line a referrer names.
/** The prefix of a `~` choice's key: its line number follows (scene_lines.ex `choice_key`). */
export const TODO = 'todo__';

/** `choice_key`'s slug (scene_lines.ex:80-81). */
const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** A trailing ` #<key>` names the key and is not part of the words (scene_lines.ex `@explicit`). */
const EXPLICIT = / +\#([a-z][a-z0-9_.]*)$/;

/** `choice_key`'s key for a `- ` line's words: an explicit ` #<key>` suffix, else the slug (and
 * `todo__<n>` for a `~` placeholder: its line keys it, which is why an insert or a move above one
 * shifts its key). */
export const choiceKey = (label: string, n: number) =>
  EXPLICIT.exec(label)?.[1] ??
  (label.trim() === '~' ? `${TODO}${n}` : slug(label.replace(EXPLICIT, '')));

/** The words of a `- ` line, without its ` #<key>` suffix (scene_lines.ex `label/1`). */
export const choiceLabel = (label: string) => label.replace(EXPLICIT, '').trimEnd();

/** The next free `choice_<n>` in a file (rulings §2): 1 when no choice claims it, else one past the
 * highest. A `~` placeholder's `todo__<n>` is not a `choice_<n>`, so it never blocks one. */
export const freeKey = (keys: (string | undefined)[]) => {
  const taken = new Set(keys);
  let n = 1;
  while (taken.has(`choice_${n}`)) n++;
  return `choice_${n}`;
};

/** The line the card writes when a choice's words change (rulings §2, "The card pins the key before
 * the first word changes"): the new words plus the key that line already had, so no referrer moves.
 *
 * A choice keyed by its words gets them pinned as `#<old slug>`; an explicit one keeps its suffix
 * and only its words change; a `~` keeps `todo__<n>` — a placeholder with referrers must not move. */
export const rewordedChoice = (line: string, words: string, n: number) => {
  const indent = line.slice(0, line.length - line.trimStart().length);
  // the key comes from the label as written (its suffix, if any, already names it)
  const label = line.trim().slice(2);
  const said = words.trim() === '' ? '~' : words.trim();
  return `${indent}- ${said} #${choiceKey(label, n)}`;
};
