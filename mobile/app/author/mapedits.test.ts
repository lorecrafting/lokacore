// The Build map's edits (author/build/map.tsx, slice 4.3): which press or tap sends which write-route
// calls, and the strip's Undo puts back the whole gesture. The gestures' own rules are mapedit's
// (kernel/ts/test/author_mapedit.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';

// a reload after a gesture's compile: its chip (the gesture's journal ids) and the map's selection kept
const kept = new Map([
  [BUILD, '{"on":true}'],
  ['loka-build-undo', JSON.stringify({ w: { ids: [3, 4] }, end: Date.now() + 60_000 })],
  ['loka-build-map', 'loft'],
]);
const keys: ((e: { key: string }) => void)[] = [];
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener: (type: string, fn: never) => type === 'keydown' && keys.push(fn),
  removeEventListener() {},
});
const room = (key: string, at: object | undefined, exits: { dir: string; to: string }[] = []) => ({
  ref: key,
  key,
  file: `rooms/${key}.json`,
  area: 'yard',
  title: key,
  exits,
  at,
});
const map = [
  room('hall', { x: 0, y: 0, z: 0 }, [{ dir: 'north', to: 'loft' }]),
  room('loft', { x: 0, y: -1, z: 0 }, [{ dir: 'south', to: 'hall' }]),
  room('yard', { x: 2, y: 1, z: 0 }),
  room('cellar', undefined),
];
const doc: Record<string, unknown> = {
  'rooms/hall.json': { exits: { north: { to: 'loft' } } },
  'rooms/loft.json': { exits: { south: { to: 'hall' } } },
  'rooms/yard.json': {},
  'layout.json': [
    { room: 'hall', x: 0, y: 0, z: 0 },
    { room: 'loft', x: 0, y: -1, z: 0 },
    { room: 'yard', x: 2, y: 1, z: 0 },
  ],
};
let posts: [string, any][] = [];
let id = 0;
let refuse = ''; // an /undo refused with these words
const api = async (path: string, sent?: object): Promise<[number, any]> => {
  if (refuse && path === '/undo') return [409, refuse];
  if (sent) return (posts.push([path, sent]), [200, { id: ++id }]);
  if (path === '/story') return [200, { map, files: {} }];
  const file = decodeURIComponent(path.split('file=')[1]!);
  return doc[file] ? [200, { bytes: JSON.stringify(doc[file]), sha256: 'S' }] : [404, null];
};
const build = await import('./build/Build.tsx');
const roomedit = await import('./build/roomedit.tsx');
build.place({ place: () => ({ steps: [] }), here: () => 'hall' } as never);
build.install({ seen: new Map(), said: new Map(), redraw() {}, api } as never);
const settle = () => new Promise((r) => setTimeout(r));
nodes(build.sheets.map.body('')); // the reloaded sheet draws before /story answers
await settle(); // the map

const sheet = () => nodes(build.sheets.map.body(''));
const strip = () => nodes(build.Strip({ children: 'book' }));
const named = (n: any[], label: string) =>
  n.find(
    (e) =>
      e.type === 'Pressable' &&
      (e.props.accessibilityLabel ?? e.props.children?.props?.children) === label,
  );
const press = async (label: string, n = sheet()) => (named(n, label).props.onPress(), settle());
const pick = (key: string) =>
  sheet()
    .find((e) => e.props?.accessibilityLabel?.startsWith(`${key}, `))
    .props.onPress();
const ground = () => sheet().find((e) => e.props?.onLayout).props;
ground().onLayout({ nativeEvent: { layout: { width: 384, height: 384 } } });
/** A tap on the ground at cell (x, y), counted from hall's cell. */
async function tap(x: number, y: number, end = 'onPointerUp', id = 1) {
  const hall = sheet().find((e) => e.props?.accessibilityLabel?.startsWith('hall, ')).props.style;
  const at = {
    nativeEvent: {
      pointerId: id,
      clientX: hall.left + hall.width * (x + 0.5),
      clientY: hall.top + hall.height * (y + 0.5),
    },
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {} },
  };
  ground().onPointerDown(at);
  if (end) ground()[end](at);
  await settle();
}
const bar = () =>
  sheet().find((e) => e.type === 'Text' && / — /.test(e.props.children))?.props.children;
/** The strip's Undo; the ids the gesture's writes got, newest first. */
async function undo() {
  const last = id;
  posts = [];
  await press('Undo', strip());
  return last;
}

test('after the reload a gesture brings, loft stays selected and Undo puts back its writes, newest first', async () => {
  assert.equal(bar(), 'loft — selected');
  await undo(); // the editor's journal is empty: the kept ids go
  assert.deepEqual(posts, [
    ['/undo', { id: 4 }],
    ['/undo', { id: 3 }],
  ]);
});

