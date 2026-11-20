// Build mode's state and auto-hold (docs/system/book-ui.md#author-mode; ruling 7 of
// docs/design/prose-in-the-book-rulings.md). Pure: the storage and the hold requests are passed in.

/** Where the builder state is kept, beside the place (`loka-place`), so a reload restores it. */
export const BUILD = 'loka-build';
/** Build on or off, and the open sheet with its scroll offset; a sheet is open only in Build. */
export type Builder = { on: boolean; sheet?: string; scroll?: number };
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function restored(store: Store): Builder {
  try {
    const b = JSON.parse(store.getItem(BUILD) ?? 'null') as Partial<Builder> | null;
    if (b?.on !== true) return { on: false };
    if (typeof b.sheet !== 'string') return { on: true };
    return { on: true, sheet: b.sheet, scroll: typeof b.scroll === 'number' ? b.scroll : 0 };
  } catch {
    return { on: false }; // a stale or hand-edited value is forgotten, not fatal to the Book
  }
}
/** Saved on every change: the reload a compile brings is abrupt, with no unload to save on. */
export const keep = (store: Store, builder: Builder) =>
  store.setItem(BUILD, JSON.stringify(builder));
/** Leaving Build closes every sheet. */
export const toggled = (builder: Builder): Builder => ({ on: !builder.on });

/** Ruling 7: a builder field holds compiles from focus to commit, through the server's Hold
 * (POST /__author/hold). It releases only a Hold it took: the panel's own stays the panel's. */
export function autoHold(post: (on: boolean) => void, beacon: () => void) {
  let held = false; // as the stream last said
  let mine = false;
  return {
    heard(now?: boolean) {
      if (held && !now) mine = false; // released, by anyone; a message before ours lands keeps `mine`
      held = !!now;
    },
    focus() {
      if (held || mine) return;
      mine = true;
      post(true);
    },
    commit() {
      if (!mine) return;
      mine = false;
      post(false);
    },
    /** pagehide: a request in flight would be cut off, so the release goes as a beacon */
    leave() {
      if (mine) beacon();
    },
  };
}
