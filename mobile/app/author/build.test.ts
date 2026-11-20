// Build mode (docs/system/book-ui.md#author-mode; slice 1.2): the toggle leaves the game alone,
// auto-hold (ruling 7) and the builder state a compile's reload restores. The server parks a
// compile while held: kernel/ts/test/author.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins Build.tsx draws with
import { autoHold, badge, BUILD, checks, keep, refusal, restored, toggled } from './build/build.ts';
import type { Step } from './place.ts';

const store = (entries: Record<string, string> = {}) => {
  const m = new Map(Object.entries(entries));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    others: () => [...m].filter(([k]) => k !== BUILD),
  };
};

// Breaks: the Build switch reaching the game or its neighbours' keys (the place a reload replays),
// keeping a sheet open after Build is left, the strip not saying how many compiles wait, or a saved
// sheet with no body drawn as an empty cover over the Book.
test('the Build switch changes no game state; the strip says what the Hold parks', async () => {
  const { Strip, hear, install, sheets } = await import('./build/Build.tsx');
  const host = elapsedHost();
  const s = store({ 'loka-place': '{"hash":"h","steps":[]}' });
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true });
  try {
    host.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} });
    const tables = () =>
      (
        host.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
          name: string;
        }[]
      ).map(({ name }) => host.sql.prepare(`SELECT * FROM "${name}"`).all());
    const before = [host.game.view(), tables(), s.others()];
    const drawn = () => nodes(Strip({ children: 'book' }));
    const toggle = () =>
      drawn()
        .find((n) => n.type === 'Pressable')
        .props.onPress();
    const label = () => drawn().find((n) => n.type === 'Pressable').props.children.props.children;
    assert.equal(label(), 'Build');
    toggle();
    assert.deepEqual(restored(s), { on: true });
    assert.equal(label(), '✎ Build', 'Build on shown by colour alone (WCAG 1.4.1)');
    keep(s, { on: true, sheet: 'stand-in', scroll: 40 });
    toggle();
    assert.deepEqual([host.game.view(), tables(), s.others()], before);
    assert.deepEqual(restored(s), { on: false }, 'leaving Build closes every sheet');
    const status = () => drawn().find((n) => n.props?.['aria-live']).props.children;
    hear({ held: true } as never);
    assert.equal(status(), 'Held · 0 waiting');
    hear({ held: true, pending: 3 } as never);
    assert.equal(status(), 'Held · 3 waiting');

    keep(s, { on: true, sheet: 'gone' }); // saved on a branch that had a sheet this one lacks
    Object.assign(globalThis, { addEventListener: () => {} });
    install({ seen: new Map(), said: new Map(), redraw() {}, api: async () => [200, null] }); // the reload
    const sheet = () => drawn().some((n) => n.type === 'ScrollView');
    assert.equal(sheet(), false, 'an unknown sheet covers the Book');
    sheets.gone = () => 'gone';
    assert.equal(sheet(), true);
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
    (f) => f(),
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

// Breaks: tabbing to the next field dropping the Hold for a moment (its blur releases, the server
// writes the parked compile, the Book reloads under the new field), or a field left unheld when the
// panel lets go of its own Hold.
test('the next field keeps the Hold; a field re-takes it when the panel lets go', () => {
  const queued: (() => void)[] = [];
  const posts: boolean[] = [];
  const hold = autoHold(
    (on) => posts.push(on),
    () => {},
    (f) => queued.push(f),
  );
  hold.focus();
  hold.heard(true);
  hold.commit(); // blur of the first field
  hold.focus(); // focus of the next, in the same task
  queued.splice(0).forEach((f) => f());
  assert.deepEqual(posts, [true], 'tabbing between fields');
  hold.commit();
  queued.splice(0).forEach((f) => f());
  hold.heard(false);
  assert.deepEqual(posts, [true, false]);

  hold.heard(true); // the panel's Hold
  hold.focus();
  hold.heard(false); // the panel lets go
  assert.deepEqual(posts, [true, false, true], 'the field takes the Hold over');
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

// Breaks: a page closed mid-edit leaving the server held, or a beacon after the field let go.
test('leaving the page releases a Hold the field took, by beacon', () => {
  const { hold, posts, beacons } = recorded();
  hold.focus();
  hold.heard(true);
  hold.leave();
  assert.equal(beacons(), 1);
  hold.commit();
  hold.heard(false);
  hold.leave();
  assert.deepEqual([posts, beacons()], [[true, false], 1]);
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
  to = undefined;
  drawn.props.onContentSizeChange(); // the sheet grows after the author scrolled
  assert.equal(to, undefined, 'a later size change scrolls back to the saved place');
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
  // Breaks: a reload or leaving Build forgetting the room Start in this room goes back to.
  assert.deepEqual(restored(store({ [BUILD]: '{"on":false,"room":"loft"}' })), {
    on: false,
    room: 'loft',
  });
  assert.deepEqual(toggled({ on: true, sheet: 'checks', room: 'loft' }), {
    on: false,
    room: 'loft',
  });
});

// Breaks: a Checks row dropped or sent to the wrong line (a refusal with no file, a key's row not
// naming its key), the badge counting one kind as another or showing a kind it has none of, or an
// unwritten line counted as `~` (ruling 9).
test('Checks lists refusals, unconfirmed and unwritten lines; the badge counts each', () => {
  const m = {
    diagnostics: [
      { rel: 'world/loft.md', path: 'exits.north', words: 'no such room' },
      { words: 'no start room' },
    ],
    unconfirmed: [{ key: 'room.loft.title', at: 'world/loft.md:2' }],
    placeholders: { 'room.cellar.description': 'world/cellar.md:4' },
  };
  assert.deepEqual(checks(m), [
    { label: 'world/loft.md: exits.north: no such room', file: 'world/loft.md' },
    { label: 'cartridge: no start room' },
    { label: 'room.loft.title: not confirmed', key: 'room.loft.title' },
    { label: 'room.cellar.description: unwritten', key: 'room.cellar.description' },
  ]);
  assert.equal(badge(m), 'Checks · 2 refused · 1 not confirmed · 1 unwritten');
  assert.equal(badge({ placeholders: m.placeholders }), 'Checks · 1 unwritten');
  assert.equal(badge({}), 'Checks');
});

// Breaks: the notice naming the step before or after the refused one (an off-by-one between the
// replay's index and the count the author reads).
test('the keep-my-place notice names the refused step', () => {
  const go = {
    intent: { action_key: 'go', target_ids: [], input: { direction: 'north' } },
  } as unknown as Step;
  const steps: Step[] = [{ advance: 60000 }, go, { advance: 1 }];
  assert.equal(refusal(steps, 1), "Couldn't keep your place: step 2, go north, was refused.");
  assert.equal(refusal([{} as Step], 0), "Couldn't keep your place: step 1 was refused.");
});
