// Ferry Landing as the items fixture (protocol/fixtures/cartridge_items_hash.json) offers it: look
// and scan on the place, an exit north, and take on the leather satchel (ids here are stand-ins;
// the controller draws real ones). Literal answers, not computed from the code under test.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  absent,
  branch,
  cap,
  ended,
  group,
  hint,
  menuOpen,
  plain,
  refused,
  said,
  type Pool,
  why,
} from './model.ts';

const b = (label: string, action_key: string, target_ids: string[] = [], input = {}) => ({
  label,
  action_key,
  target_ids,
  input,
});
const buttons = [
  b('look', 'look'),
  b('scan', 'scan'),
  b('wait', 'wait'),
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
    ['wait'], // scan has no button (DIFFERENCES 3); wait is an ordinary place action
  );
  assert.deepEqual(
    g.on('satchel-1').map((x) => x.label),
    ['take a leather satchel'],
  );
  assert.deepEqual(g.on('bram-1'), []);
});

// Breaks (U5): a pending choice restored after a restart that opens no menu (the player cannot see
// it), a dismissed one that stays open or that a new choice cannot reopen, a tapped NPC who left
// that keeps a menu open on nothing.
test('the NPC menu is open for a tapped NPC here and for a pending choice not dismissed', () => {
  const view = (choice?: string, here = true) =>
    ({
      entities: here ? [{ id: 'bram' }] : [],
      choice: choice && { continuation_id: choice, speaker_id: 'bram' },
    }) as never;
  assert.equal(menuOpen(view(), undefined), false);
  assert.equal(menuOpen(view(), 'bram'), true);
  assert.equal(menuOpen(view(undefined, false), 'bram'), false);
  assert.equal(menuOpen(view('c1'), undefined), true);
  assert.equal(menuOpen(view('c1', false), undefined), true); // walked away, still pending
  assert.equal(menuOpen(view('c1'), undefined, 'c1'), false);
  assert.equal(menuOpen(view('c2'), undefined, 'c1'), true);
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

// Breaks (notes 2, 17): the line keyed on the answers' not_present (a dropped lantern closes them
// while Bram is still here), or missing when the speaker has gone.
test('the absent-speaker line shows only when the speaker is not here', () => {
  const no = { available: false, reason: { code: 'not_present' } };
  const choice = { speaker_id: 'bram', choices: [{ choice_id: 'carry', ...no }] };
  const view = (ids: string[]) => ({ entities: ids.map((id) => ({ id })), choice }) as never;
  assert.equal(absent(view([])), 'They are not here to answer. Find them, or close this.');
  assert.equal(absent(view(['bram'])), '');
  const speakerless = { entities: [], choice: { choices: choice.choices } } as never;
  assert.equal(absent(speakerless), 'No one is here to answer.');
});

// Breaks (PM item: note 4's line): an ending shown before every quest is over, or with no quest.
test('the ending line shows once every quest is over', () => {
  const view = (...states: string[]) => ({ journal: states.map((state) => ({ state })) }) as never;
  assert.deepEqual(
    [ended(view()), ended(view('active')), ended(view('resolved', 'active'))],
    ['', '', ''],
  );
  assert.equal(ended(view('resolved')), 'The story ends here. Start over is in Settings.');
});

// Breaks (notes 6, 14): a refusal line with the raw code ("exit locked"), a cartridge's own reason
// sentence wrapped in the frame ("The way east is The causeway is flooded.."), or a title cased wrong.
test("a closed exit's log line and a capitalised title", () => {
  const west = { available: false, direction: 'west', reason: { code: 'exit_locked' } } as never;
  assert.equal(
    refused(west, (k) => k),
    'The way west is locked.',
  );
  const flooded = { key: 'The causeway is flooded.' };
  const east = {
    available: false,
    direction: 'east',
    reason: { code: 'exit_locked', message: flooded },
  };
  assert.equal(
    refused(east as never, (k) => k),
    'The causeway is flooded.',
  );
  assert.equal(cap('a brass lantern'), 'A brass lantern');
});

// Breaks (owner note, 0 MV): a move refused for want of MV logs its raw code ("The way north is
// insufficient resource.") or wraps its own sentence in the frame; the exit's note shows the code.
test('a move refused at 0 MV says the body is too exhausted', () => {
  const north = { available: false, direction: 'north', reason: { code: 'insufficient_resource' } };
  assert.equal(
    refused(north as never, (k) => k),
    'You are too exhausted.',
  );
  assert.equal(
    why(north as never, (k) => k),
    'too exhausted',
  );
});

// Breaks (review POL-2): a hint store that throws (an unreadable key-value file) takes the book or
// the Look tap down with it, instead of the hint falling back to this session's memory.
test('a hint survives a store that throws, for this session', () => {
  const broken = {
    getItemSync: (): string | null => {
      throw new Error('disk I/O error');
    },
    setItemSync: () => {
      throw new Error('disk I/O error');
    },
  };
  const h = hint(broken, 'hint.learned');
  assert.equal(h.seen(), false);
  h.see();
  assert.equal(h.seen(), true);
});

// Breaks (owner decision, untimed Lantern record): branches on even hours (子 from 00:00), a
// boundary a minute off, the day not wrapped, or a glyph, animal or hour swapped in the tables.
test('the status line shows the double hour as its earthly branch', () => {
  const rows: [number, string, string][] = [
    [23, '子', 'Hour of the Rat, eleven to one'],
    [1, '丑', 'Hour of the Ox, one to three'],
    [3, '寅', 'Hour of the Tiger, three to five'],
    [5, '卯', 'Hour of the Rabbit, five to seven'],
    [7, '辰', 'Hour of the Dragon, seven to nine'],
    [9, '巳', 'Hour of the Snake, nine to eleven'],
    [11, '午', 'Hour of the Horse, eleven to one'],
    [13, '未', 'Hour of the Goat, one to three'],
    [15, '申', 'Hour of the Monkey, three to five'],
    [17, '酉', 'Hour of the Rooster, five to seven'],
    [19, '戌', 'Hour of the Dog, seven to nine'],
    [21, '亥', 'Hour of the Pig, nine to eleven'],
  ];
  for (const [h, glyph, label] of rows) assert.deepEqual(branch(h * 3600), { glyph, label });
  const at = (h: number, m = 0) => branch(h * 3600 + m * 60).glyph;
  assert.deepEqual(
    [at(22, 59), at(23), at(0, 59), at(1), at(24 + 6)],
    ['亥', '子', '子', '丑', '卯'],
  );
});
