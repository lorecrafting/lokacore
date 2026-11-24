// The Build map (docs/rnd/in-game-builder-mode-2026-11-19.md §4.7, slice 4.2) on the showcase's /story
// map: one level's rooms draw, a tap only selects, Go here starts in the room, ⌃ ⌄ step levels, and a
// drag or zoom keeps the level on screen. The view math itself: kernel/ts/test/map.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storyMap } from '../../authority/local-story/__tests__/compiled.ts';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';

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
build.install({ seen: new Map(), said: new Map(), redraw() {}, api } as never);
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
    .filter((e) => e.type === 'Pressable' && e.props.style?.position === 'absolute')
    .map((e) => e.props.accessibilityLabel.split(', ')[0]);
const room = (key: string) =>
  sheet().find((e) => e.props?.accessibilityLabel?.startsWith(`${key}, `)).props;
const box = (key: string) => room(key).style;
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
  ground().props.onLayout({ nativeEvent: { layout: { width: SIZE, height: SIZE } } });
  assert.equal(title(), 'Map · level 0');
  assert.equal(drawn().sort().join(' '), LEVEL0);
});

test('a tap selects and plays nothing; Go here starts in that room, Sheet opens its sheet', () => {
  room('smithy').onPress();
  assert.deepEqual(went, []);
  assert.ok(sheet().some((e) => e.type === 'Text' && e.props.children === 'smithy — selected'));
  press('Go here');
  assert.deepEqual(went, ['smithy']);
  press('Sheet');
  assert.equal(JSON.parse(kept.get(BUILD)!).sheets.at(-1), 'room:smithy');
});

test('⌃ and ⌄ step through the levels, and stop at the top', () => {
  press('Level up');
  assert.equal(title(), 'Map · level 1');
  assert.equal(drawn().sort().join(' '), LEVEL1);
  press('Level up');
  press('Level up');
  assert.equal(title(), 'Map · level 2');
  assert.deepEqual(drawn(), ['loft_attic']);
  press('Level down');
  press('Level down');
  press('Level down');
  assert.equal(title(), 'Map · level -1');
  press('Level up');
  assert.equal(title(), 'Map · level 0');
});

test('fit, then a far drag and a zoom in, keep one cell of the level on screen', () => {
  press('Fit'); // level 0 spans 13 cells (832 px): zoom 384 / 832 = 6/13
  const t = { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 100, top: 100 }) };
  const at = (x: number) => ({
    nativeEvent: { pointerId: 1, clientX: x, clientY: x },
    target: t,
    currentTarget: t,
  });
  ground().props.onPointerDown(at(0));
  ground().props.onPointerMove(at(10000));
  ground().props.onPointerUp(at(10000));
  // keep: x ≤ 384 - 64z + 576z, so crossroads_inn's box (centre 32z in, half-width 24z) is at 384 + 520z
  assert.equal(box('crossroads_inn').left.toFixed(2), (384 + (520 * 6) / 13).toFixed(2)); // 624
  press('Zoom in'); // zoom 7.5/13, about the centre, then kept again
  assert.equal(box('crossroads_inn').left.toFixed(2), (384 + (520 * 7.5) / 13).toFixed(2)); // 684
});

test('Go here lets the map follow the current room again, refitted to the level it reaches', () => {
  press('Level down'); // stepped: level -1
  room(drawn()[0]).onPress();
  press('Go here');
  here = 'mill'; // (level 1): the Book took the stairs
  assert.equal(title(), 'Map · level 1');
  for (const key of drawn()) {
    const { left, top, width, height } = box(key);
    assert.ok(left >= 0 && top >= 0 && left + width <= SIZE && top + height <= SIZE, key);
  }
});
