// The spirit state's clock (book-ui.md, Spirit state), on controlled times.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dropLines, trimLog, type Logs } from './logs.ts';
import { due, end, fall, haunt, haunting, left, letGo, next, type Spirit } from './spirit.ts';

// Breaks: a lone revival line waits, the countdown rounds down, or the redraw timer sleeps past
// the next line (or the next second, or zero), or keeps ticking at zero.
test('the spirit clock wakes for each line and each second, and stops at zero', () => {
  assert.equal(due(1, 10, 0), 1);
  assert.equal(due(2, 1, 0), 1); // two lines: the second at zero, not at once
  assert.equal(due(3, 1, 1500), 3); // past zero: never more than n
  assert.equal(left(10, 4001), 6);
  const sp = (shown: number): Spirit => ({
    lines: ['a', 'b', 'c'],
    seconds: 1,
    at: 0,
    shown,
    held: [],
  });
  assert.equal(next(sp(1), 200), 300); // line b at 500
  assert.equal(next(sp(1), 500), 0); // line b due now
  const half = (lines: string[], shown: number): Spirit => ({ ...sp(shown), lines, seconds: 0.5 });
  assert.equal(next(half(['a', 'b'], 1), 100), 400); // two lines: b at 500
  assert.equal(next(half(['a', 'b', 'c'], 3), 200), 300); // all shown: zero, before the next second
  assert.equal(next(sp(3), 200), 800); // all shown: the next second
  assert.equal(next(sp(3), 1000), undefined);
});

// Breaks: the held lines are found by a raw log index, so a trim after the death (a full log) or a
// room change's reset in the spirit state shows the return's lines early, or holds old lines.
test('the lines held to the rise survive a trim and a reset', () => {
  const line = (key: string) => ({ kind: 'line', key }) as never;
  const fight = { encounter_id: 'f' } as never;
  const s = {
    log: Array.from({ length: 201 }, (_, i) => line(`old${i}`)),
    projection: { view: { revival: { lines: [], seconds: 1 } } },
    closing: true, // the fight's fall
  } as unknown as Logs;
  trimLog(s.log); // already trimmed before the death
  fall(s, 'death');
  s.log.push(line('woke'), line('hello'));
  trimLog(s.log);
  Object.assign(s, { ended: fight, fell: fight });
  assert.equal(letGo(s, String), true);
  assert.deepEqual(s.spirit!.held, [line('woke'), line('hello')]);
  assert.equal(s.log.length, 198);
  const from = end(s.log);
  dropLines(s.log);
  s.log.push(line('arrived'));
  haunt(s, from, undefined);
  assert.deepEqual(s.log, []);
  assert.deepEqual(s.spirit!.held.at(-1), line('arrived'));
  // A room change after the death drops the receipt itself: all that came after is held.
  fall(s, 'again');
  s.log.push(line('woke'), line('hello'));
  dropLines(s.log);
  s.log.push(line('a'), line('b'), line('c'));
  Object.assign(s, { ended: fight, fell: fight });
  letGo(s, String);
  assert.deepEqual(s.spirit!.held, [line('a'), line('b'), line('c')]);
});

// Break: the ring drawn from the whole seconds left, so a 2.5 s wait starts past full and drains in steps.
test("the rise card's ring drains by the time elapsed over the total", () => {
  const spirit = { lines: [], seconds: 2.5, at: 0, shown: 0, held: [] };
  const s = { log: [], spirit } as unknown as Logs;
  assert.deepEqual(
    [0, 1000].map((now) => haunting(s, now)!.fraction),
    [1, 0.6],
  );
});

// Breaks (book-ui.md, A second death): a second fall retitles the dead page, moves where its lines
// end or where the return's lines start, or keeps the first death's id, so its cue never plays.
test('a second fall keeps the dead page and its marks, and moves the cue edge', () => {
  const room = { title: 'room.cellar', log: [] };
  const s = { log: [], room, projection: { view: { place: { title: { key: 'shrine' } } } } };
  const logs = s as unknown as Logs;
  fall(logs, 'first');
  logs.down!.to = 3;
  logs.woke = 1;
  logs.room = { title: 'shrine', log: [] };
  fall(logs, 'second');
  assert.deepEqual([logs.died, logs.down, logs.woke], ['second', { ...room, to: 3 }, 1]);
});
