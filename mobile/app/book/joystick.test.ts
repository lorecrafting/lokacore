// Literal answers: the angles are worked by hand (clockwise from north, y grows downward).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openSmoke } from '../../authority/local-story/smoke.ts';
import { gesture, pick, ZOOM } from './joystick.ts';

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
test('stair nodes are reached by dragging out to them, only when the exit exists', () => {
  assert.equal(pick(31, -9, ['up', 'east']), 'up');
  assert.equal(pick(31, 9, ['down', 'east']), 'down');
  assert.equal(pick(31, -9, ['east']), 'east'); // no up exit: the drag is just east
  assert.equal(pick(31, 9, ['up']), null); // the down node is not the up node
  assert.equal(pick(31, -3.4, ['up']), null); // 5.6 from the node: outside the hit radius
});

// Breaks (04 §16): a release that walks on the footer's props now shown (read at release) rather
// than those the drag began on, so a redraw during the drag turns it into a press on the new screen
// and commits. The Lantern on real SQLite; Book's walk presses that screen's move button.
const LANTERN = '../../../protocol/fixtures/cartridge_lantern_hash.json';
test('a drag begun before a redraw walks on its own screen: stale_view, no commit', () => {
  type P = (string | number | null)[];
  const sql = new DatabaseSync(':memory:');
  const smoke = openSmoke(
    {
      execSync: (s) => void sql.exec(s),
      isInTransactionSync: () => sql.isTransaction,
      runSync: (s, ...p: P) => sql.prepare(s).run(...p),
      getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T | null,
      getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
    },
    JSON.parse(readFileSync(new URL(LANTERN, import.meta.url), 'utf8')),
    randomUUID,
  );
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
  smoke.press(smoke.screen().buttons.find((b) => b.action_key === 'lantern')!); // accept: revision 1
  now.current = props(); // the redraw
  g.onPanResponderMove(null, { dx: 0, dy: -20 * ZOOM }); // toward north
  g.onPanResponderRelease();
  assert.equal(smoke.screen().log.at(-1), 'The page had changed; here it is again.');
  assert.equal(sql.prepare('SELECT revision FROM head').get()!.revision, 1);
});
