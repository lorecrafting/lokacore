// Optimistic words (docs/design/prose-in-the-book-rulings.md): an /edit's words travel by their
// text key before the compile and over every overlay until a good one; a refused compile lists
// them as unconfirmed, with the file:line each came from.
import type { Message } from './live.ts';

/** Wraps the stream's `push`. */
export function told(push: (message: Partial<Message>) => void) {
  // ponytail: an /undo leaves its words up until the next good compile; drop them by file if it shows
  const words = new Map<string, { words: string; at: string }>(); // a Map: the page names the key
  let text: Record<string, string> = {}; // the overlay as pushed, before these words
  const over = (message: Partial<Message>) => {
    if (message.compiled && !message.pending) words.clear(); // a held compile is not written
    if (message.text) text = message.text;
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
  return { push: over, tell };
}
