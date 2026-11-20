// Build mode's state and auto-hold (docs/system/book-ui.md#author-mode; ruling 7 of
// docs/design/prose-in-the-book-rulings.md). Pure: the storage and the hold requests are passed in.

import { color } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import { named, type Step } from '../place.ts';

/** The Book's current palette, night included: inbook.ts sets `--loka-<role>` from
 * `paletteNear(paper(...))` after every Book render; light until it first has. */
export const ink = (role: keyof typeof color.light) => `var(--loka-${role}, ${color.light[role]})`;
/** Where the builder state is kept, beside the place (`loka-place`), so a reload restores it. */
export const BUILD = 'loka-build';
/** Build on or off, and the open sheet with its scroll offset; a sheet is open only in Build.
 * `room`: the room of the last write, which Start in this room goes back to. */
export type Builder = { on: boolean; sheet?: string; scroll?: number; room?: string };
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function restored(store: Store): Builder {
  try {
    const b = JSON.parse(store.getItem(BUILD) ?? 'null') as Partial<Builder> | null;
    const room = typeof b?.room === 'string' ? { room: b.room } : {};
    if (b?.on !== true) return { on: false, ...room };
    if (typeof b.sheet !== 'string') return { on: true, ...room };
    return {
      on: true,
      sheet: b.sheet,
      scroll: typeof b.scroll === 'number' ? b.scroll : 0,
      ...room,
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
  const take = () => ((mine = true), post(true));
  return {
    heard(now?: boolean) {
      if (held && !now) mine = false; // released, by anyone; a message before ours lands keeps `mine`
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
        if (focused || !mine) return;
        mine = false;
        post(false);
      });
    },
    /** pagehide: a request in flight would be cut off, so the release goes as a beacon */
    leave() {
      if (mine) beacon();
    },
  };
}
