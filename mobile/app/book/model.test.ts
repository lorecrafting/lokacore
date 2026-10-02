// Ferry Landing as the items fixture (protocol/fixtures/cartridge_items_hash.json) offers it: look
// and scan on the place, an exit north, and take on the leather satchel (ids here are stand-ins;
// the controller draws real ones). Literal answers, not computed from the code under test.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { group, plain, said, type Pool } from './model.ts';

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

// Breaks: a pending choice's answers or its Close also filed as place actions, so the room page
// draws them twice (once under the choice, once among the place's actions).
test("a choice's answers and Close are their own group, not place actions", () => {
  const g = group([
    b("Offer to fetch Bram's lantern", 'lantern'),
    b('Carry it along the bank', 'choose', [], { choice_id: 'carry', continuation_id: 'c-1' }),
    b('Close', 'close_choice'),
  ]);
  assert.deepEqual(
    g.choice.map((x) => x.label),
    ['Carry it along the bank', 'Close'],
  );
  assert.deepEqual(
    g.place.map((x) => x.label),
    ["Offer to fetch Bram's lantern"],
  );
});

// Breaks: the status line's character label without the hp band, or with a band on ma too (the
// owner's bands decision: the phrase on hp only). Two pools as GameView carries them.
test('the character label says the hp band and no other', () => {
  const pool = (key: string, current: number, maximum: number, band: Pool['band']) =>
    ({ resource: { key }, current, maximum, band }) as Pool;
  assert.equal(
    said([pool('hp', 20, 20, 'perfect_health'), pool('ma', 100, 100, 'perfect_health')]),
    'Character, hp 20 of 20, perfect health, ma 100 of 100',
  );
});
