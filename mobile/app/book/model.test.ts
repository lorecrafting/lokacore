// Ferry Landing as the items fixture (protocol/fixtures/cartridge_items_hash.json) offers it: look
// and scan on the place, an exit north, and take on the leather satchel (ids here are stand-ins;
// the controller draws real ones). Literal answers, not computed from the code under test.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { group, plain } from './model.ts';

const b = (label: string, action_key: string, target_ids: string[] = [], input = {}) => ({
  label,
  action_key,
  target_ids,
  input,
});
const buttons = [
  b('look', 'look'),
  b('scan', 'scan'),
  b('Go north', 'move', [], { direction: 'north' }),
  b('take a leather satchel', 'take', ['satchel-1']),
];

// Breaks: a move filed as a place action (a "north" that is no exit), a take filed on the place
// instead of its item (the satchel page lists nothing), or look listed as an ordinary action
// (the title and the footer both offer it).
test('exits, the look title, place actions and a thing page come from the right buttons', () => {
  const g = group(buttons);
  assert.equal(g.look?.label, 'look');
  assert.deepEqual(
    g.exits.map((e) => [e.direction, e.button.label]),
    [['north', 'Go north']],
  );
  assert.deepEqual(
    g.place.map((x) => x.label),
    ['scan'],
  );
  assert.deepEqual(
    g.on('satchel-1').map((x) => x.label),
    ['take a leather satchel'],
  );
  assert.deepEqual(g.on('bram-1'), []);
});

// Breaks: raw link syntax shown (Ferry Landing's "[mooring post](mooring_post)"), or a greedy
// pattern that swallows the text between two links.
test('a touch link is shown as its label', () => {
  assert.equal(
    plain('A [mooring post](mooring_post) leans by a [reed](reed_bed) in the current.'),
    'A mooring post leans by a reed in the current.',
  );
});
