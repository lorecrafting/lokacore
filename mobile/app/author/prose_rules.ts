// The rules of E5's in-Book editing (docs/design/prose-in-the-book-rulings.md), apart from the
// DOM so node tests reach them; inbook.ts draws them.
import { LINE_WORDS } from '../../packages/game-view/line_words.ts';
import { color } from '../book/tokens.ts';

/** A pasted newline or tab is one space: /edit takes one line. */
export const oneLine = (typed: string) => typed.replace(/\r\n|[\r\n\t]/g, ' ');

/** What leaving the field does with the draft. */
export const saving = (draft: string, words: string) =>
  !draft.trim() ? 'empty' : draft === words ? 'unchanged' : 'save';

// A `~` line's words are tagged with its key's number in zero-width marks, so two `~` lines on one
// page name two keys (the Book shows `~` alike; `seen` would resolve both to one).
const MARK = /[\u200b\u200c]+$/;
const ids = new Map<string, number>();
export function tagged(key: string, words: string) {
  if (words.trim() !== '~') return words;
  if (!ids.has(key)) ids.set(key, ids.size);
  return words + '\u200b'.repeat(ids.get(key)!) + '\u200c'; // the key's number, in unary
}
/** True for a line still to write: its words, marks aside, trim to `~`. */
export const unwritten = (shown: string) => shown.replace(MARK, '').trim() === '~';

/** Where a walk key lands among `count` lines from `at` (-1: none yet), wrapping; -1 with none. */
export function step(count: number, at: number, by: number) {
  if (!count) return -1;
  if (at < 0) return by === 1 ? 0 : count - 1;
  return (at + by + count) % count;
}

type Key = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean };
type Target = { tagName: string; isContentEditable: boolean };
/** A text field keeps its own keys. */
export const textField = (t: Target) =>
  t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

/** The walk a key asks for, or undefined: never in a text field, never with Cmd, Ctrl or Alt. */
export function walk(e: Key, typing: boolean) {
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return undefined;
  const asked = { ']': [true, 1], '[': [true, -1], '}': [false, 1], '{': [false, -1] } as const;
  return Object.hasOwn(asked, e.key) ? asked[e.key as keyof typeof asked] : undefined;
}

/** Whether the panel hands a key to the Book: a walk key, or Enter anywhere but a text field or a
 * control (whose Enter is its own). */
export function relays(e: Key, target: Target) {
  if (e.key !== 'Enter') return walk(e, textField(target)) !== undefined;
  return (
    !textField(target) &&
    !/^(BUTTON|A|SUMMARY)$/.test(target.tagName) &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  );
}

/** The note under a line that opens no field: the route's refusal (or none: the engine's line). */
export function noFieldNote(key: string | undefined, refusal?: string) {
  if (key && LINE_WORDS.has(key)) return 'The engine writes this line.';
  if (refusal?.startsWith('a choice label'))
    return 'A choice label is its key. Alt-click opens the scene.';
  return 'Not a line of words. Alt-click opens its source.';
}

/** The palette whose paper is nearest `rgb` (the page's computed background), for the marks. */
export function paletteNear(rgb: string) {
  const page = (rgb.match(/\d+/g) ?? []).map(Number);
  const far = (hex: string) =>
    Math.hypot(
      ...hex
        .slice(1)
        .match(/../g)!
        .map((h, n) => parseInt(h, 16) - page[n]),
    );
  return Object.values(color).sort((a, b) => far(a.bg) - far(b.bg))[0];
}
