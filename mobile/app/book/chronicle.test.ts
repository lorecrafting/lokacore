// Toolbox row FD6, the Chronicle through the real authority and Book (book-ui.md, Chronicle details).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { LABEL } from './labels.ts';

const bundle = compiled('cartridges/recap_sampler');
const TICK = 'The poison burns in your veins.';
const DART = 'A dart pricks your arm. Cold spreads from the wound.';
const CHILL = 'A chill runs through you.';
const HOURS3 = 3 * 3600 * 1000; // 150 game hours at rate 50: from 07:00 on day 1 to 13:00 on day 7
let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`;
const rows = (b: ReturnType<typeof book>) =>
  b.sql
    .prepare('SELECT (SELECT count(*) FROM state_row) s, (SELECT count(*) FROM receipt) r')
    .get();

// Poisoned and chilled on day 1 (eleven ticks: recap.test.ts), three real hours away, then the dart
// again on day 7; a hand-built milestone receipt repeats the tick line on day 7.
function journal() {
  const b = book(bundle as never, undefined, ids);
  for (const d of ['east', 'west']) (b.map(), b.tap(`Go ${d}`));
  b.clock.wall += HOURS3;
  b.clock.mono += HOURS3;
  const pulse = () => (b.game as unknown as { pulse(): { kind: string } }).pulse().kind;
  for (let i = 0; pulse() === 'catching_up'; i++) assert.ok(i < 100, 'never settled');
  b.map();
  b.tap('Go east');
  b.sql
    .prepare(
      `INSERT INTO receipt SELECT scope, 'milestone', 'milestone', actor_id, intent_digest_version,
       intent_digest, command, 999, ? FROM receipt LIMIT 1`,
    )
    .run(
      JSON.stringify({
        kind: 'accepted',
        outcome: 'waited',
        delta: { ops: [] },
        events: [{ payload: { type: 'story_point_reached' } }],
        narration: [{ key: 'narration.poison.tick' }],
      }),
    );
  const before = rows(b);
  b.tap(CONTENTS);
  b.tap('Journal');
  assert.deepEqual(rows(b), before); // opening the Journal writes nothing
  return b;
}
const after = (shown: string[], from: string, to?: string) =>
  shown.slice(shown.indexOf(from) + 1, to ? shown.indexOf(to) : undefined);

// Breaks: days merge (day 7's dart counted with day 1's), out of order, or the wrong day opens;
// a milestone is marked on another day's same line; a count or first-seen order is wrong.
test('the Chronicle: days ascending, the latest open, each day grouped; a milestone in ink', () => {
  const b = journal();
  let shown = b.text();
  assert.deepEqual(after(shown, LABEL.chronicle, 'Back to World'), [
    'Day 1',
    'Day 7',
    DART,
    CHILL,
    TICK,
  ]);
  b.tap('Day 1, show');
  shown = b.text();
  assert.deepEqual(after(shown, 'Day 1', 'Day 7'), [
    DART,
    CHILL,
    `${TICK} (11 times)`,
    'You shiver.',
    'The chill passes.',
    'The poison fades from your blood.',
  ]);
  const color = (line: string) =>
    b.draw().find((x) => x.type === 'Text' && x.props.children === line && x.props.style.color)
      ?.props.style.color;
  const ink = b
    .draw()
    .find((x) => x.props?.accessibilityRole === 'header' && x.props.children === LABEL.chronicle)
    .props.style.color;
  assert.equal(color(TICK), ink); // day 7's milestone line
  assert.notEqual(color(`${TICK} (11 times)`), ink); // day 1's ticks: no story point there
  assert.notEqual(color(DART), ink);
});

// Break: a story without narration shows an empty Chronicle heading or loses the empty-Journal note.
test('a fresh story has no Chronicle and still says Nothing written yet', () => {
  const b = book(bundle as never, undefined, ids);
  b.tap(CONTENTS);
  b.tap('Journal');
  const shown = b.text();
  assert.ok(shown.includes('Nothing written yet.'));
  assert.ok(!shown.includes(LABEL.chronicle));
});
