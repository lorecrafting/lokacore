// The terminal's words (00 §4.10 text drawer; 06 §20 "the same action supports touch and
// terminal adapters"): a table from words to Commands, and the room as text. Action
// definitions carry no aliases yet (action.schema.json), so the aliases live here.
import type { Cartridge, World } from '../src/index.ts';
import { COMPASS } from '../src/decision.ts';
import { gameView } from '../src/index.ts';

export type Parsed = { type: 'look' } | { type: 'move'; direction: string } | 'quit' | null;

const WORDS: Record<string, Parsed> = {
  look: { type: 'look' },
  l: { type: 'look' },
  quit: 'quit',
  q: 'quit',
};
for (const d of COMPASS) WORDS[d] = WORDS[d[0]] = { type: 'move', direction: d };

/**
 * `look`/`l`, a direction or its initial, `go <direction>`, `quit`/`q`; null for anything
 * else. `go <word>` with an unknown word is still a move, which the rule rejects.
 */
export function parse(text: string): Parsed {
  const words = text.trim().toLowerCase().split(/\s+/);
  const word = (w: string) => (Object.hasOwn(WORDS, w) ? WORDS[w] : null);
  if (words.length === 1) return word(words[0]);
  if (words.length !== 2 || words[0] !== 'go') return null;
  const known = word(words[1]);
  if (known && typeof known === 'object' && known.type === 'move') return known;
  return /^[a-z][a-z0-9_]{0,63}$/.test(words[1]) ? { type: 'move', direction: words[1] } : null;
}

/** The current room's title, description and exits, in the cartridge's text. */
export function room(cartridge: Cartridge, world: World): string {
  const view = gameView(world);
  const text = (key: string) => cartridge.text[key] ?? key;
  const exits = view.exits.map((e) => e.direction).join(', ') || 'none';
  return `${text(view.place.title.key)}\n${text(view.place.description.key)}\nExits: ${exits}\n`;
}
