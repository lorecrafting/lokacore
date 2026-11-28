import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from './book/__tests__/polish-book.test.ts';
import type { Failed } from '../packages/game-view/session.ts';

const { SaveError } = await import('./SaveError.tsx');
const draw = (failed: Failed, tried: string[]) => {
  const g = globalThis as any;
  g[Symbol.for('loka-book-test-state')] = (v: unknown) => [v, () => {}];
  g[Symbol.for('loka-book-test-effect')] = () => {};
  return nodes(
    SaveError({
      failed,
      startOver: () => tried.push('start over'),
      tryAgain: () => tried.push('try again'),
    }),
  ).filter((n) => n.type === 'Pressable');
};
const labels = (shown: any[]) => shown.map((n) => n.props.accessibilityLabel);

// Breaks (loka-x6t.25, loka-hcnlh.19.1, .19.2): the other-tab lock (Chrome's or Safari's words) or Safari's worker timeout is a dead end
// with no Try again, or Try again is offered for a cause a retry cannot clear (a damaged save).
test('Try again retries the open on the other-tab lock and a worker timeout, nowhere else', () => {
  const tried: string[] = [];
  // The lock as useWebSession reports it: untyped, no Start over.
  const message = 'Access Handles cannot be created if there is another open Access Handle';
  const locked = draw({ message, startOver: false }, tried);
  assert.deepEqual(labels(locked), ['Try again']);
  locked[0].props.onPress();
  assert.deepEqual(tried, ['try again']);
  // Safari's word for the same lock (WebKit's InvalidStateError on a second sync access handle)
  const safari = draw({ message: 'The object is in an invalid state.', startOver: false }, tried);
  assert.deepEqual(labels(safari), ['Try again']);
  const timedOut = { message: 'Sync operation timeout', startOver: false };
  assert.deepEqual(labels(draw(timedOut, tried)), ['Try again']);
  const corrupt = {
    kind: 'save_corrupt',
    message: 'row 4 failed its hash',
    startOver: true,
  } as const;
  assert.deepEqual(labels(draw(corrupt, tried)), ['Start over']);
});

// Breaks (loka-hcnlh.100.1): a dev cartridge failure shows the damaged-save headline, hides its own
// text behind the generic line, or offers Start over; control: save_corrupt keeps its words.
test('a dev cartridge_error names its cause, says the save is untouched and offers nothing', () => {
  const g = globalThis as any;
  g[Symbol.for('loka-book-test-state')] = (v: unknown) => [v, () => {}];
  g[Symbol.for('loka-book-test-effect')] = () => {};
  const words = (failed: Failed) =>
    nodes(SaveError({ failed, startOver: () => {}, tryAgain: () => {} }))
      .flatMap((n) => [n.props?.children].flat())
      .filter((c) => typeof c === 'string')
      .join('\n');
  const message = 'Error: cartridge did not load: CONTENT_HASH_MISMATCH';
  const shown = words({ kind: 'cartridge_error', message, startOver: false });
  assert.match(shown, /untouched/);
  assert.ok(shown.includes(message), shown);
  assert.doesNotMatch(shown, /damaged/i);
  assert.deepEqual(labels(draw({ kind: 'cartridge_error', message, startOver: false }, [])), []);
  assert.match(words({ kind: 'save_corrupt', message: 'x', startOver: true }), /damaged/i);
});
