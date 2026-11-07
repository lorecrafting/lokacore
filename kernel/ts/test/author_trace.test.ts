import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { askTrace } from '../../../tools/author-panel/src/ask_trace.ts';

afterEach(() => mock.timers.reset());

// `p` settled by now, else rejects at once: only setTimeout is mocked, so a pending await would
// hang the suite instead of failing (loka-votey).
const settled = <T>(p: Promise<T>) =>
  Promise.race([p, new Promise<T>((_, no) => setImmediate(() => no(new Error('still pending'))))]);

test('a Book that never answers rejects after the wait, and its late reply is dropped', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = new Map<number, (rows: string[]) => void>();
  const sent: number[] = [];
  const p = askTrace(waiting, (id) => sent.push(id), 7);
  assert.deepEqual(sent, [7]);
  mock.timers.tick(4999);
  assert.equal(waiting.has(7), true);
  mock.timers.tick(1);
  await assert.rejects(settled(p), {
    message: 'The Book did not answer. Reload the Book, then ask again.',
  });
  assert.equal(waiting.get(7), undefined);
});

test('a reply inside the wait resolves with its rows and clears the waiter', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = new Map<number, (rows: string[]) => void>();
  const p = askTrace(waiting, () => {}, 3);
  waiting.get(3)!(['a rule', 'b rule']);
  assert.deepEqual(await settled(p), ['a rule', 'b rule']);
  assert.equal(waiting.size, 0);
  // the cleared timer must not fire later and evict a waiter that now holds the id
  waiting.set(3, () => {});
  mock.timers.tick(10000);
  assert.equal(waiting.has(3), true);
});
