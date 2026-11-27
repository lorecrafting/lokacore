// Build mode's state and auto-hold (docs/system/book-ui.md#author-mode; ruling 7 of
// docs/design/prose-in-the-book-rulings.md). Pure: the storage and the hold requests are passed in.

import { color } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import { named, type Step } from '../place.ts';

/** The Book's current palette, night included: page.ts sets `--loka-<role>` from
 * `paletteNear(pagePaper(...))` after every Book render; light until it first has. */
export const ink = (role: keyof typeof color.light) => `var(--loka-${role}, ${color.light[role]})`;
/** Where the builder state is kept, beside the place (`loka-place`), so a reload restores it. */
export const BUILD = 'loka-build';
/** Build on or off, and the open sheets (bottom first, ids like `checks` or `room:<key>`) with the
 * top one's scroll offset; sheets are open only in Build.
 * `room`: the room of the last write, which Start in this room goes back to.
 * `notebook`: the notebook column's scroll, there while it is open (Wide layout). */
export type Builder = {
  on: boolean;
  sheets?: string[];
  scroll?: number;
  room?: string;
  notebook?: number;
};
/** At most four sheets stack; a fifth replaces the top (design §5). */
const STACK = 4;
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function restored(store: Store): Builder {
  try {
    const b = JSON.parse(store.getItem(BUILD) ?? 'null') as Partial<Builder> | null;
    const room = typeof b?.room === 'string' ? { room: b.room } : {};
    if (b?.on !== true) return { on: false, ...room };
    const notebook = typeof b.notebook === 'number' ? { notebook: b.notebook } : {};
    const sheets = Array.isArray(b.sheets) ? b.sheets.filter((id) => typeof id === 'string') : [];
    if (!sheets.length) return { on: true, ...room, ...notebook };
    return {
      on: true,
      sheets: sheets.slice(-STACK),
      scroll: typeof b.scroll === 'number' ? b.scroll : 0,
      ...room,
      ...notebook,
    };
  } catch {
    return { on: false }; // a stale or hand-edited value is forgotten, not fatal to the Book
  }
}
/** Saved on every change: the reload a compile brings is abrupt, with no unload to save on. */
export const keep = (store: Store, builder: Builder) =>
  store.setItem(BUILD, JSON.stringify(builder));
/** Leaving Build closes every sheet. */
export const toggled = ({ on, room }: Builder): Builder => ({ on: !on, ...(room && { room }) });
/** `id` on top of the stack (moved there if it is lower), scrolled to its start; already on top,
 * nothing changes. */
export function opened(b: Builder, id: string): Builder {
  if (b.sheets?.at(-1) === id) return b;
  const s = (b.sheets ?? []).filter((x) => x !== id);
  return { ...b, sheets: [...(s.length < STACK ? s : s.slice(0, -1)), id], scroll: 0 };
}
/** The top sheet becomes `id` (the Flow walk re-centres or steps back): the stack keeps its order. */
export const swapped = (b: Builder, id: string): Builder => ({
  ...b,
  sheets: [...(b.sheets ?? []).slice(0, -1), id],
  scroll: 0,
});
/** Back: the top sheet (or sheet `id`) closes, the one under it shows again. */
export function closed({ sheets, scroll: _, ...b }: Builder, id?: string): Builder {
  const rest = (id ? sheets?.filter((x) => x !== id) : sheets?.slice(0, -1)) ?? [];
  return rest.length ? { ...b, sheets: rest, scroll: 0 } : b;
}

/** The strip's notice for a replay refused at step index `at`. */
export const refusal = (steps: Step[], at: number) =>
  `Couldn't keep your place: step ${at + 1}${named(steps[at]) ? `, ${named(steps[at])},` : ''} was refused.`;

type Diagnostic = { rel?: string | null; path?: string; words?: string }; // kernel/ts/play/card.ts
/** A Checks row: what it says, and the line it goes to (a text key, else a source file). */
export type Check = { label: string; key?: string; file?: string };
/** The Checks tab's rows from the pushed message: the compile's refusals, then the lines it did not
 * take (unconfirmed), then the unwritten ones. Ruling 9: an unwritten line is never shown as `~`. */
export function checks(m: Pick<Message, 'diagnostics' | 'unconfirmed' | 'placeholders'>): Check[] {
  return [
    ...((m.diagnostics ?? []) as Diagnostic[]).map((d) => ({
      label: [d.rel ?? 'cartridge', d.path, d.words].filter(Boolean).join(': '),
      ...(d.rel && { file: d.rel }),
    })),
    ...(m.unconfirmed ?? []).map(({ key }) => ({ label: `${key}: not confirmed`, key })),
    ...Object.keys(m.placeholders ?? {}).map((key) => ({ label: `${key}: unwritten`, key })),
  ];
}
/** The strip's badge: each kind's count, as ruling 9 counts (`12 unwritten`, never `~ 12`). */
export function badge(m: Pick<Message, 'diagnostics' | 'unconfirmed' | 'placeholders'>) {
  const counts: [number, string][] = [
    [m.diagnostics?.length ?? 0, 'refused'],
    [m.unconfirmed?.length ?? 0, 'not confirmed'],
    [Object.keys(m.placeholders ?? {}).length, 'unwritten'],
  ];
  return ['Checks', ...counts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`)].join(' · ');
}

/** Ruling 7: a builder field holds compiles from focus to commit, through the server's Hold
 * (POST /__author/hold). It releases only a Hold it took: the panel's own stays the panel's. A
 * commit releases on `later`, so tabbing to the next field (blur, then focus) keeps the Hold. */
export function autoHold(
  post: (on: boolean) => void,
  beacon: () => void,
  later: (f: () => void) => void,
) {
  let held = false; // as the stream last said
  let mine = false;
  let focused = false;
  let pinned = false; // the Tools tab's Hold
  const take = () => ((mine = true), post(true));
  return {
    heard(now?: boolean) {
      if (held && !now) mine = pinned = false; // released, by anyone; a message before ours lands keeps `mine`
      held = !!now;
      if (!held && focused && !mine) take(); // the panel let go while a field is still open
    },
    focus() {
      focused = true;
      if (!held && !mine) take();
    },
    commit() {
      focused = false;
      later(() => {
        if (!focused && mine && !pinned) void ((mine = false), post(false)); // a pinned Hold outlives the field
      });
    },
    /** The Tools tab's Hold: takes a free Hold, keeps a field's past its commit, never drops the panel's. */
    toggle() {
      pinned = !pinned;
      if (pinned && !held && !mine) take();
      else if (!pinned && mine && !focused) void ((mine = false), post(false));
    },
    pinned: () => pinned,
    /** pagehide: a request in flight would be cut off, so the release goes as a beacon */
    leave() {
      if (mine) beacon();
    },
  };
}
