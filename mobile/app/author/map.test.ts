// The Build map (docs/rnd/in-game-builder-mode-2026-11-19.md §4.7, slice 4.2) on the showcase's /story
// map: one level's rooms draw, a tap only selects, Go here starts in the room, ⌃ ⌄ step levels, and a
// drag or zoom keeps the level on screen. The view math itself: kernel/ts/test/map.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storyMap } from '../../authority/local-story/__tests__/compiled.ts';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { size } from '../book/tokens.ts';
import { BUILD, ink } from './build/build.ts';

const map = storyMap('cartridges/toolbox_showcase');
const kept = new Map([[BUILD, '{"on":true}']]);
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener() {},
});
const build = await import('./build/Build.tsx');
const went: string[] = [];
let here: string | undefined; // the Book's room: unknown until the first page
build.place({
  place: () => ({ steps: [] }),
  here: () => here,
  drop() {},
  back() {},
  startIn: (room: string) => void went.push(room),
} as never);
const api = async (path: string): Promise<[number, any]> =>
  path === '/story' ? [200, { map, files: {} }] : [200, null];
let books = 0; // the Book's redraws
let paints = 0; // a component's own redraws (useState setters; the shim reads this per call)
// as React: a set to the same value redraws nothing
(globalThis as any)[Symbol.for('combat-state')] = (v: unknown) => [
  v,
  (next: unknown) => !Object.is(typeof next === 'function' ? next(v) : next, v) && paints++,
];
build.install({ seen: new Map(), said: new Map(), redraw: () => books++, api } as never);
await new Promise((r) => setTimeout(r)); // the map

const strip = () => nodes(build.Strip({ children: 'book' }));
const sheet = () => nodes(build.sheets.map.body(''));
const title = () => build.sheets.map.title('');
const named = (n: any[], label: string) =>
  n.find(
    (e) =>
      e.type === 'Pressable' &&
      (e.props.accessibilityLabel ?? e.props.children?.props?.children) === label,
  );
const press = (label: string) => named(sheet(), label).props.onPress();
/** The room boxes drawn, by key (a box's accessible name starts with its key). */
const drawn = () =>
  sheet()
    .filter(
      (e) =>
        e.type === 'Pressable' &&
        e.props.style?.position === 'absolute' &&
        e.props.accessibilityState,
    )
    .map((e) => e.props.accessibilityLabel.split(', ')[0]);
const room = (key: string) =>
  sheet().find((e) => e.props?.accessibilityLabel?.startsWith(`${key}, `)).props;
/** A room's drawn box (its button is the whole cell around it). */
const box = (key: string) => room(key).children.props.style;
/** A room's centre on the ground and its box's width. */
const mid = (key: string) => {
  const c = room(key).style;
  return { x: c.left + c.width / 2, y: c.top + c.height / 2, w: box(key).width };
};
const near = (a: { x: number; y: number; w: number }, b: typeof a, m: string) =>
  assert.deepEqual(
    [a.x, a.y, a.w].map((n) => n.toFixed(3)),
    [b.x, b.y, b.w].map((n) => n.toFixed(3)),
    m,
  );
const ground = () => sheet().find((e) => e.props?.onLayout);
const SIZE = 384; // the docked sheet's width (sheet.tsx DOCK)

// cartridges/toolbox_showcase/layout.json's z 0, sorted
const LEVEL0 =
  'boar_run carpenter_shop church cliff_path cliff_top crossroads_inn drill_yard farm_kitchen farm_yard fell_gate fell_top gate_yard glade goblin_pit hall_closet holding_lane larder midden moot_hall pond pond_deep sea_cave shepherd_hut shore_steps smithy stall still_room the_fold tide_pools tilt_yard timber_yard tollhouse village_green warden_gate woodpile woodstore';
const LEVEL1 = 'crypt_stair golem_yard holding_croft loft mill reading_room wayside_shrine';

test('Map opens from the Build strip on the current room level; every room there draws once, no other', () => {
  assert.equal(title(), 'Map · level -3'); // before the Book knows its room: the lowest level
  here = 'crossroads_inn'; // (0, 0, 0)
  named(strip(), 'Map').props.onPress();
  assert.equal(JSON.parse(kept.get(BUILD)!).sheets.at(-1), 'map');
  assert.deepEqual(drawn(), []); // no size yet
  ground().props.onLayout({ nativeEvent: { layout: { width: SIZE, height: SIZE } } });
  assert.equal(title(), 'Map · level 0');
  assert.equal(drawn().sort().join(' '), LEVEL0);
});

