// Wide layout and Open source (docs/system/book-ui.md#wide-layout, #open-source; slice 6.5a): the
// notebook column from DOCK.at, and each Open source route sending one /open.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const settle = () => new Promise((r) => setTimeout(r));
const stored = new Map([['loka-build-tab', 'World']]); // a tab left open before this page loaded
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
    removeItem: (k: string) => void stored.delete(k),
  },
  addEventListener() {},
  matchMedia: () => ({ matches: false }),
  document: { activeElement: null },
});
const sent: unknown[] = [];
let answer: [number, unknown] = [200, {}];
Object.assign(globalThis, {
  fetch: async (url: string, init?: { body: string }) => {
    sent.push([url, init && JSON.parse(init.body)]);
    return { status: answer[0], json: async () => answer[1] };
  },
});
const { Strip, install, open, altClick } = await import('./build/Build.tsx');
const { DOCK, Foot } = await import('./build/sheet.tsx');
const { BUILD, restored } = await import('./build/build.ts');
const { strip } = await import('./build/source.ts');
const label = (n: any) => n.props?.children?.props?.children;
const press = (all: any[], name: string) =>
  all.find((n) => n.type === 'Pressable' && label(n) === name).props.onPress();

// Breaks: a route sending no /open or two (the panel relay kept beside the Book's own post, or the
// Book line's own press also firing), Alt-click outside the Book or on touch, or a refusal unsaid
// or outliving the next press.
test('the foot and Alt-click each send one /open; a refusal shows until the next press', async () => {
  let note = '';
  const state = Symbol.for('combat-state');
  const was = (globalThis as any)[state];
  (globalThis as any)[state] = () => [note, (n: string) => (note = n)];
  try {
    const foot = () => nodes(Foot({ file: 'rooms/hall.yaml' }));
    press(foot(), 'rooms/hall.yaml');
    await settle();
    assert.deepEqual(sent.splice(0), [['/__author/open', { file: 'rooms/hall.yaml' }]]);
    assert.equal(note, '');
    answer = [409, 'no editor set'];
    press(foot(), 'rooms/hall.yaml');
    await settle();
    const said = () => foot().find((n) => n.props?.['aria-live']).props.children;
    assert.equal(said(), 'Not opened: no editor set');
    press(foot(), 'rooms/hall.yaml');
    assert.equal(said(), '', 'the next press clears the refusal');
  } finally {
    (globalThis as any)[state] = was;
  }
  sent.length = 0;

  let stops = 0;
  const line = { key: 'room.hall.title', words: 'Hall' };
  const click = (over: object = {}, inBook = true) =>
    altClick(
      {
        altKey: true,
        target: { closest: (s: string) => (inBook && s === '[data-testid="loka-book"]') || null },
        preventDefault: () => stops++,
        stopPropagation: () => stops++,
        ...over,
      } as never,
      line,
    );
  answer = [404, 'no such key'];
  assert.equal(click(), true);
  await settle();
  assert.deepEqual(sent.splice(0), [['/__author/open', line]]);
  assert.equal(stops, 2, 'the line under the click does not also act');
  assert.equal(strip.note, 'Not opened: no such key');
  assert.equal(click({ altKey: false }), false);
  assert.equal(click({}, false), false, 'outside the Book');
  Object.assign(globalThis, {
    matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }),
  });
  assert.equal(click(), false, 'a touch screen');
  Object.assign(globalThis, { matchMedia: () => ({ matches: false }) });
  await settle();
  assert.deepEqual([sent, stops], [[], 2]);
  answer = [200, {}];
});

// Breaks: the column at the wrong width or not 384 wide, opening in the stack (Back closing it), a
// notebook sheet left under it, staying open (or reopening) after narrowing, losing its tab or
// scroll on a reload, or Close leaving the focus in nowhere.
test('from 1152 Notebook opens a column beside the Book and the docked sheet; narrowing closes it', async () => {
  stored.set(BUILD, '{"on":true}');
  install({ seen: new Map(), said: new Map(), redraw() {}, api: async () => [200, { map: [] }] });
  let focused = 0;
  Object.assign(globalThis, {
    innerWidth: DOCK.at,
    document: { activeElement: { focus: () => focused++ } },
  });
  const drawn = () => nodes(Strip({ children: 'book' }));
  const column = () => drawn().find((n) => n.props?.['aria-label'] === 'Notebook' && !n.props.role);
  const chip = () =>
    drawn().find((n) => n.type === 'Pressable' && label(n) === 'Notebook').props.accessibilityState;
  assert.equal(DOCK.width, 384);
  open('contents');
  press(drawn(), 'Notebook');
  assert.deepEqual(restored(localStorage).sheets, undefined, 'the notebook sheet gives way');
  const slid = column().props.style.at(-1).animationKeyframes[0].from.transform;
  assert.equal(slid, 'translateX(-100%)', 'the column slides in from the left');
  assert.equal(chip().selected, true);
  const selected = nodes(column()).find((n) => n.props?.accessibilityState?.selected);
  assert.equal(label(selected), 'World', 'the tab left open comes back');
  press(nodes(column()), 'Recent');
  assert.equal(stored.get('loka-build-tab'), 'Recent');
  open('map');
  const dialog = drawn().find((n) => n.props?.role === 'dialog');
  assert.equal(dialog.props['aria-modal'], false);
  const at = (find: (n: any) => boolean) => drawn().findIndex(find);
  const order = [
    at((n) => n.props?.['aria-label'] === 'Notebook' && !n.props.role),
    at((n) => n.props?.testID === 'loka-book'),
    at((n) => n.props?.role === 'dialog'),
  ];
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    'notebook, Book, sheet, left to right',
  );
  assert.ok(order[0] >= 0);
  press(nodes(dialog), 'Back');
  assert.ok(column(), 'Back closes the sheet, not the column');
  assert.equal(restored(localStorage).notebook, 0, 'a reload brings the column back');
  const before = focused; // Back handed the focus back to the same opener
  press(nodes(column()), 'Close');
  assert.deepEqual([column(), focused - before], [undefined, 1], 'Close hands the focus back');

  press(drawn(), 'Notebook');
  Object.assign(globalThis, { innerWidth: DOCK.at - 1 });
  assert.equal(column(), undefined, 'a narrow window has no column');
  press(drawn(), 'Notebook');
  assert.ok(
    drawn().find((n) => n.props?.role === 'dialog'),
    'below 1152 the notebook is a sheet',
  );
  Object.assign(globalThis, { innerWidth: DOCK.at });
  assert.equal(column(), undefined, 'widening again does not reopen it');
});
