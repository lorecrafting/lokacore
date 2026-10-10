// The night sky's shooting-star loop, with the Book harness's native stubs and node's fake timers.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import './__tests__/polish-book.test.ts'; // registers the .tsx loader and the react-native stub

const { meteors } = await import('./NightSky.tsx');
const ended = () => (globalThis as any)[Symbol.for('loka-animation-end')] as () => void;

// Breaks: a shooting star still in flight when the sky goes (dawn's unmount, or a resize's new
// effect) schedules the next one, so an orphan loop runs on, or two run at once.
test('a stopped night sky schedules no shooting star after the one in flight ends', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  mock.method(Math, 'random', () => 0.5); // each wait: 9 s * ln 2
  const shown: unknown[] = [];
  const stop = meteors({ width: 390, height: 844 }, (s) => shown.push(s));
  mock.timers.tick(7000);
  assert.equal(shown.length, 1);
  ended()(); // a star ends while the sky stays: the next one follows
  mock.timers.tick(7000);
  assert.equal(shown.length, 2);
  stop(); // the second is in flight
  ended()();
  mock.timers.tick(60000);
  assert.equal(shown.length, 2);
  mock.reset();
});
