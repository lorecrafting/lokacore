// Toolbox row FD6, the Chronicle through the real authority and Book (book-ui.md, Chronicle details).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { days } from './chronicle.ts';
import { LABEL } from './labels.ts';
import { type } from './tokens.ts';

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
// a milestone is marked on another day's same line; a count or first-seen order is wrong; the
// Journal still says Nothing written yet over a Chronicle.
test('the Chronicle: days ascending, the latest open, each day grouped; a milestone marked', () => {
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
  const style = (line: string) =>
    b.draw().find((x) => x.type === 'Text' && x.props.children === line)?.props;
  // Day 7's milestone line in body type, named as a story point; day 1's ticks (no story point
  // there) and the dart stay log lines.
  assert.deepEqual(
    [style(TICK), style(`${TICK} (11 times)`), style(DART)].map((x) => [
      x.style.fontSize,
      x.accessibilityLabel,
    ]),
    [
      [type.body.fontSize, `${TICK}, story point`],
      [type.log.fontSize, undefined],
      [type.log.fontSize, undefined],
    ],
  );
  assert.ok(!shown.includes('Nothing written yet.')); // a Chronicle day is something written
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

// Breaks: a routine engine line (a take) or a talk prompt enters the Chronicle beside the story's
// own line (PM ruling, loka-kgd.185: the Chronicle stays as before the narration log batch), or
// the filter shifts the combat indexes so a combat line shows and a story line goes.
test('a take and a talk prompt stay out of the Chronicle; the story line beside it stays in', () => {
  const view = { place: { title: { key: 't' } } } as never;
  const record = {
    command_id: 'c',
    lines: [
      { key: 'item.taken', bindings: { item: 'item.key.short' } },
      { key: 'dialogue.bram.prompt' },
      { key: 'narration.x' },
      { key: 'combat.hit' },
    ],
    combat_lines: [3],
  };
  const shown = days([{ day: 1, record, milestone: false } as never], view, (k) => k);
  assert.deepEqual(
    shown.map((d) => d.lines),
    [[{ line: 'narration.x', count: 1 }]],
  );
});