test('a tap selects and plays nothing; Go here starts in that room, Sheet opens its sheet', () => {
  room('smithy').onPress();
  assert.deepEqual(went, []);
  assert.deepEqual(
    drawn().filter((k) => room(k).accessibilityState.selected),
    ['smithy'],
  );
  assert.ok(sheet().some((e) => e.type === 'Text' && e.props.children === 'smithy — selected'));
  press('Go here');
  assert.deepEqual(went, ['smithy']);
  press('Sheet');
  assert.equal(JSON.parse(kept.get(BUILD)!).sheets.at(-1), 'room:smithy');
});

test('the least zoom makes a cell a touch target; a level too big for it centres on the current room', () => {
  press('Fit'); // level 0: 13 cells, 384 / 832 under 44 / 64
  const c = mid('crossroads_inn'); // (0, 0): centred
  near(c, { x: SIZE / 2, y: SIZE / 2, w: (48 * 44) / 64 }, 'fit stops at the least zoom');
  assert.equal(room('crossroads_inn').style.width, size.touch, 'the button is the cell');
  press('Zoom out');
  near(mid('crossroads_inn'), c, 'zoom out stops there too');
  const ring = () => [box('crossroads_inn').borderWidth, box('crossroads_inn').borderColor];
  assert.deepEqual(ring(), [size.speechBar, ink('action')], 'the current room is ringed');
  assert.equal(box('smithy').borderWidth, size.rule);
  room('crossroads_inn').onPress();
  assert.deepEqual(ring(), [size.speechBar, ink('fg')], 'in fg on its selected box');
  const g = ground().props;
  g.onLayout({ nativeEvent: { layout: { width: 572, height: 572 } } }); // 572 / 832 = 44 / 64: it fits
  near(
    mid('crossroads_inn'),
    { x: 286 + 192 * (44 / 64), y: 286 + 192 * (44 / 64), w: 33 }, // its middle is cell (-2.5, -2.5)
    'a level that fits at the least zoom centres on its middle',
  );
  g.onLayout({ nativeEvent: { layout: { width: SIZE, height: SIZE } } });
});

test('⌃ ⌄ step through the levels, disabled at the top and bottom, hidden on one level', () => {
  press('Level up');
  assert.equal(title(), 'Map · level 1');
  assert.equal(drawn().sort().join(' '), LEVEL1);
  press('Level up');
  assert.equal(title(), 'Map · level 2');
  assert.deepEqual(drawn(), ['loft_attic']);
  const off = (label: string) => named(sheet(), label).props.accessibilityState.disabled;
  assert.deepEqual([off('Level up'), off('Level down')], [true, false], 'the top');
  for (let i = 0; i < 5; i++) press('Level down'); // 2 to -3
  assert.equal(title(), 'Map · level -3');
  assert.deepEqual([off('Level up'), off('Level down')], [false, true], 'the bottom');
  press('Level up');
  press('Level up');
  assert.equal(title(), 'Map · level -1');
  press('Level up');
  assert.equal(title(), 'Map · level 0');
});

test('fit, then a far drag and a zoom in, keep one cell of the level on screen', () => {
  press('Fit'); // level 0 spans 13 cells (832 px): the least zoom, 44 / 64
  const t = { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 100, top: 100 }) };
  const at = (x: number) => ({
    nativeEvent: { pointerId: 1, clientX: x, clientY: x },
    target: t,
    currentTarget: t,
  });
  ground().props.onPointerDown(at(0));
  ground().props.onPointerMove(at(10000));
  ground().props.onPointerUp(at(10000));
  // keep: x ≤ 384 - 64z + 576z, so crossroads_inn's centre (32z in) is at 384 + 544z
  assert.equal(mid('crossroads_inn').x.toFixed(2), (384 + 544 * (44 / 64)).toFixed(2)); // 758
  press('Zoom in'); // about the centre, then kept again
  assert.equal(mid('crossroads_inn').x.toFixed(2), (384 + 544 * (55 / 64)).toFixed(2)); // 851.5
});

