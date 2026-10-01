// Literal answers: the angles are worked by hand (clockwise from north, y grows downward).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pick } from './joystick.ts';

// Breaks: sectors off by one (east lit for a north drag, or the wrong 45-degree edge), a diagonal
// drag walking to a cardinal exit when its own sector has none, a non-existent exit lit.
test('a drag points at the exit in its 45-degree sector, only if that exit exists', () => {
  const both = ['north', 'northeast'];
  assert.equal(pick(0, -10, both), 'north');
  assert.equal(pick(3.42, -9.4, both), 'north'); // 20 degrees from north
  assert.equal(pick(4.23, -9.06, both), 'northeast'); // 25 degrees
  assert.equal(pick(7, -7, ['north', 'east']), null); // northeast sector, no such exit
  assert.equal(pick(-10, 0, ['west']), 'west');
  assert.equal(pick(0, 10, ['north']), null);
});

// Breaks: the cancel radius gone or moved (a stray press near the middle walks, or dragging back
// to the middle still walks).
test('a drag inside the cancel radius points at nothing', () => {
  assert.equal(pick(0, -5.9, ['north']), null);
  assert.equal(pick(0, -6.1, ['north']), 'north');
  assert.equal(pick(0, 0, ['north']), null);
});

// Breaks: stair nodes drawn or hit when the exit is absent, up and down swapped, or a drag to the
// stairs falling through to the east exit it passes.
test('stair nodes are reached by dragging out to them, only when the exit exists', () => {
  assert.equal(pick(31, -9, ['up', 'east']), 'up');
  assert.equal(pick(31, 9, ['down', 'east']), 'down');
  assert.equal(pick(31, -9, ['east']), 'east'); // no up exit: the drag is just east
  assert.equal(pick(31, 9, ['up']), null); // the down node is not the up node
  assert.equal(pick(31, -3.4, ['up']), null); // 5.6 from the node: outside the hit radius
});
