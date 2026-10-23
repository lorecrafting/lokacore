// Toolbox row W27, the away recap through the real authority and Book (book-ui.md, Away recap).
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
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
  // The recap's lines are in ink, unlike its dim heading, and never a Chronicle story point.
  const line = (s: string) => b.draw().find((x) => x.type === 'Text' && x.props.children === s);
  assert.notEqual(line('You shiver.').props.style.color, line(LABEL.awayRecap).props.style.color);
  assert.equal(line('You shiver.').props.accessibilityLabel, undefined);
  b.map();
  b.tap('Go north');
  assert.equal(count(b.text(), LABEL.awayRecap), 0);
});

// Breaks: the threshold check passes every settlement, so a short absence also collapses; the log
// stays one line per record, as without the field (book-ui.md, Live action freshness; pass-1 UO).
test('a two-minute absence shows no recap: its log is as without the field', () => {
  const shown = away(2 * 60 * 1000).text();
  assert.equal(count(shown, LABEL.awayRecap), 0);
  const log = shown.slice(
    shown.indexOf('A pebble') + 1, // the log follows the last room line
    shown.indexOf('The poison fades from your blood.'),
  );
  assert.deepEqual(log, [
    TICK,
    'You shiver.',
    TICK,
    'The chill passes.',
    ...Array<string>(9).fill(TICK),
  ]);
});

// Breaks: the threshold compares with `>` instead of "at least", so an absence of exactly
// recap_after_minutes (30 real minutes in the sampler) logs instead of collapsing; one second less
// must still log.
test('an absence of exactly the threshold shows the recap; one second less does not', () => {
  assert.equal(count(away(30 * 60 * 1000).text(), LABEL.awayRecap), 1);
  assert.equal(count(away(30 * 60 * 1000 - 1000).text(), LABEL.awayRecap), 0);
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
// logs them out of order or after the press's own line.
test('a press in place during catch-up logs the held lines, in order, before its own', () => {
  const b = poisoned();
  b.clock.wall += HOURS3;
  b.clock.mono += HOURS3;
  assert.equal(pulse(b).kind, 'catching_up');
  b.tap(/pebble/);
  b.tap('Take a pebble');
  const shown = wait(b, 0).text();
  assert.equal(count(shown, LABEL.awayRecap), 0);
  const log = shown.slice(shown.indexOf('You shiver.') - 1);
  assert.deepEqual(log.slice(0, 17), [
    TICK,
    'You shiver.',
    TICK,
    'The chill passes.',
    ...Array<string>(9).fill(TICK),
    'The poison fades from your blood.',
    'Maud leaves.',
    'Maud arrives.',
    'Maud leaves.',
  ]);
  assert.ok(log.lastIndexOf('Maud arrives.') < log.indexOf('You pick up a pebble.'));
});

// Breaks: the player moved without a press keeps the old room's held lines or recap.
test('a room change drops the held lines and the recap; staying keeps them', () => {
  const logs = () =>
    ({
      log: [],
      projection: { view: { place: { id: 'hall' } } },
      away: { from: 0, log: ['a'] },
      recap: ['b'],
    }) as unknown as Logs;
  const view = (id: string) => ({ place: { id } }) as GameView;
  const stay = logs();
  resetLogs(stay, view('hall'));
  assert.deepEqual([stay.away, stay.recap], [{ from: 0, log: ['a'] }, ['b']]);
  const moved = logs();
  resetLogs(moved, view('garden'));
  assert.deepEqual([moved.away, moved.recap], [undefined, undefined]);
});

// Breaks: the Book reports its subscription before it subscribes, so a cold reopen's catch-up (which
// App starts on that report; App itself is not importable here) is not seen from its first step.
test('a cold reopen catches up once the Book has subscribed: the full recap', () => {
  const a = poisoned();
  a.unmount();
  a.clock.wall += HOURS3;
  a.clock.mono += HOURS3;
  const b = book(bundle as never, a as never, undefined, (on) => on && wait(a, 0));
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
    away: { from: 0, log: ['a', 'a'] },
  } as unknown as Logs;
  settle(s);
  assert.deepEqual([s.log, s.recap, s.away], [['a', 'a'], undefined, undefined]);
});

// The sampler with 3 HP, so the third poison tick kills the player in the dart room and they wake
// in the hall, with authored death narration (loka-3w3q, kernel_api 1.117).
function deadly() {
  const dir = mkdtempSync(join(tmpdir(), 'loka-recap-death-'));
  try {
    cpSync(fileURLToPath(new URL('../../../cartridges/recap_sampler', import.meta.url)), dir, {
      recursive: true,
    });
    const edit = (file: string, f: (j: any) => void) => {
      const j = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      f(j);
      writeFileSync(join(dir, file), JSON.stringify(j));
    };
    edit('resources.json', (j) => (j.resources.hp.start = 3));
    edit('text.json', (j) =>
      Object.assign(j, { 'death.fell': 'You fall.', 'death.woke': 'You wake.' }),
    );
    edit('cartridge.json', (j) => {
      j.requires.kernel_api.at_least = '1.117';
      j.world.death.narration = { player_died: 'death.fell', woke: 'death.woke' };
    });
    return compiled(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

// Breaks (book-ui.md, World log; loka-x6t.26): a death in an elapsed settlement leaves the World
// page in the dart room, keeps the old room's lines, drops the death's lines with the room change,
// or holds them (or the rest of the settlement) into a recap.
test('a poison death while away opens the hall page on the tick, fall and waking lines', () => {
  const b = book(deadly() as never, undefined, ids());
  b.map();
  b.tap('Go east');
  const shown = wait(b, HOURS3).text();
  assert.equal(shown[0], 'Stone Hall', JSON.stringify(shown));
  assert.equal(count(shown, LABEL.awayRecap), 0);
  const at = shown.indexOf(TICK);
  assert.deepEqual(
    shown.slice(at, at + 3),
    [TICK, 'You fall.', 'You wake.'],
    JSON.stringify(shown),
  );
  assert.equal(count(shown, TICK), 1); // the two earlier ticks went with the dart room's log
  assert.ok(shown.includes('Maud arrives.'), JSON.stringify(shown)); // the rest logs, not recapped
});
