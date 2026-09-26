// The terminal's words (00 §4.10 text drawer; 06 §20 "the same action supports touch and
// terminal adapters"): a table from words to Commands, and the room as text. Action
// definitions carry no aliases yet (action.schema.json), so the aliases live here.
import type { Cartridge, World } from '../src/index.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { key } from '../src/compose.ts';
import { COMPASS, exitOf, refString } from '../src/decision.ts';
import { gameView } from '../src/index.ts';
import { describe } from '../src/rules/description_variant.ts';
import { normalize } from '../src/target.ts';
import { level, resourceRef } from '../src/resource.ts';

/**
 * A Command's payload without its actor, a lookup (the player's words after the verb, which
 * the authority resolves before any Command: they never enter one) for look, take, drop or give
 * (`to` the recipient's words), a wait of whole hours (the caller adds them to the clock),
 * 'inventory', 'quit', a message for the player, or null.
 */
export type Parsed =
  | { type: 'look' }
  | { type: 'move'; direction: string }
  | { lookup: string; verb?: 'take' | 'drop' | 'give'; to?: string }
  | { door: (typeof DOORS)[number]; direction?: string; words?: string }
  | { wait: number }
  | 'inventory'
  | 'brief'
  | 'quit'
  | string
  | null;

const NOT_A_DIRECTION = "That isn't a direction.";
const WORDS: Record<string, Parsed> = {
  look: { type: 'look' },
  l: { type: 'look' },
  quit: 'quit',
  q: 'quit',
  inventory: 'inventory',
  i: 'inventory',
  brief: 'brief',
};
for (const d of COMPASS) WORDS[d] = WORDS[d[0]] = { type: 'move', direction: d };

const LOOK = ['look', 'l', 'examine', 'x'];
const DOORS = ['open', 'close', 'lock', 'unlock'] as const;
const VERBS: Record<string, 'take' | 'drop' | 'give'> = {
  get: 'take',
  take: 'take',
  drop: 'drop',
  give: 'give',
};

/**
 * `look`/`l`, `look`/`l`/`examine`/`x` <words> (a lookup; `look at the post` and `look post`
 * alike, target.ts normalize), `get`/`take` <words>, `drop` <words>, `give` <words> `to`
 * <words>, `open`/`close`/`lock`/`unlock` <a direction, its initial, or words naming a door>,
 * `inventory`/`i`, a direction or its initial, `go <direction>`, `wait` [hours, 1 to 24; one when
 * omitted], `brief` (brief mode on or off), `quit`/`q`. Only the
 * six compass words become a move: any other word after `go` is a message, never a Command, so
 * free text never reaches a record (ADR-075 §6 amendment). Anything else is "I don't understand
 * that."
 */
export function parse(text: string): Parsed {
  const words = text.trim().toLowerCase().split(/\s+/);
  const word = (w: string) => (Object.hasOwn(WORDS, w) ? WORDS[w] : null);
  if (words[0] === '') return null;
  const rest = text.trim().replace(/^\S+\s*/, '');
  if (Object.hasOwn(VERBS, words[0])) {
    const verb = VERBS[words[0]];
    const [what, to] = verb === 'give' ? rest.split(/\s+to\s+/i) : [rest];
    if (!normalize(what).length) return `${capital(words[0])} what?`;
    if (verb !== 'give') return { lookup: what, verb };
    return to && normalize(to).length ? { lookup: what, verb, to } : 'Give it to whom?';
  }
  if ((DOORS as readonly string[]).includes(words[0])) {
    const door = words[0] as (typeof DOORS)[number];
    const known = words.length === 2 && word(words[1]);
    if (known && typeof known === 'object' && 'direction' in known)
      return { door, direction: known.direction };
    return normalize(rest).length ? { door, words: rest } : `${capital(door)} what?`;
  }
  if (LOOK.includes(words[0])) {
    if (normalize(rest).length) return { lookup: rest };
    return words[0] === 'examine' || words[0] === 'x' ? 'Examine what?' : WORDS.look;
  }
  if (words[0] === 'wait' && words.length <= 2) {
    const hours = words.length === 1 ? 1 : Number(words[1]);
    return Number.isInteger(hours) && hours >= 1 && hours <= 24
      ? { wait: hours }
      : 'Wait how many hours?';
  }
  if (words.length === 2 && words[0] === 'go') {
    const known = word(words[1]);
    return known && typeof known === 'object' && 'direction' in known ? known : NOT_A_DIRECTION;
  }
  return (words.length === 1 && word(words[0])) || "I don't understand that.";
}

const capital = (w: string) => `${w[0].toUpperCase()}${w.slice(1)}`;

/** A catalog string as plain words: each touch link's words, without brackets or target. */
export const plain = (s: string): string => s.replace(/\[([^[\]]+)\](?:\([^()]*\))?/g, '$1');

/** The cartridge's text for a key, as plain words (the key itself if it has none). */
export const say = (cartridge: Cartridge, key: string): string => plain(cartridge.text[key] ?? key);

/**
 * The current room's title, description (none when `brief`), the room line of each NPC and item
 * in it (an item's room-line variants), and exits, each marked closed or locked while its barrier
 * bars the way, in the cartridge's text.
 */
