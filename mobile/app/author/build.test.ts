// Build mode (docs/system/book-ui.md#author-mode; slice 1.2): the toggle leaves the game alone,
// auto-hold (ruling 7) and the builder state a compile's reload restores. The server parks a
// compile while held: kernel/ts/test/author.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins Build.tsx draws with
import {
  autoHold,
  badge,
  BUILD,
  checks,
  closed,
  keep,
  opened,
  refusal,
  restored,
  toggled,
} from './build/build.ts';
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
    keep(s, { on: true, sheets: ['stand-in'], scroll: 40 });
    toggle();
    assert.deepEqual([host.game.view(), tables(), s.others()], before);
    assert.deepEqual(restored(s), { on: false }, 'leaving Build closes every sheet');
    const status = () => drawn().find((n) => n.props?.['aria-live']).props.children;
    hear({ held: true } as never);
    assert.equal(status(), 'Held · 0 waiting');
    hear({ held: true, pending: 3 } as never);
    assert.equal(status(), 'Held · 3 waiting');

    keep(s, { on: true, sheets: ['gone'] }); // saved on a branch that had a sheet this one lacks
    Object.assign(globalThis, { addEventListener: () => {} });
    const T = Date.now();
    const now = Date.now;
    Date.now = () => T;
    s.setItem('loka-build-undo', JSON.stringify({ w: { ids: [1] }, end: T })); // a chip ending as the page loads
    install({ seen: new Map(), said: new Map(), redraw() {}, api: async () => [200, { map: [] }] }); // the reload
    Date.now = now;
    const undo = drawn().some(
      (n) => n.type === 'Pressable' && n.props.children?.props?.children === 'Undo',
    );
    assert.equal(undo, false, 'a chip whose time is up is not shown');
    const sheet = () => drawn().some((n) => n.type === 'ScrollView');
    assert.equal(sheet(), false, 'an unknown sheet covers the Book');
    sheets.gone = { title: () => 'Gone', body: () => 'gone' };
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

