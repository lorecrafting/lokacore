// The rules of E5's in-Book editing (docs/design/prose-in-the-book-rulings.md), apart from the
// DOM so node tests reach them; inbook.ts draws them.
import { LINE_WORDS } from '../../packages/game-view/line_words.ts';
import { color, size, space, type } from '../book/tokens.ts';

/** A pasted newline or tab is one space: /edit takes one line. */
export const oneLine = (typed: string) => typed.replace(/\r\n|[\r\n\t]/g, ' ');

/** What leaving the field does with the draft. */
export const saving = (draft: string, words: string) =>
  !draft.trim() ? 'empty' : draft === words ? 'unchanged' : 'save';

/** Bind drawn words to a key; words two keys draw bind to none ('') so neither opens. */
export const bind = (seen: Map<string, string>, words: string, key: string) => {
  const was = seen.get(words);
  seen.set(words, was === undefined || was === key ? key : '');
};
/** The seen words naming a drawn line: exact, or with the letter cap() raised lowered. None when
 *  both forms, or two keys, claim it: a wrong write is worse than no field (journal_sampler's oar). */
export function drawnWords(seen: Map<string, string>, t: string) {
  const found = [...new Set([t, t.charAt(0).toLowerCase() + t.slice(1)])].filter((w) =>
    seen.has(w),
  );
  return found.length === 1 && seen.get(found[0]) ? found[0] : undefined;
}

/** A clicked line's key, and the words Alt-click opens: the file's, else the drawn text. */
export function clicked(seen: Map<string, string>, said: Map<string, string>, text: string) {
  const w = drawnWords(seen, text);
  const key = w && seen.get(w);
  return { key, words: (key && said.get(key)) || text };
}

// A `~` line's words are tagged with its key's number in zero-width marks, so two `~` lines on one
// page name two keys (the Book shows `~` alike; `seen` would resolve both to one).
const MARK = /[\u200b\u200c]+$/;
const ids = new Map<string, number>();
export function tagged(key: string, words: string) {
  if (words?.trim() !== '~') return words; // a key with no words reaches here undefined
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

/** The editor shortcut a Book key asks the panel for (palette, Hold, open source, collapse a
 * column), or undefined: Cmd-Z and the walk keys stay the Book's. */
export const shortcut = (e: Key) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && ['k', '.', 'e', '\\', '/'].includes(e.key)
    ? e.key
    : undefined;
/** Whether a Book line (its text key `kind.key.field`) belongs to the selected definition. */
export const selects = (textKey: string | undefined, kind: string, key: string) =>
  !!textKey?.startsWith(`${kind}.${key}.`);

/** Whether the panel hands a key to the Book: a walk key or Cmd-Z, or Enter anywhere but a text
 * field or a control (whose Enter is its own). */
export function relays(e: Key, target: Target) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') return !textField(target); // put back
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
    return "A choice's words are edited in the scene card. Alt-click opens the scene.";
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

const label = `${type.label.fontSize}px/${type.label.lineHeight}px ${type.label.fontFamily}`;

/** The Book's author marks (inbook.ts). */
export const CSS = `
[data-loka-todo]{position:relative}
[data-loka-todo]::before{content:"";position:absolute;left:-${space.lg}px;top:0;bottom:0;width:${size.speechBar}px;background:var(--loka-warning)}
[data-loka-landed]::before{background:var(--loka-action)}
[data-loka-selected]{background:color-mix(in srgb,var(--loka-action) 14%,transparent)}
[data-loka-landed],[data-loka-field]{outline:${size.focus}px solid var(--loka-action);outline-offset:${size.focus}px}
[data-loka-field]{background:var(--loka-card);color:var(--loka-fg);caret-color:var(--loka-action)}
[data-loka-unconfirmed]{text-decoration:underline wavy var(--loka-warning)}
[data-loka-a11y]::after{content:", " attr(data-loka-a11y);position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.loka-note{position:absolute;font:${label};letter-spacing:${type.label.letterSpacing}px;color:var(--loka-dim);background:var(--loka-card);z-index:10} /* mutate-skip: paint, not logic */
.loka-note[data-warn]{color:var(--loka-warning)}
.loka-note button{font:inherit;color:var(--loka-action);background:none;border:0;padding:0 0 0 ${space.md}px;cursor:pointer}`;

/** The computed paper under `el`: its first ancestor with a background. */
export function paper(el: Element | null): string {
  for (; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) return bg;
  }
  return 'rgb(235, 230, 215)';
}
