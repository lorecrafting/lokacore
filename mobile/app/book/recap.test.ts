// Toolbox row W27, the away recap through the real authority and Book (book-ui.md, Away recap).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';
import { resetLogs, type Logs } from './logs.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { settle } from './recap.ts';

const bundle = compiled('cartridges/recap_sampler');
const TICK = 'The poison burns in your veins.';
const ROOM = 'A bare hall of grey stone. A doorway opens east; a door leads north to the garden.';

const HOURS3 = 3 * 3600 * 1000; // 150 game hours at rate 50
type Book = ReturnType<typeof book>;
const pulse = (b: Book) => (b.game as unknown as { pulse(): { kind: string } }).pulse();
// `ms` of real time passes; pulses until time stops catching up.
function wait(b: Book, ms: number) {
  b.clock.wall += ms;
  b.clock.mono += ms;
  for (let n = 0; pulse(b).kind === 'catching_up'; n++) assert.ok(n < 100, 'never settled');
  return b;
}
// Poisoned in the dart room (duration 720 s, a tick every 60 s strictly before the end: eleven
// ticks, mechanics.md row 1) and chilled (120 s: one tick, sharing a receipt with the first poison
// tick; it passes with the second), back in the hall with Maud.
// Status instance ids order a receipt's lines, so they are fixed here.
const ids =
  (n = 0) =>
  () =>
    `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`;
function poisoned() {
  const b = book(bundle as never, undefined, ids());
  for (const d of ['east', 'west']) (b.map(), b.tap(`Go ${d}`));
  return b;
}
const away = (ms: number) => wait(poisoned(), ms);
const count = (lines: string[], line: string) => lines.filter((l) => l === line).length;

// Breaks: the settlement's lines go to the log one by one (no grouping or threshold); the block is
// drawn below the room instead of opening the page; counts or first-seen order are wrong; a press
// keeps the recap.
test('a three-hour absence opens the page with one collapsed recap, counts by line', () => {
  const b = away(HOURS3); // from 07:00: six evenings (she leaves) and six mornings (she arrives)
  let shown = b.text();
  assert.equal(count(shown, LABEL.awayRecap), 1);
  assert.equal(count(shown, TICK), 0); // collapsed, and not in the log either
  assert.ok(shown.indexOf(LABEL.awayRecap) < shown.indexOf(ROOM));
  assert.ok(!shown.some((l) => l.includes('poisoned'))); // the status line shows the present
  b.tap(`${LABEL.awayRecap}, show`);
  shown = b.text();
  const block = shown.slice(shown.indexOf(LABEL.awayRecap) + 1, shown.indexOf(ROOM));
  assert.deepEqual(block, [
    `${TICK} (11 times)`,
    'You shiver.',
    'The chill passes.',
    'The poison fades from your blood.',
    'Maud leaves. (6 times)',
    'Maud arrives. (6 times)',
  ]);
  b.map();
  b.tap('Go north');
  assert.equal(count(b.text(), LABEL.awayRecap), 0);
});

// Breaks: the threshold check passes every settlement, so a short absence also collapses; with the
// field authored, a receipt's lines log one by one instead of as the one entry they make without it
// (the expected log is the same absence's with `recap_after_minutes` removed).
test('a two-minute absence shows no recap: its log is as without the field', () => {
  const shown = away(2 * 60 * 1000).text();
  assert.equal(count(shown, LABEL.awayRecap), 0);
  const log = shown.slice(
    shown.indexOf(ROOM) + 3,
    shown.indexOf('The poison fades from your blood.'),
  );
  assert.deepEqual(log, [
    `${TICK} You shiver.`,
    `${TICK} The chill passes.`,
    ...Array<string>(9).fill(TICK),
  ]);
});

// Break: a second absence before any press replaces the first one's recap, losing its lines.
test('a second long absence before a press adds its lines to the same recap', () => {
  const b = wait(away(HOURS3), HOURS3); // to 19:00 on day 12: thirteen evenings, twelve mornings
  b.tap(`${LABEL.awayRecap}, show`);
  const shown = b.text();
  assert.equal(count(shown, LABEL.awayRecap), 1);
  assert.ok(
    shown.includes('Maud leaves. (13 times)') && shown.includes('Maud arrives. (12 times)'),
  );
});

// Breaks: a press while time still catches up leaves the settlement held, so a recap appears after
// the press (which must remove it) in the room the press moved to.
test('a press during catch-up ends the recap', () => {
  const b = poisoned();
  b.clock.wall += HOURS3;
  b.clock.mono += HOURS3;
  assert.equal(pulse(b).kind, 'catching_up');
  b.map();
  b.tap('Go north');
  wait(b, 0);
  assert.equal(count(b.text(), LABEL.awayRecap), 0);
  assert.equal(count(b.text(), 'Garden'), 1);
});

// Breaks: a press in place during catch-up drops the held lines (in neither the log nor a recap) or
// logs them out of order.
test('a press in place during catch-up logs the held lines in order', () => {
  const b = poisoned();
  b.clock.wall += HOURS3;
  b.clock.mono += HOURS3;
  assert.equal(pulse(b).kind, 'catching_up');
  b.tap('Stone Hall, look'); // Look adds no World line of its own in this sampler
  const shown = wait(b, 0).text();
  assert.equal(count(shown, LABEL.awayRecap), 0);
  const log = shown.slice(shown.indexOf(ROOM) + 3);
  assert.deepEqual(log.slice(0, 15), [
    `${TICK} You shiver.`,
    `${TICK} The chill passes.`,
    ...Array<string>(9).fill(TICK),
    'The poison fades from your blood.',
    'Maud leaves.',
    'Maud arrives.',
    'Maud leaves.',
  ]);
});

// Breaks: the player moved without a press keeps the old room's held lines or recap.
test('a room change drops the held lines and the recap; staying keeps them', () => {
  const logs = () =>
    ({
      log: [],
      projection: { view: { place: { id: 'hall' } } },
      away: { from: 0, log: ['a'], lines: ['a'] },
      recap: ['b'],
    }) as unknown as Logs;
  const view = (id: string) => ({ place: { id } }) as GameView;
  const stay = logs();
  resetLogs(stay, view('hall'));
  assert.deepEqual([stay.away, stay.recap], [{ from: 0, log: ['a'], lines: ['a'] }, ['b']]);
  const moved = logs();
  resetLogs(moved, view('garden'));
  assert.deepEqual([moved.away, moved.recap], [{ from: 0, log: [], lines: [] }, undefined]);
});

// Breaks: a cold reopen catches up before the Book subscribes (the fonts gate its first draw), so
// the first steps never reach the presenter and the recap's counts start mid-settlement.
test('a cold reopen catches up once the Book has subscribed: the full recap', () => {
  const a = poisoned();
  a.unmount();
  a.clock.wall += HOURS3;
  a.clock.mono += HOURS3;
  const b = book(bundle as never, a as never, ids(100), () => wait(a, 0));
  b.tap(`${LABEL.awayRecap}, show`);
  const shown = b.text();
  assert.ok(shown.includes(`${TICK} (11 times)`) && shown.includes('Maud leaves. (6 times)'));
});

// Break: a settlement that ends in a save fault drops its held lines instead of logging them.
test('a settlement that ends without settling keeps its lines in the log', () => {
  const s = {
    log: [],
    status: { kind: 'pending' },
    projection: { view: { time: 99999, recap_after: 1 } },
    away: { from: 0, log: ['a', 'a'], lines: ['a', 'a'] },
  } as unknown as Logs;
  settle(s);
  assert.deepEqual([s.log, s.recap, s.away], [['a', 'a'], undefined, undefined]);
});