test('zoom, pinch and wheel act about their point; a room press within slop taps, past it pans', () => {
  press('Fit');
  const c = mid('crossroads_inn');
  const t = { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 100, top: 50 }) };
  const ev = (id: number, x: number, target: object = t) => ({
    nativeEvent: { pointerId: id, clientX: x + 100, clientY: c.y + 50 },
    target,
    currentTarget: t,
  });
  const g = ground().props;
  g.onPointerDown(ev(1, c.x, {})); // on the room
  g.onPointerMove(ev(1, c.x + 10)); // within a tap's slop (11)
  g.onPointerUp(ev(1, c.x + 10));
  room('crossroads_inn').onPress();
  near(mid('crossroads_inn'), c, 'a tap drags nothing');
  assert.ok(
    sheet().some((e) => e.props?.children === 'crossroads_inn — selected'),
    'and selects',
  );
  g.onPointerDown(ev(1, c.x, {}));
  g.onPointerMove(ev(1, c.x + 11)); // at the slop: a drag
  g.onPointerUp(ev(1, c.x + 11));
  room('smithy').onPress();
  near(mid('crossroads_inn'), { ...c, x: c.x + 11 }, 'a room press that moves pans');
  assert.ok(!sheet().some((e) => e.props?.children === 'smithy — selected'), 'and selects nothing');
  press('Fit');
  g.onPointerDown(ev(1, c.x));
  g.onPointerMove(ev(3, c.x + 50)); // a pointer not held (a hovering mouse)
  g.onPointerUp(ev(1, c.x));
  near(mid('crossroads_inn'), c, 'only held pointers move the view');
  g.onPointerDown(ev(1, c.x - 10));
  g.onPointerDown(ev(2, c.x + 10));
  g.onPointerMove(ev(1, c.x - 20));
  g.onPointerMove(ev(2, c.x + 20));
  g.onPointerUp(ev(1, c.x - 20));
  g.onPointerUp(ev(2, c.x + 20));
  near(mid('crossroads_inn'), { ...c, w: c.w * 2 }, 'a pinch apart doubles about its midpoint');
  let wheel: (e: object) => void = () => {};
  g.ref({ addEventListener: (_: string, f: typeof wheel) => (wheel = f) });
  wheel({
    preventDefault() {},
    deltaY: -50,
    clientX: c.x + 100,
    clientY: c.y + 50,
    currentTarget: t,
  });
  near(
    mid('crossroads_inn'),
    { ...c, w: c.w * 2 * Math.exp(0.5) },
    'the wheel zooms about the cursor',
  );
  g.onLayout({ nativeEvent: { layout: { width: SIZE, height: SIZE } } });
  near(
    mid('crossroads_inn'),
    { ...c, w: c.w * 2 * Math.exp(0.5) },
    'a same-size layout keeps the view',
  );
  g.onLayout({ nativeEvent: { layout: { width: SIZE, height: SIZE / 2 } } });
  assert.notEqual(
    mid('crossroads_inn').w.toFixed(3),
    (c.w * 2 * Math.exp(0.5)).toFixed(3),
    'a new height refits',
  );
  g.onLayout({ nativeEvent: { layout: { width: SIZE, height: SIZE } } });
  press('Fit');
  const f = mid('crossroads_inn');
  press('Zoom in'); // about the ground's centre
  near(
    mid('crossroads_inn'),
    { x: SIZE / 2 + (f.x - SIZE / 2) * 1.25, y: SIZE / 2 + (f.y - SIZE / 2) * 1.25, w: f.w * 1.25 },
    'Zoom in about the centre',
  );
  press('Zoom out');
  near(mid('crossroads_inn'), f, 'Zoom out undoes it');
});