// Breaks: the Tools tab's Hold toggled off releasing the Hold a focused field took (one flag on the
// server: the Book would reload under the field), a pinned Hold dropped when the field commits, the
// panel's Hold released by the tab, or the tab reading pinned after the Hold was released elsewhere.
test("the Tools tab's Hold leaves a field's own Hold alone, and outlives its commit", () => {
  const { hold, posts } = recorded();
  hold.focus();
  hold.heard(true);
  hold.toggle(); // on, under the field's Hold
  hold.toggle(); // off: still the field's
  assert.deepEqual(posts, [true]);
  hold.toggle();
  hold.commit(); // the field lets go; the pinned Hold stays
  assert.deepEqual(posts, [true]);
  hold.toggle(); // off with no field: released
  assert.deepEqual(posts, [true, false]);
  hold.heard(false);
  hold.heard(true); // the panel's Hold
  hold.toggle();
  hold.toggle();
  assert.deepEqual(posts, [true, false]); // neither taken nor released
  hold.heard(false);
  hold.toggle(); // a free Hold: taken
  hold.heard(true);
  hold.heard(false); // released elsewhere: the tab's toggle reads off
  assert.equal(hold.pinned(), false);
  assert.deepEqual(posts, [true, false, true]);
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

// Breaks: a reload losing the open sheet or its scroll, or reopening a sheet outside Build; or the
// sheet's foot not naming the file its source is in.
test('a reload brings back the open sheet, scrolled where it was, its source file at its foot', async () => {
  const { Sheet, sheets } = await import('./build/Build.tsx');
  sheets['stand-in'] = {
    title: () => 'Stand-in',
    body: () => 'stand-in sheet',
    file: () => 'rooms/hall.yaml',
  };
  const s = store();
  keep(s, { on: true, sheets: ['stand-in'], scroll: 120 });
  const open = restored(store({ [BUILD]: s.getItem(BUILD)! })); // a fresh page over the same storage
  assert.deepEqual(open, { on: true, sheets: ['stand-in'], scroll: 120 });
  const drawn = Sheet({ open, saved: () => {} }) as any;
  const [body, foot] = drawn.props.children.props.children;
  assert.equal(body, 'stand-in sheet');
  assert.equal(foot.props.children, 'rooms/hall.yaml');
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
  assert.deepEqual(saved, { on: true, sheets: ['stand-in'], scroll: 300 });

  assert.deepEqual(restored(store({ [BUILD]: '{"on":false,"sheets":["stand-in"]}' })), {
    on: false,
  });
  assert.deepEqual(restored(store({ [BUILD]: '{"on":true}' })), { on: true });
  // Breaks: a hand-edited stack drawing a non-id, or more than four sheets after a reload.
  assert.deepEqual(restored(store({ [BUILD]: '{"on":true,"sheets":[1,"a","b","c","d","e"]}' })), {
    on: true,
    sheets: ['b', 'c', 'd', 'e'],
    scroll: 0,
  });
  assert.deepEqual(restored(store({ [BUILD]: '{"on":true,"sheets":"x"}' })), { on: true });
  assert.deepEqual(restored(store({ [BUILD]: '{garbled' })), { on: false });
  // Breaks: a reload or leaving Build forgetting the room Start in this room goes back to.
  assert.deepEqual(restored(store({ [BUILD]: '{"on":false,"room":"loft"}' })), {
    on: false,
    room: 'loft',
  });
  assert.deepEqual(toggled({ on: true, sheets: ['checks'], room: 'loft' }), {
    on: false,
    room: 'loft',
  });
});

// Breaks: a fifth sheet growing the stack or dropping its bottom, Back closing more than the top,
// the breadcrumb out of order or the dialog named by another sheet, the sheet modal beside the Book (or not modal over it on a phone),
// docking below 1152 px or floating at it, sliding from the wrong side or under reduced motion,
// the title and body not keyed by the top sheet (a new one must remount: focus to the title, scroll
// to the top), or the focus left behind when the last sheet closes.
test('sheets stack to four, Back closes the top, and the sheet is modal only over the Book', async () => {
  const { Strip, install, open, sheets } = await import('./build/Build.tsx');
  for (const k of 'abcde') sheets[k] = { title: () => k.toUpperCase(), body: () => k };
  let focused = 0;
  const opener = { focus: () => focused++ };
  Object.defineProperty(globalThis, 'localStorage', { value: store(), configurable: true });
  Object.assign(globalThis, { document: { activeElement: opener }, addEventListener() {} });
  install({ seen: new Map(), said: new Map(), redraw() {}, api: async () => [200, { map: [] }] });
  try {
    const drawn = () => nodes(Strip({ children: 'book' }));
    const dialog = () => drawn().find((n) => n.props?.role === 'dialog');
    const crumbs = () => {
      const d = nodes(dialog());
      return [
        d.find((n) => n.props?.accessibilityRole === 'header').props.children,
        d.find((n) => typeof n.props?.children === 'string' && n.props.children.includes(' › '))
          ?.props.children,
      ];
    };
    for (const k of 'abcde') open(k);
    assert.deepEqual(crumbs(), ['E', 'A › B › C']);
    assert.equal(dialog().props['aria-label'], 'E', 'the dialog is named by its top sheet');
    const title = nodes(dialog()).find((n) => n.props?.accessibilityRole === 'header');
    const body = dialog().props.children.at(-1).props.children; // the unexpanded <Sheet>
    assert.deepEqual([title.key, body.key], ['e', 'e'], 'title and body keyed by the top sheet');
    Object.assign(globalThis, { document: { activeElement: null } }); // focus moved into the sheet
    nodes(dialog())
      .find((n) => n.props?.children?.props?.children === 'Back')
      .props.onPress();
    assert.deepEqual(crumbs(), ['C', 'A › B']);
    const slid = () => dialog().props.style.at(-1);
    Object.assign(globalThis, { innerWidth: 1151, matchMedia: () => ({ matches: false }) });
    assert.equal(dialog().props['aria-modal'], true, 'a phone sheet over the Book is modal');
    assert.equal(slid().animationKeyframes[0].from.transform, 'translateY(100%)');
    Object.assign(globalThis, { innerWidth: 1152 });
    assert.equal(dialog().props['aria-modal'], false, 'a docked sheet leaves the Book playable');
    assert.equal(slid().animationKeyframes[0].from.transform, 'translateX(100%)');
    Object.assign(globalThis, { matchMedia: () => ({ matches: true }) });
    assert.equal(slid(), false, 'reduced motion cuts the sheet in');
    for (let i = 0; i < 3; i++)
      nodes(dialog())
        .find((n) => n.props?.children?.props?.children === 'Back')
        .props.onPress();
    assert.equal(dialog(), undefined);
    assert.equal(focused, 1, 'the last Back returns the focus to what opened the first sheet');
  } finally {
    Object.assign(globalThis, {
      document: undefined,
      innerWidth: undefined,
      matchMedia: undefined,
    });
  }
});

// Breaks: opening a sheet already lower in the stack adding a second copy, reopening the top sheet
// throwing away its scroll, Back showing the sheet under at the closed one's scroll, or closing
// a named sheet (a deleted room's) taking the top one instead.
test('a lower sheet opened again rises to the top; the top reopened keeps its place', () => {
  const b = { on: true, sheets: ['checks', 'room:loft'], scroll: 300 };
  assert.deepEqual(opened(b, 'checks'), { on: true, sheets: ['room:loft', 'checks'], scroll: 0 });
  assert.equal(opened(b, 'room:loft'), b);
  assert.deepEqual(closed(b), { on: true, sheets: ['checks'], scroll: 0 });
  assert.deepEqual(closed(b, 'checks'), { on: true, sheets: ['room:loft'], scroll: 0 });
});

// Breaks: a drag on the phone sheet's grip setting the wrong height (up is full, down is half), a
// drag down from half not closing the sheet as Back does (§5), a short drag (a quarter of the touch size) read as a tap, or a drag also toggling as a tap.
test('the grip: a drag sets the height by its direction or closes from half, a tap toggles', async () => {
  const { Grip } = await import('./build/sheet.tsx');
  const grown: (boolean | 'back')[] = [];
  const press = (full: boolean, from: number, to: number) => {
    const p = Grip({ full, grow: (f) => grown.push(f), back: () => grown.push('back') }).props;
    p.onPressIn({ nativeEvent: { pageY: from } });
    p.onPressOut({ nativeEvent: { pageY: to } });
    p.onPress();
  };
  press(true, 100, 89); // up by 11 = 44 / 4: full (a tap would halve it)
  press(true, 100, 111); // down from full: half
  press(false, 100, 111); // down from half: Back (a tap would fill it)
  press(false, 100, 100); // a tap
  press(true, 100, 90); // 10 is short of a drag: a tap
  assert.deepEqual(grown, [true, false, 'back', true, false]);
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

// Breaks: a slow, older /story answer overwriting the newer map (the pencil and Room sheet showing
// the room's old title), or a refused or malformed answer leaving a header or Room sheet that throws.
test('the newest map wins; a refused answer keeps it, a malformed one empties it', async () => {
  const { story, pencil } = await import('./build/room.tsx');
  const { sheets } = await import('./build/sheet.tsx');
  const replies: ((a: [number, any]) => void)[] = [];
  const slow = () => new Promise<[number, any]>((r) => replies.push(r));
  let drawn = 0;
  const loft = (title: string) => ({ map: [{ key: 'loft', area: null, title, exits: [] }] });
  const has = (title: string) => pencil(title, 'loft', () => {}) !== undefined;
  story(
    slow,
    () => drawn++,
    () => {},
  );
  story(
    slow,
    () => drawn++,
    () => {},
  );
  replies[1]([200, loft('Attic')]);
  replies[0]([200, loft('Loft')]);
  await new Promise((r) => setTimeout(r));
  assert.deepEqual([has('Attic'), has('Loft'), drawn], [true, false, 1]);
  story(
    slow,
    () => drawn++,
    () => {},
  );
  replies[2]([500, loft('Loft')]);
  await new Promise((r) => setTimeout(r));
  assert.equal(has('Attic'), true, 'a refused answer keeps the map');
  story(
    slow,
    () => drawn++,
    () => {},
  );
  replies[3]([200, {}]);
  await new Promise((r) => setTimeout(r));
  assert.equal(has('Attic'), false);
  assert.equal(sheets.room.body('loft'), null, 'no room, no sheet body');
});
