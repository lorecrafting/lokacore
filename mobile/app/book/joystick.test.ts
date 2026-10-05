// Literal answers: the angles are worked by hand (clockwise from north, y grows downward).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openGame } from '../../authority/local-story/session.ts';
import { gesture, pick, sideOf, ZOOM } from './joystick.ts';
import { presenter } from './presenter.ts';

// Breaks: sectors off by one (east lit for a north drag, or a wrong quadrant edge), a quadrant
// that is too narrow (a drag 30 degrees off north does nothing), a non-existent exit lit.
test('a drag points at the exit in its 90-degree quadrant, only if that exit exists', () => {
  assert.equal(pick(0, -10, ['north', 'east']), 'north');
  assert.equal(pick(5.8, -10, ['north']), 'north'); // 30 degrees from north
  assert.equal(pick(9.4, -3.4, ['north', 'east']), 'east'); // 70 degrees
  assert.equal(pick(9.4, -3.4, ['north']), null); // the east quadrant, no east exit
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
// Breaks (U6): a label on the dragged side, under the finger: each lit exit's label goes opposite
// it (hand-set table); a note kept after release stays above.
test('the label sits opposite the drag, and above for a kept note', () => {
  const rows = [
    ['north', 'below'],
    ['south', 'above'],
    ['east', 'left'],
    ['west', 'right'],
    ['up', 'below'],
    ['down', 'above'],
    [null, 'above'],
  ] as const;
  assert.deepEqual(
    rows.map(([lit]) => sideOf(lit)),
    rows.map(([, side]) => side),
  );
});

test('stair nodes are reached by dragging out to them, only when the exit exists', () => {
  assert.equal(pick(31, -9, ['up', 'east']), 'up');
  assert.equal(pick(31, 9, ['down', 'east']), 'down');
  assert.equal(pick(31, -9, ['east']), 'east'); // no up exit: the drag is just east
  assert.equal(pick(31, 9, ['up']), null); // the down node is not the up node
  assert.equal(pick(31, -3.4, ['up']), null); // 5.6 from the node: outside the hit radius
});

// Breaks: a newly opened choice is ignored while refreshing a drag's token, or release reads
// the new footer's button instead of retaining the action/context from grant. Real SQLite.
// Elapsed-only redraw success is proved separately in live_actions.test.ts.
const LANTERN = '../../../protocol/fixtures/cartridge_lantern_hash.json';
function lantern() {
  type P = (string | number | null)[];
  const sql = new DatabaseSync(':memory:');
  const smoke = presenter(
    openGame(
      {
        execSync: (s) => void sql.exec(s),
        isInTransactionSync: () => sql.isTransaction,
        runSync: (s, ...p: P) => sql.prepare(s).run(...p),
        getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T | null,
        getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
      },
      JSON.parse(readFileSync(new URL(LANTERN, import.meta.url), 'utf8')),
      { newId: randomUUID, kernel_version: `loka-kernel@${'0'.repeat(40)}` },
    ),
  );
  return { sql, smoke };
}
test('a choice opened during a drag keeps the original context stale and commits no move', () => {
  const { sql, smoke } = lantern();
  const props = (s = smoke.screen()) => ({
    exits: s.view.exits,
    go: (d: string) =>
      smoke.press(s.buttons.find((b) => (b.input as { direction?: string }).direction === d)!),
  });
  const now = { current: props() };
  const nothing = () => {};
  const g = gesture({
    now,
    walk: (d, at) => d && at.go(d),
    openMap: () => assert.fail('a drag is no tap'),
    setLit: nothing,
    setNote: nothing,
    zoom: nothing,
    knob: nothing,
  });
  g.onPanResponderGrant();
  smoke.press(smoke.screen().buttons.find((b) => b.action_key === 'bram_offer')!); // revision 1
  now.current = props(); // the redraw
  g.onPanResponderMove(null, { dx: 0, dy: -20 * ZOOM }); // toward north
  g.onPanResponderRelease();
  assert.equal(smoke.screen().log.at(-1), 'The page had changed; here it is again.');
  assert.equal(sql.prepare('SELECT revision FROM head').get()!.revision, 1);
});

// Breaks (R6P-A04): the line of a drag toward a closed exit (Book's refused pushes it onto the
// smoke's log) outside the log's cap, so such drags grow the log without bound.
test('refused drags do not grow the log without bound', () => {
  const { smoke } = lantern();
  const drags = () => {
    for (let i = 0; i < 300; i++) smoke.screen().log.push("You can't go that way.");
    return smoke.screen().log.length;
  };
  assert.equal(drags(), drags());
});
