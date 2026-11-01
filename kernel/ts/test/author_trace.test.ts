import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { askTrace } from '../../../tools/author-panel/src/ask_trace.ts';

afterEach(() => mock.timers.reset());

test('a Book that never answers rejects after the wait, and its late reply is dropped', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = new Map<number, (rows: string[]) => void>();
  const sent: number[] = [];
  const p = askTrace(waiting, (id) => sent.push(id), 7);
  assert.deepEqual(sent, [7]);
  mock.timers.tick(4999);
  assert.equal(waiting.has(7), true);
  mock.timers.tick(1);
  await assert.rejects(p, { message: 'The Book did not answer. Reload the Book, then ask again.' });
  assert.equal(waiting.get(7), undefined);
});

test('a reply inside the wait resolves with its rows and clears the waiter', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = new Map<number, (rows: string[]) => void>();
  const p = askTrace(waiting, () => {}, 3);
  waiting.get(3)!(['a rule', 'b rule']);
  assert.deepEqual(await p, ['a rule', 'b rule']);
  assert.equal(waiting.size, 0);
  mock.timers.tick(10000); // the cleared timer must not fire a rejection
});
