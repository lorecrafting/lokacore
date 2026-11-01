// A way newly open in the Footer's map dries in (book-ui.md, Lever and latch).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, rig } from './__tests__/hook-rig.ts';
import './__tests__/polish-book.test.ts'; // the Book's loader and stubs

const { MapDrawing } = await import('./MapDrawing.tsx');

const way = (direction: string, available = true) => ({ direction, available }) as never;

// Breaks: a way opened in the room just appears, every way of a new room or a first view dries, a
// redraw cuts the drying short, or a way shut again keeps its old drying.
test('only a way newly open in this room dries in', (t) => {
  effects(t);
  const draw = rig(t);
  const drying = (room: string, ...exits: never[]) =>
    draw(() =>
      (MapDrawing as any)({
        room,
        exits,
        lit: null,
        zoom: { interpolate: () => 1 },
        knob: { x: 0, y: 0 },
      }),
    )
      .props.children[1].filter((e: any) => e.type.name === 'Dry')
      .map((e: any) => e.key);
  assert.deepEqual(drying('a', way('north'), way('east', false)), [], 'a first view');
  assert.deepEqual(drying('a', way('north'), way('east')), ['east'], 'a door opened');
  assert.deepEqual(drying('a', way('north'), way('east')), ['east'], 'a redraw');
  assert.deepEqual(drying('a', way('north'), way('east'), way('west')), ['east', 'west']);
  assert.deepEqual(drying('a', way('north'), way('east', false), way('west')), ['west'], 'shut');
  assert.deepEqual(drying('b', way('south')), [], 'a new room');
  assert.deepEqual(drying('b', way('up', true), way('south')), [], 'a stair stays with the zoom');
});