export function room(cartridge: Cartridge, world: World, brief = false): string {
  const view = gameView(world);
  const text = (key: string) => say(cartridge, key);
  const lines = view.entities.map((e) => {
    const d = world.entities[e.id];
    const of = {
      description: d.room_line,
      variants: d.kind === 'item' ? d.room_line_variants : [],
    };
    return `${text(describe(world, world.character, of))}\n`;
  });
  const mark = (e: (typeof view.exits)[number]) => ('reason' in e && BARRED[e.reason.code]) || '';
  const exits = view.exits.map((e) => `${e.direction}${mark(e)}`).join(', ') || 'none';
  const long = brief ? '' : `${text(view.place.description.key)}\n`;
  const head = `${text(view.place.title.key)}\n${long}`;
  return `${head}${lines.join('')}Exits: ${exits}\n`;
}

const BARRED: Record<string, string> = { exit_closed: ' (closed)', exit_locked: ' (locked)' };

/** The short description of the barrier on the current room's exit in `direction`, if any. */
export function door(cartridge: Cartridge, world: World, direction: string): string {
  const b = barrierAt(cartridge, world, direction);
  return b ? say(cartridge, b.short) : 'it';
}

/** The barrier on the current room's exit in `direction`, if any. */
export function barrierAt(cartridge: Cartridge, world: World, direction: string) {
  const barrier = exitOf(world.rooms[world.state.containers[world.body]], direction)?.barrier;
  return barrier && cartridge.barriers![refString(barrier)];
}

/** What the player is carrying: each item's short description. */
export function inventory(cartridge: Cartridge, world: World): string {
  const items = gameView(world).inventory.map((e) => `  ${say(cartridge, e.name)}\n`);
  return items.length ? `You are carrying:\n${items.join('')}` : 'You are carrying nothing.\n';
}

/** A detail's (its variants) or an item's or NPC's description, in the cartridge's text. */
export function detail(cartridge: Cartridge, world: World, id: EntityId): string {
  const of = world.details[id] ?? world.entities[id];
  return `${say(cartridge, describe(world, world.character, of))}\n`;
}

/**
 * "Which do you mean: the notice or a brass lantern?": each candidate by a detail's first
 * alias or an item's or NPC's short description.
 */
export const which = (cartridge: Cartridge, world: World, ids: readonly EntityId[]): string => {
  const names = ids.map((id) =>
    Object.hasOwn(world.details, id)
      ? `the ${world.details[id].aliases[0].replaceAll('_', ' ')}`
      : say(cartridge, world.entities[id].short),
  );
  return `Which do you mean: ${names.slice(0, -1).join(', ')} or ${names.at(-1)}?\n`;
};

/** A LogicalTime as the player reads it: one unit a second, time 0 midnight of day 1. */
export const clock = (t: number): string => {
  const [day, hh, mm] = [
    Math.floor(t / 86400) + 1,
    Math.floor(t / 3600) % 24,
    Math.floor(t / 60) % 60,
  ];
  return `day ${day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/**
 * The DikuMUD-style status line, `hp 20/20  ma 100/100  mv 82/82  day 1, 00:00`: each default
 * pool the cartridge declares (current/maximum, resource.ts), then the time; empty for a
 * cartridge without the pools.
 */
export function status(world: World): string {
  const pools = ['hp', 'ma', 'mv'].flatMap((k) => {
    const r = resourceRef(world, k);
    const now = level(world, world.body, r);
    return now === undefined ? [] : [`${k} ${now}/${world.resourceSpecs[key(r)].maximum}`];
  });
  return pools.length ? `${[...pools, clock(world.state.clock)].join('  ')}\n` : '';
}

// The player's words for a rejection of a command of `type`, else the kind and code.
export function reason(
  d: { kind: string; error?: { code: string }; code?: string },
  type: string,
): string {
  const code = d.error?.code ?? d.code;
  const words: Record<string, string> = {
    'move not_found': "You can't go that way.",
    'move invalid_target': "That isn't a direction.",
    'take invalid_state': 'You already have that.',
    'take not_found': "You can't take that.",
    'take invalid_target': "You can't take that.",
    'drop not_found': "You aren't carrying that.",
    'drop invalid_target': "You aren't carrying that.",
    'give not_found': "You can't give things to that.",
    'give invalid_target': "You can't give things to that.",
    'give invalid_state': "They can't carry any more.",
    'move insufficient_resource': 'You are too exhausted.',
    insufficient_resource: "You don't have the strength for that.",
    cooldown: "You can't do that again yet.",
    'perform invalid_target': "You can't do that to that.",
    invalid_state: "You can't do that now.",
    not_present: "You don't see that here.",
    not_owned: "You aren't carrying that.",
    unsupported_capability: "You can't do that here.",
    exit_closed: 'The way is closed.',
    exit_locked: 'It is locked.',
    'open invalid_state': 'It is already open.',
    'close invalid_state': 'It is already closed.',
    'lock not_owned': "You don't have the key.",
    'unlock not_owned': "You don't have the key.",
    'lockless not_owned': 'It has no lock.',
    ...Object.fromEntries(
      ['open', 'close', 'lock', 'unlock'].flatMap((v) => [
        [`${v} invalid_target`, `There is nothing to ${v} there.`],
        [`${v} not_found`, 'There is no exit that way.'],
      ]),
    ),
  };
  return words[`${type} ${code}`] ?? words[code!] ?? `(${d.kind}: ${code})`;
}
