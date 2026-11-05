// The editor map's rules (tools/author-panel/src/map.ts): expected values worked by hand from the
// E3a table (docs/design/editor-map-and-story-rulings.md), not from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MapRoom } from '../../../tools/author-panel/src/map.ts';
import * as map from '../../../tools/author-panel/src/map.ts';
import { places } from '../../../tools/author-panel/src/shell.ts';

const room = (key: string, area: string | null, at?: MapRoom['at'], exits: MapRoom['exits'] = []) =>
  ({
    ref: `demo@1:room/${key}`,
    key,
    file: `areas/${area}/${key}.json`,
    area,
    title: key.toUpperCase(),
    exits,
    at,
  }) as MapRoom;
const A = room('a', 'north', { x: 0, y: 0, z: 0 }, [
  { dir: 'east', to: 'b' },
  { dir: 'up', to: 'c' },
]);
const B = room('b', 'north', { x: 1, y: 0, z: 0 }, [
  { dir: 'west', to: 'a', barrier: 'gate' },
  { dir: 'south', to: 'd', hidden: true },
]);
const D = room('d', 'south', { x: 1, y: 1, z: 0 });
const C = room('c', 'north', { x: 0, y: 0, z: 1 }, [{ dir: 'down', to: 'a' }]);
const U = room('u', null);
const ROOMS = [D, C, U, B, A];
const LEVEL0 = map.onLevel(ROOMS, 0);
// Break: rooms of one area ordered by input, not key.
for (const order of [
  [B, A],
  [A, B],
])
  assert.deepEqual(
    map.onLevel(order, 0).map((r) => r.key),
    ['a', 'b'],
  );

// Breaks: selecting a room on another level leaves the map on the old one, or an unplaced room
// throws the map to a missing level (the level-switch red control).
test('selecting a room shows its level; an unplaced or unknown key keeps the one shown', () => {
  assert.deepEqual(map.levels(ROOMS), [0, 1]);
  assert.equal(map.levelOf(ROOMS, 'c', 0), 1);
  assert.equal(map.levelOf(ROOMS, 'u', 1), 1);
  assert.equal(map.levelOf(ROOMS, 'zz', 0), 0);
});

// Breaks: a map click selects something the hierarchy and Book cannot find (the selection-sync
// red control: a wrong kind, or the ref where the key belongs).
test('a room click is the selection the hierarchy and the Book show', () => {
  const sel = map.select(B);
  assert.deepEqual(sel, { file: 'areas/north/b.json', kind: 'room', key: 'b' });
  const p = places(
    sel,
    [A, B].map((r) => ({ ref: r.ref, kind: 'room' })),
  );
  assert.equal(p.hierarchy, 'demo@1:room/b');
  assert.equal(p.map, 'demo@1:room/b');
});

// Breaks: a reciprocal pair draws twice, a one-way loses its arrow, a barrier set on the far side
// or a hidden exit is lost, or up/down draw as lines.
test('one line per reciprocal pair, one-way, barrier and hidden marked, up and down left out', () => {
  assert.deepEqual(
    LEVEL0.map((r) => r.key),
    ['a', 'b', 'd'],
  );
  assert.deepEqual(map.edges(LEVEL0), [
    { from: 'a', to: 'b', oneWay: false, barrier: 'gate', hidden: false },
    { from: 'b', to: 'd', oneWay: true, barrier: undefined, hidden: true },
  ]);
  // Break: an off-level or self exit, a vertical exit between rooms on the level, or a far side's
  // only way back being vertical drawn as a line; two one-way exits to one room drawn twice.
  const x = room('x', null, { x: 0, y: 0, z: 0 }, [
    { dir: 'east', to: 'y' },
    { dir: 'in', to: 'y' },
    { dir: 'west', to: 'x' },
    { dir: 'north', to: 'c' },
    { dir: 'up', to: 'z' },
  ]);
  const y = room('y', null, { x: 1, y: 0, z: 0 }, [
    { dir: 'south', to: 'z' },
    { dir: 'down', to: 'x' },
  ]);
  const z = room('z', null, { x: 1, y: 1, z: 0 });
  assert.deepEqual(map.edges([x, y, z]), [
    { from: 'x', to: 'y', oneWay: true, barrier: undefined, hidden: false },
    { from: 'y', to: 'z', oneWay: true, barrier: undefined, hidden: false },
  ]);
});

// Breaks: rooms are not 64 px apart, a hull is not padded 12 px past its rooms, or the seventh area
// reuses the first hue without a dash.
test('one hull per area on the level, padded, hue by area index, dashed from the seventh', () => {
  assert.deepEqual(map.hulls(LEVEL0, map.areas(ROOMS)), [
    { area: 'north', x: -4, y: 8, w: 136, h: 48, hue: 1, dashed: false },
    { area: 'south', x: 60, y: 72, w: 72, h: 48, hue: 2, dashed: false },
  ]);
  const seven = [0, 1, 2, 3, 4, 5, 6].map((i) => room(`k${i}`, `z${i}`, { x: i, y: 0, z: 0 }));
  const h = map.hulls(seven, map.areas(seven));
  assert.deepEqual([h[5].hue, h[5].dashed, h[6].hue, h[6].dashed], [6, false, 1, true]);
  // an area with no room on the level draws no hull and keeps its hue's place
  assert.deepEqual(map.hulls(map.onLevel(ROOMS, 1), ['a_empty', 'north']), [
    { area: 'north', x: -4, y: 8, w: 72, h: 48, hue: 2, dashed: false },
  ]);
});

