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
 * and only its words change; a `~` keeps `todo__<n>` — a placeholder with referrers must not move.
 * `key` is the key to pin when the caller has already chosen one (rulings §2, "Hand-written `- ~`
 * choices": a `~` with no referrer is pinned as `choice_<n>` instead). */
export const rewordedChoice = (line: string, words: string, n: number, key?: string) => {
  const indent = line.slice(0, line.length - line.trimStart().length);
  // the key comes from the label as written (its suffix, if any, already names it)
  const label = line.trim().slice(2);
  const said = words.trim() === '' ? '~' : words.trim();
  return `${indent}- ${said} #${key ?? choiceKey(label, n)}`;
};

/** One line of a `.scene`, as `rows` reads it: indent, text, and a `- ` choice line's key. */
export type Row = { indent: number; text: string; key?: string };

/** A `.scene` line as the card sees it: its indent, and on a `- ` line its key (S3's ` #<key>`). */
export const rows = (lines: string[]): Row[] =>
  lines.map((text, i) => {
    const indent = text.length - text.trimStart().length;
    const body = text.trim();
    if (!body.startsWith('- ')) return { indent, text };
    const label = body.slice(2);
    return { indent, text, key: choiceKey(label, i + 1) };
  });

/** A choice's words change and its key does not (rulings §2): the one line, at its own indent, with
 * the key it already had pinned as a ` #<key>` suffix. Only a `- ` line has words; a `* ` narration
 * line is edited by text key (/edit) and a value line by its picker (/set), so neither is a reword.
 *
 * A `~` placeholder is the exception: its `todo__<n>` key moves with its line, so a `~` with no
 * referrer is given a free `choice_<n>` instead, and one with a referrer keeps `todo__<n>`. */
export function reword(
  o: Record<string, any>,
  rs: Row[],
  out: string[],
  at: number,
  refers: (key: string) => boolean = () => false,
) {
  const words = typeof o.reword === 'object' ? o.reword?.words : undefined;
  if (typeof words !== 'string') return { refused: 'reword: {words}' };
  if (!/^\s*- /.test(rs[at].text)) return { refused: 'only a choice line has words to reword' };
  if (words.trim() === '') return { refused: 'a choice with no words is a `~` placeholder' };
  if (/[\r\n]/.test(words)) return { refused: 'a choice is one line' };
  const n = at + 1;
  const label = rs[at].text.trim().slice(2);
  // an unspecified key is the one the line already had; a `~` gets a free one, else its own
  const held = choiceKey(label, n);
  const key = held.startsWith(TODO) && !refers(held) ? freeKey(rs.map((r) => r.key)) : held;
  out[at] = rewordedChoice(rs[at].text, words, n, key);
}
