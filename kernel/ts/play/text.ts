// The terminal's words (00 §4.10 text drawer; 06 §20 "the same action supports touch and
// terminal adapters"): a table from words to Commands, and the room as text. Action
// definitions carry no aliases yet (action.schema.json), so the aliases live here.
import type { Cartridge, World } from '../src/index.ts';
import { COMPASS } from '../src/decision.ts';
import { gameView } from '../src/index.ts';

/** A Command's payload without its actor, 'quit', a message for the player, or null. */
export type Parsed =
  { type: 'look' } | { type: 'move'; direction: string } | 'quit' | string | null;

const NOT_A_DIRECTION = "That isn't a direction.";
const WORDS: Record<string, Parsed> = {
  look: { type: 'look' },
  l: { type: 'look' },
  quit: 'quit',
  q: 'quit',
};
for (const d of COMPASS) WORDS[d] = WORDS[d[0]] = { type: 'move', direction: d };

/**
 * `look`/`l`, a direction or its initial, `go <direction>`, `quit`/`q`. Only the six compass
 * words become a move: any other word after `go` is a message, never a Command, so free text
 * never reaches a record (ADR-075 §6 amendment). Anything else is "I don't understand that."
 */
export function parse(text: string): Parsed {
  const words = text.trim().toLowerCase().split(/\s+/);
  const word = (w: string) => (Object.hasOwn(WORDS, w) ? WORDS[w] : null);
  if (words[0] === '') return null;
  if (words.length === 2 && words[0] === 'go') {
    const known = word(words[1]);
    return known && typeof known === 'object' && known.type === 'move' ? known : NOT_A_DIRECTION;
  }
  return (words.length === 1 && word(words[0])) || "I don't understand that.";
}

/** The current room's title, description and exits, in the cartridge's text. */
export function room(cartridge: Cartridge, world: World): string {
  const view = gameView(world);
  const text = (key: string) => cartridge.text[key] ?? key;
  const exits = view.exits.map((e) => e.direction).join(', ') || 'none';
  return `${text(view.place.title.key)}\n${text(view.place.description.key)}\nExits: ${exits}\n`;
}
