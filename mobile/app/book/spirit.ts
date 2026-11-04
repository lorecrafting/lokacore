// The death and its return (book-ui.md, Falling; Spirit state): after a death with `revival`, Let go
// lands on the World page in the spirit state, its lines held to the rise. Wall-clock time; nothing is stored.
import { logMark, type DetailLine, type Logs } from './logs.ts';

export type Spirit = {
  lines: string[]; // the revival lines' text, in order
  seconds: number;
  at: number; // when Let go was pressed, ms
  shown: number; // revival lines logged so far
  held: DetailLine[]; // the return receipt's lines and any arriving meanwhile, logged at the rise
};

/** How many of n revival lines are due `ms` after landing: line k at k × seconds / (n − 1). */
export const due = (n: number, seconds: number, ms: number) =>
  n < 2 || ms >= seconds * 1000 ? n : Math.floor((ms * (n - 1)) / (seconds * 1000)) + 1;

/** The whole seconds left before the rise card is available. */
export const left = (seconds: number, ms: number) => Math.max(0, Math.ceil(seconds - ms / 1000));

/** Ms until the next line dries, the next whole second passes or zero; undefined once nothing is left. */
export function next(sp: Spirit, ms: number) {
  const n = sp.lines.length;
  if (left(sp.seconds, ms) === 0) return undefined;
  const line = sp.shown < n && n > 1 ? (sp.shown * sp.seconds * 1000) / (n - 1) - ms : Infinity;
  return Math.max(0, Math.min(line, 1000 - (ms % 1000), sp.seconds * 1000 - ms));
}

// A log position that survives a trim or a room change's reset: lines ever pushed, not an index.
export const end = (lines: DetailLine[]) => logMark(lines).gone + lines.length;
const since = (lines: DetailLine[], at: number) =>
  lines.splice(Math.max(0, at - logMark(lines).gone));

// The player's death, from its receipt: a fight it closed is the one they fell in.
export function fall(s: Logs, command_id: string) {
  s.died = command_id;
  s.woke = end(s.log); // before the receipt's own lines
  if (s.closing) s.fell = s.ended;
}

const dead = (s: Logs) => (s.ended && s.fell === s.ended ? s.projection.view.revival : undefined);

/** Dead with `revival`, where the log's held lines start: unread until the rise, so read once. */
export const unheard = (s: Logs) =>
  dead(s) && s.woke !== undefined ? Math.max(0, s.woke - logMark(s.log).gone) : undefined;

/** Let go or Back to World closes the ended page; Let go with `revival` begins the spirit state. */
export function letGo(s: Logs, text: (key: string) => string) {
  const revival = dead(s);
  s.ended = undefined;
  if (!revival) return false;
  const held = since(s.log, s.woke ?? end(s.log));
  s.spirit = {
    lines: revival.lines.map(text),
    seconds: revival.seconds,
    at: Date.now(),
    shown: 0,
    held,
  };
  return true;
}

/** An update in the spirit state: its new lines held; a fault, or an encounter, chapter or scene arriving, ends it. */
export function haunt(s: Logs, from: number, chapter: number | undefined) {
  s.spirit!.held.push(...since(s.log, from));
  const { combat, scene, chapter: now } = s.projection.view;
  if (s.fault || combat || scene || now?.index !== chapter) wake(s);
}

/** The rise: the held lines logged, the rest of the revival dropped. */
export function wake(s: Logs) {
  s.log.push(...(s.spirit?.held ?? []));
  s.spirit = undefined;
}

/** The spirit state's due lines logged; what its card and clock show. */
export function haunting(s: Logs, now: number) {
  const sp = s.spirit;
  if (!sp) return undefined;
  const ms = now - sp.at,
    n = due(sp.lines.length, sp.seconds, ms);
  s.log.push(...sp.lines.slice(sp.shown, n));
  sp.shown = n;
  const spent = Math.min(1, ms / (sp.seconds * 1000)); // the ring drains by elapsed over total
  return {
    seconds: sp.seconds,
    left: left(sp.seconds, ms),
    fraction: 1 - spent,
    next: next(sp, ms),
  };
}
