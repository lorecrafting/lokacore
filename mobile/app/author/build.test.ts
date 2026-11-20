// Build mode (docs/system/book-ui.md#author-mode; slice 1.2): the toggle leaves the game alone,
// auto-hold (ruling 7) and the builder state a compile's reload restores. The server parks a
// compile while held: kernel/ts/test/author.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins Build.tsx draws with
import { autoHold, BUILD, keep, restored, toggled } from './build/build.ts';

const store = (entries: Record<string, string> = {}) => {
  const m = new Map(Object.entries(entries));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    others: () => [...m].filter(([k]) => k !== BUILD),
  };
};

// Breaks: Build reaching the game or its neighbours' keys (the place a reload replays, the save).
test('toggling Build on, opening a sheet and toggling off changes no game state', () => {
  const host = elapsedHost();
  try {
    host.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} });
    const s = store({ 'loka-place': '{"hash":"h","steps":[]}' });
    const tables = () =>
      (
        host.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
          name: string;
        }[]
      ).map(({ name }) => host.sql.prepare(`SELECT * FROM "${name}"`).all());
    const before = [host.game.view(), tables(), s.others()];
    let b = restored(s);
    keep(s, (b = toggled(b)));
    keep(s, (b = { ...b, sheet: 'stand-in', scroll: 40 }));
    keep(s, (b = toggled(b)));
    assert.deepEqual([host.game.view(), tables(), s.others()], before);
    assert.deepEqual(restored(s), { on: false }, 'leaving Build closes every sheet');
  } finally {
    host.sql.close();
  }
});

const recorded = () => {
  const posts: boolean[] = [];
  let beacons = 0;
  const hold = autoHold(
    (on) => posts.push(on),
    () => beacons++,
  );
  return { hold, posts, beacons: () => beacons };
};

// Breaks: a structural compile reloading the Book under a field being typed in (no Hold taken),
// or a Hold left on after the field commits, so every later compile waits.
test('a focused builder field holds compiles until it commits', () => {
  const { hold, posts } = recorded();
  hold.focus();
  hold.heard(undefined); // a compile's message before the Hold's own lands
  hold.heard(true);
  hold.focus(); // a second field while held asks nothing
  hold.commit();
  assert.deepEqual(posts, [true, false]);
});

// Breaks: holding with no field focused, so a compile no longer reloads as today.
test('with no focused field nothing is held', () => {
  const { hold, posts } = recorded();
  hold.heard(false);
  hold.commit();
  hold.leave();
  assert.deepEqual(posts, []);
});

// Breaks: a builder field releasing the Hold the panel took (POST /hold is one flag on the server).
test('a field never releases a Hold it did not take', () => {
  const { hold, posts, beacons } = recorded();
  hold.heard(true);
  hold.focus();
  hold.commit();
  hold.leave();
  assert.deepEqual([posts, beacons()], [[], 0]);
});

// Breaks: a page closed mid-edit leaving the server held, or a release the panel already made
// leaving the field thinking the Hold is still its own.
test('leaving the page releases a Hold the field took, by beacon', () => {
  const { hold, posts, beacons } = recorded();
  hold.focus();
  hold.heard(true);
  hold.leave();
  assert.equal(beacons(), 1);
  hold.heard(false); // released elsewhere
  hold.commit();
  hold.leave();
  assert.deepEqual([posts, beacons()], [[true], 1]);
});

// Breaks: a reload losing the open sheet or its scroll, or reopening a sheet outside Build.
test('a reload brings back the open sheet, scrolled where it was', async () => {
  const { Sheet, sheets } = await import('./build/Build.tsx');
  sheets['stand-in'] = () => 'stand-in sheet';
  const s = store();
  keep(s, { on: true, sheet: 'stand-in', scroll: 120 });
  const open = restored(store({ [BUILD]: s.getItem(BUILD)! })); // a fresh page over the same storage
  assert.deepEqual(open, { on: true, sheet: 'stand-in', scroll: 120 });
  const drawn = Sheet({ open, saved: () => {} }) as any;
  assert.equal(drawn.props.children, 'stand-in sheet');
  let to: unknown;
  drawn.props.ref.current = { scrollTo: (at: unknown) => (to = at) };
  drawn.props.onContentSizeChange();
  assert.deepEqual(to, { y: 120, animated: false });
  let saved: unknown;
  Sheet({ open, saved: (b) => (saved = b) }).props.onScroll({
    nativeEvent: { contentOffset: { y: 300 } },
  });
  assert.deepEqual(saved, { on: true, sheet: 'stand-in', scroll: 300 });

  assert.deepEqual(restored(store({ [BUILD]: '{"on":false,"sheet":"stand-in"}' })), { on: false });
  assert.deepEqual(restored(store({ [BUILD]: '{"on":true}' })), { on: true });
  assert.deepEqual(restored(store({ [BUILD]: '{"on":true,"sheet":"x"}' })), {
    on: true,
    sheet: 'x',
    scroll: 0,
  });
  assert.deepEqual(restored(store({ [BUILD]: '{garbled' })), { on: false });
});