// Breaks: labels show below zoom 1, the clip ignores the zoom or overflows the box, or a marked
// room loses its full-key pill.
test('labels: the key clipped to its box from zoom 1, none below', () => {
  assert.deepEqual(map.label('hut', 1), { text: 'hut' });
  assert.deepEqual(map.label('cells', 1), { text: 'cells' }); // exactly the five that fit
  assert.deepEqual(map.label('village_green', 1), { text: 'vill…' });
  assert.deepEqual(map.label('village_green', 2), { text: 'village_gre…' });
  assert.equal(map.label('village_green', 0.5), undefined);
});

// Breaks: fit leaves the level off-centre or past the zoom limits, keep lets the level leave the
// view, a cursor zoom drifts the point under the cursor, or follow-here moves a visible room.
test('the view: fit, keep one cell in, zoom about the cursor, show an off-screen room', () => {
  const b = map.bounds(LEVEL0);
  assert.deepEqual(map.fit(b, { w: 256, h: 128 }), { zoom: 1, x: 64, y: 0 });
  assert.deepEqual(map.fit(b, { w: 2000, h: 2000 }), { zoom: 3, x: 808, y: 808 });
  assert.equal(map.fit(b, { w: 16, h: 16 }).zoom, 0.25);
  assert.deepEqual(map.keep({ zoom: 1, x: 500, y: -1000 }, b, { w: 256, h: 128 }), {
    zoom: 1,
    x: 192,
    y: -64,
  });
  assert.deepEqual(map.zoomAt({ zoom: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 }), {
    zoom: 2,
    x: -100,
    y: -50,
  });
  assert.deepEqual(map.zoomAt({ zoom: 3, x: 0, y: 0 }, 1.25, { x: 9, y: 9 }), {
    zoom: 3,
    x: 0,
    y: 0,
  });
  const v = { zoom: 1, x: 0, y: 0 };
  assert.equal(map.show(v, { w: 256, h: 128 }, { x: 1, y: 1, z: 0 }), v);
  // a centre on any edge is on screen; off only past the right, or only past the bottom, is not
  const edge = { zoom: 1, x: -32, y: -32 };
  assert.equal(map.show(edge, { w: 256, h: 128 }, { x: 0, y: 0, z: 0 }), edge);
  assert.equal(map.show(edge, { w: 256, h: 128 }, { x: 4, y: 2, z: 0 }), edge);
  assert.notEqual(map.show(edge, { w: 256, h: 128 }, { x: 5, y: 0, z: 0 }), edge);
  assert.notEqual(map.show(edge, { w: 256, h: 128 }, { x: 0, y: 3, z: 0 }), edge);
  assert.deepEqual(map.show(v, { w: 256, h: 128 }, { x: 5, y: 5, z: 0 }), {
    zoom: 1,
    x: -224,
    y: -288,
  });
});

// Breaks: an arrow picks a farther room, one outside 45°, misses one on the 45° line, or breaks a
// tie differently from one press to the next.
test('arrow keys: the nearest room within 45°, ties by key', () => {
  assert.equal(map.nearest(LEVEL0, A, 'ArrowRight')?.key, 'b');
  assert.equal(map.nearest(LEVEL0, A, 'ArrowDown')?.key, 'd');
  assert.equal(map.nearest(LEVEL0, A, 'ArrowLeft'), undefined);
  const o = room('o', null, { x: 0, y: 0, z: 0 });
  const tie = [o, room('q', null, { x: 1, y: 1, z: 0 }), room('p', null, { x: 1, y: -1, z: 0 })];
  assert.equal(map.nearest(tie, o, 'ArrowRight')?.key, 'p');
  assert.equal(map.nearest([o, tie[2], tie[1]], o, 'ArrowRight')?.key, 'p');
  const near = room('zz', null, { x: 1, y: 0, z: 0 });
  assert.equal(
    map.nearest([o, room('b2', null, { x: 2, y: 0, z: 0 }), near], o, 'ArrowRight'),
    near,
  );
  // Break: a direction turned the wrong way, or its cone widened past 45°.
  const steep = room('s', null, { x: -1, y: -2, z: 0 });
  assert.equal(map.nearest([o, steep], o, 'ArrowLeft'), undefined);
  assert.equal(map.nearest([o, steep], o, 'ArrowUp'), steep);
  assert.equal(map.nearest([o, room('w', null, { x: 1, y: -1, z: 0 })], o, 'ArrowUp')?.key, 'w');
  assert.equal(map.nearest([o, room('r', null, { x: 1, y: 2, z: 0 })], o, 'ArrowRight'), undefined);
});

// Breaks: Tab enters on the wrong room.
test('Tab enters on the selected room, else here, else the first by key', () => {
  assert.equal(map.entry([D, B, A], 'b', 'd').key, 'b');
  assert.equal(map.entry([D, B, A], 'c', 'd').key, 'd');
  assert.equal(map.entry([D, B, A]).key, 'a');
});

// Breaks: a screen reader loses a room's exits or marks, or the footer shows a zero count.
test("a room's accessible name and the footer's counts", () => {
  assert.equal(
    map.name(B, { here: true, selected: true }),
    'b, B, north, level 0, exits: west to a, south to d, here, selected',
  );
  assert.equal(map.name(U, { unreached: true, locked: true }), 'u, U, unreached, behind a lock');
  assert.equal(
    map.footer(ROOMS, new Set([U.ref, D.ref]), new Set([C.ref])),
    '5 rooms · 2 areas · 2 unreached · 1 behind lock · 1 unplaced',
  );
  assert.equal(map.footer([A], new Set(), new Set()), '1 room · 1 area');
});