test('a drag, pinch or zoom redraws only the drawing; a level step redraws the Book (its title)', () => {
  const t = { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const ev = (id: number, x: number) => ({
    nativeEvent: { pointerId: id, clientX: x, clientY: x },
    target: t,
    currentTarget: t,
  });
  const g = ground().props;
  const [b0, p0] = [books, paints];
  g.onPointerDown(ev(1, 100));
  g.onPointerMove(ev(1, 120)); // a drag
  g.onPointerDown(ev(2, 200));
  g.onPointerMove(ev(2, 220)); // a pinch
  g.onPointerUp(ev(1, 120));
  g.onPointerUp(ev(2, 220));
  press('Zoom in');
  press('Fit');
  assert.deepEqual([books - b0, paints - p0], [0, 4]);
  press('Level up');
  assert.equal(books - b0, 1);
  press('Level down');
});

test('on a phone the drawing leaves the selection bar inside the half-height sheet; docked it stays square', async () => {
  Object.assign(globalThis, { innerWidth: 390, innerHeight: 844 });
  // the grip, Back, the title and the controls over it; the bar's rule, gap, words and acts under it
  // measured in the 390x844 web Book: the sheet is 399.5 high from y 444.5; 153 above the ground, 67
  // under it to the acts' foot at 844
  assert.equal(ground().props.style.maxHeight, 399.5 - 153 - 67);
  // once measured, the Book's row (Undo wraps Build's strip) and the bar (its acts wrap) rule
  const { measured } = await import('./build/map.tsx');
  const tall = (part: 'book' | 'bar', height: number) =>
    measured(part)({ nativeEvent: { layout: { width: 390, height } } });
  tall('book', 747);
  tall('bar', 119);
  assert.equal(ground().props.style.maxHeight, 747 / 2 - 153 - 119);
  tall('book', 799);
  tall('bar', 67);
  Object.assign(globalThis, { innerWidth: 1152, innerHeight: 800 }); // DOCK.at: docked from here
  assert.equal(ground().props.style.maxHeight, undefined);
  Object.assign(globalThis, { innerWidth: undefined, innerHeight: undefined });
});

test('Go here lets the map follow the current room again, refitted to the level it reaches', () => {
  press('Level down'); // stepped: level -1
  room(drawn()[0]).onPress();
  press('Go here');
  here = 'mill'; // (level 1): the Book took the stairs
  assert.equal(title(), 'Map · level 1');
  assert.deepEqual(
    drawn().filter((k) => room(k).accessibilityLabel.endsWith(', here')),
    ['mill'],
  );
  for (const key of drawn()) {
    const { x, y, w } = mid(key);
    assert.ok(x - w / 2 >= 0 && y >= 0 && x + w / 2 <= SIZE && y <= SIZE, key); // level 1 fits
  }
});

test('a stepped level that loses its rooms falls back; an unplaced room selects from its chip; a vanished one clears', async () => {
  const { known } = await import('./build/room.tsx');
  const all = known.rooms;
  press('Level up'); // from mill's level 1
  assert.equal(title(), 'Map · level 2');
  const smithy = all.find((r) => r.key === 'smithy')!;
  known.rooms = [
    ...all.filter((r) => r.key !== 'loft_attic'),
    { ...smithy, key: 'nowhere', at: undefined },
  ];
  assert.equal(title(), 'Map · level 1');
  press('nowhere');
  assert.equal(
    sheet().find((e) => e.key === 'unplaced nowhere').props.accessibilityState.selected,
    true,
  );
  const bar = () =>
    sheet().some((e) => e.type === 'Text' && e.props.children === 'nowhere — tap an empty cell');
  assert.ok(bar());
  const order = sheet().map((e) => e.key ?? e.props?.children);
  assert.ok(
    order.indexOf('nowhere — tap an empty cell') < order.indexOf('unplaced nowhere'),
    'the bar first',
  );
  known.rooms = all.filter((r) => r.at?.z === 0);
  assert.equal(named(sheet(), 'Level up'), undefined, 'one level: no ⌃ ⌄');
  known.rooms = all.filter((r) => r.at?.z === 0 || r.at?.z === 1);
  assert.ok(named(sheet(), 'Level up'), 'two levels: ⌃ ⌄');
  const ink = (label: string) => named(sheet(), label).props.children.props.style.transform[0];
  assert.deepEqual(ink('Zoom out'), { translateY: 0 }, 'only the chevrons are nudged');
  known.rooms = all;
  assert.ok(!bar());
});

test('an exit runs box edge to box edge over a room between its two rooms', async () => {
  const { known } = await import('./build/room.tsx');
  const all = known.rooms;
  const r = (key: string, x: number, exits: object[]) => ({
    ...all[0]!,
    key,
    at: { x, y: 0, z: 0 },
    exits,
  });
  known.rooms = [
    r('a', 0, [{ dir: 'east', to: 'b' }]),
    r('m', 1, []),
    r('b', 2, [{ dir: 'west', to: 'a' }]),
  ];
  const n = sheet();
  const at = n.findIndex((e) => e.props?.pointerEvents === 'none');
  const line = n[at].props.style;
  const [a, b] = [mid('a'), mid('b')];
  assert.deepEqual(
    [line.left + line.width / 2, line.top + line.height / 2, line.width].map((v) => v.toFixed(3)),
    [(a.x + b.x) / 2, a.y, b.x - a.x - a.w].map((v) => v.toFixed(3)),
    'centred between the rooms, from the right edge of a to the left edge of b',
  );
  assert.deepEqual([line.height, line.backgroundColor], [size.rule, ink('dim')], "Map's line");
  assert.ok(
    at > n.findIndex((e) => e.props?.accessibilityLabel?.startsWith('m, ')),
    'drawn after the middle box',
  );
  known.rooms = all;
});
