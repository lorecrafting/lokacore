// Optimistic words (docs/design/prose-in-the-book-rulings.md): an /edit's words travel by their
// text key before the compile and over every overlay until a good one; a refused compile lists
// them as unconfirmed, with the file:line each came from.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Message } from './live.ts';

const fileOf = (at: string) => at.slice(0, at.lastIndexOf(':'));
const length = (root: string, file: string) => {
  try {
    return readFileSync(join(root, file), 'utf8').split('\n').length;
  } catch {
    return NaN; // unreadable: equal to no count, so never trusted
  }
};

/** Wraps the stream's `push`; `root` is the source tree `places` names. */
export function told(push: (message: Partial<Message>) => void, root: string) {
  const words = new Map<string, { words: string; at: string }>(); // a Map: the page names the key
  let text: Record<string, string> = {}; // the overlay as pushed, before these words
  let places: Record<string, string> = {}; // the last compile's `~` key => file:line (/line)
  const counted = () =>
    new Map([...new Set(Object.values(places).map(fileOf))].map((f) => [f, length(root, f)]));
  let lengths = counted(); // each placed file's line count when the map came
  const over = (message: Partial<Message>) => {
    if (message.compiled && !message.pending) words.clear(); // a held compile is not written
    if (message.text) text = message.text;
    if (message.placeholders) {
      places = message.placeholders;
      lengths = counted();
    }
    const shown = Object.fromEntries([...words].map(([key, t]) => [key, t.words]));
    if (message.text) message = { ...message, text: { ...message.text, ...shown } };
    if (message.compiled === false)
      message = { ...message, unconfirmed: [...words].map(([key, { at }]) => ({ key, at })) };
    else if (message.compiled) message = { ...message, unconfirmed: [] };
    push(message);
  };
  const tell = (key: string, said: string, at: string) => {
    words.set(key, { words: said, at });
    over({ text });
  };
  // An outside save that adds or drops lines moves them before the compile: that file's places are
  // stale (/line falls back to the words). The Book's own /edit and /undo write one line for one.
  // ponytail: counted when the map arrives, not when the compile read (a save between starts another
  // compile); a save that moves lines but keeps the count passes: a per-file hash if that bites.
  const fresh = () => {
    const now = counted();
    return Object.fromEntries(
      Object.entries(places).filter(([, at]) => now.get(fileOf(at)) === lengths.get(fileOf(at))),
    );
  };
  return { push: over, tell, places: fresh };
}
