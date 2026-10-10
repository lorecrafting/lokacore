// Showcase social step 14 (docs/showcase/hub-and-first-districts.md): the away recap of Tam's day on
// the Low Wardle green, through the real authority and Book. Weather oracle for the release context
// (authority/local-story/session.ts CONTEXT), independent of the kernel: for d in 1..7 the first 4
// bytes of `printf 'weather:<CONTEXT>:<d>' | shasum -a 256`, big-endian, mod 7 (clear 2, frost, rain,
// gale, heat, drought): 5, 1, 0, 5, 4, 3, 6, so day 6 alone is rain.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';

const bundle = compiled('cartridges/toolbox_showcase');
const pulse = (b: Book) => (b.game as unknown as { pulse(): { kind: string } }).pulse();
type Book = ReturnType<typeof book>;
// `ms` of real time passes; pulses until time stops catching up.
function away(ms: number) {
  const b = book(bundle as never);
  b.map();
  b.tap('Go south', 'Talk to the Reeve', 'Take the letter to Wat', 'Leave');
  b.clock.wall += ms;
  b.clock.mono += ms;
  for (let n = 0; pulse(b).kind === 'catching_up'; n++) assert.ok(n < 100, 'never settled');
  return b;
}

// Breaks: the showcase's recap threshold is missing (the lines log one by one), the recap counts
// Tam's moves on the rain day (he goes to the church then) or shows the deadline or Tam's goal.
test('three real hours away (07:00 day 1 to 13:00 day 7): one recap of Tam on the green', () => {
  const b = away(3 * 3600 * 1000);
  b.tap(`${LABEL.awayRecap}, show`);
  const shown = b.text();
  const room = shown.findIndex((l) => l.startsWith('A trodden green'));
  const block = shown.slice(shown.indexOf(LABEL.awayRecap) + 1, room);
  // Arrivals at 11:00 on days 1 to 7 and leavings at 15:00 on days 1 to 6, less rainy day 6.
  assert.deepEqual(block, ['Tam arrives. (6 times)', 'Tam leaves. (5 times)']);
});

// Breaks: the showcase authors a threshold of two real minutes or less, so a short absence collapses.
test('two real minutes away shows no recap', () => {
  assert.ok(
    !away(2 * 60 * 1000)
      .text()
      .includes(LABEL.awayRecap),
  );
});