test('＋ east on the selected room makes room_1 there in its area and selects it; Undo puts it back', async () => {
  pick('hall');
  assert.ok(named(sheet(), '＋ up'), 'up and down grow from the bar');
  assert.equal(named(sheet(), 'New room up'), undefined, 'not from a cell on this level');
  posts = [];
  await press('New room east');
  assert.deepEqual(posts, [
    [
      '/new',
      { kind: 'rooms', name: 'room_1', from: { room: 'hall', direction: 'east' }, area: 'yard' },
    ],
  ]);
  assert.equal(bar(), 'room_1 — selected', 'the new room, before /story has it');
  assert.equal(named(sheet(), 'Area…'), undefined, 'not yet a file Area… can move');
  assert.equal(kept.get('loka-build-map'), 'room_1', 'kept for the reload');
  assert.deepEqual(JSON.parse(kept.get('loka-build-undo')!).w, { ids: [id] }, 'the chip, kept');
  const last = await undo();
  assert.deepEqual(posts, [['/undo', { id: last }]]);
  assert.equal(bar(), undefined, 'the put-back room is no longer selected');
});

test('Join… then a tap on a room writes the exit toward it and the way back; one Undo puts back both', async () => {
  pick('hall');
  await press('Join…');
  assert.equal(bar(), 'hall — tap a room to join');
  posts = [];
  pick('yard'); // two east, one south: east
  await settle();
  assert.deepEqual(posts, [
    [
      '/change',
      {
        file: 'rooms/hall.json',
        was: 'S',
        ops: [{ path: ['exits', 'east'], value: { to: 'yard' } }],
      },
    ],
    [
      '/change',
      {
        file: 'rooms/yard.json',
        was: 'S',
        ops: [{ path: ['exits'], value: { west: { to: 'hall' } } }],
      },
    ],
  ]);
  const last = await undo();
  assert.deepEqual(posts, [
    ['/undo', { id: last }],
    ['/undo', { id: last - 1 }],
  ]);
});

test('Move… then a tap on an empty cell writes its layout row; a tap on a taken cell writes nothing', async () => {
  pick('loft');
  await press('Move…');
  assert.equal(bar(), 'loft — tap an empty cell');
  pick('hall');
  assert.equal(bar(), 'loft — tap an empty cell', 'a taken cell neither moves nor selects');
  posts = [];
  await tap(0, 0); // hall's cell
  assert.deepEqual(posts, []);
  await tap(2, 0); // yard's column, not its cell
  assert.deepEqual(posts, [
    [
      '/change',
      {
        file: 'layout.json',
        was: 'S',
        ops: [{ path: [1], value: { room: 'loft', x: 2, y: 0, z: 0 } }],
      },
    ],
  ]);
  posts = [];
  await tap(1, 1); // Move… ended with its write
  assert.deepEqual(posts, []);
});

test('an unplaced room selected from its strip goes to the tapped cell; a placed one does not move on a tap', async () => {
  await press('cellar');
  posts = [];
  await tap(-1, 0, 'onPointerCancel');
  await tap(-1, 0, ''); // a second finger lands and lifts: a pinch, no tap
  await tap(-1, 0, 'onPointerUp', 2);
  assert.deepEqual(posts, [], 'a cancelled pointer or a two-finger lift places nothing');
  ground().onPointerCancel({ nativeEvent: { pointerId: 1 } }); // the first finger goes too
  await tap(-1, 0);
  assert.deepEqual(posts, [
    [
      '/change',
      {
        file: 'layout.json',
        was: 'S',
        ops: [{ path: [3], value: { room: 'cellar', x: -1, y: 0, z: 0 } }],
      },
    ],
  ]);
  pick('hall');
  posts = [];
  await tap(1, 0);
  assert.deepEqual(posts, []);
});

test('Cancel and Esc leave Join… and Move… writing nothing', async () => {
  pick('hall');
  await press('Join…');
  await press('Cancel');
  posts = [];
  pick('yard');
  await settle();
  assert.deepEqual(posts, []);
  assert.equal(bar(), 'yard — selected', 'a tap after Cancel selects');
  await press('Move…');
  const g = sheet().find((e) => e.props?.onLayout);
  (g.ref ?? g.props.ref)({ addEventListener() {} }); // the ground mounts: Esc listens
  keys.forEach((k) => k({ key: 'Escape' }));
  await tap(1, 0);
  assert.deepEqual(posts, []);
  assert.equal(bar(), 'yard — selected');
});

test('Undo pressed while a gesture still runs keeps the chip; a refused put-back says so on the strip', async () => {
  pick('hall');
  await press('New room east');
  pick('hall');
  await press('Join…');
  pick('hall'); // a refusal, still running when Undo is pressed
  named(strip(), 'Undo').props.onPress();
  await settle();
  refuse = 'Hold on';
  await press('Undo', strip());
  refuse = '';
  await roomedit.run(async () => {}); // wrote nothing: no chip
  assert.equal(named(strip(), 'Undo'), undefined);
  const said = strip()
    .filter((e) => e.type === 'Text')
    .map((e) => e.props.children);
  assert.ok(said.includes('put back stopped: Hold on'), String(said));
});
