// The terminal's words (00 §4.10 text drawer; 06 §20 "the same action supports touch and
// terminal adapters"): a table from words to Commands, and the room as text. Action
// definitions carry no aliases yet (action.schema.json), so the aliases live here.
import type { Cartridge, World } from '../src/index.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { COMPASS } from '../src/decision.ts';
import { gameView } from '../src/index.ts';
import { normalize } from '../src/target.ts';

/**
 * A Command's payload without its actor, a lookup (the player's words after the verb, which
 * the authority resolves before any Command: they never enter one), 'quit', a message for the
 * player, or null.
 */
export type Parsed =
  | { type: 'look' }
  | { type: 'move'; direction: string }
  | { lookup: string }
  | 'quit'
  | string
  | null;

const NOT_A_DIRECTION = "That isn't a direction.";
const WORDS: Record<string, Parsed> = {
  look: { type: 'look' },
  l: { type: 'look' },
  quit: 'quit',
  q: 'quit',
};
for (const d of COMPASS) WORDS[d] = WORDS[d[0]] = { type: 'move', direction: d };

const LOOK = ['look', 'l', 'examine', 'x'];

/**
 * `look`/`l`, `look`/`l`/`examine`/`x` <words> (a lookup; `look at the post` and `look post`
 * alike, target.ts normalize), a direction or its initial, `go <direction>`, `quit`/`q`. Only the six compass
 * words become a move: any other word after `go` is a message, never a Command, so free text
 * never reaches a record (ADR-075 §6 amendment). Anything else is "I don't understand that."
 */
export function parse(text: string): Parsed {
  const words = text.trim().toLowerCase().split(/\s+/);
  const word = (w: string) => (Object.hasOwn(WORDS, w) ? WORDS[w] : null);
  if (words[0] === '') return null;
  if (LOOK.includes(words[0])) {
    const rest = text.trim().replace(/^\S+\s*/, '');
    if (normalize(rest).length) return { lookup: rest };
    return words[0] === 'examine' || words[0] === 'x' ? 'Examine what?' : WORDS.look;
  }
  if (words.length === 2 && words[0] === 'go') {
    const known = word(words[1]);
    return known && typeof known === 'object' && 'direction' in known ? known : NOT_A_DIRECTION;
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

/** A detail's description, in the cartridge's text. */
export const detail = (cartridge: Cartridge, world: World, id: EntityId): string =>
  `${cartridge.text[world.details[id].description] ?? world.details[id].description}\n`;

/** "Which do you mean: the notice or the mooring post?": each candidate by its first alias. */
export const which = (world: World, ids: readonly EntityId[]): string => {
  const names = ids.map((id) => `the ${world.details[id].aliases[0].replaceAll('_', ' ')}`);
  return `Which do you mean: ${names.slice(0, -1).join(', ')} or ${names.at(-1)}?\n`;
};
