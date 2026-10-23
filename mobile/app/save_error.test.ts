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

// Breaks (loka-x6t.25): the other-tab lock screen is a dead end with no Try again, or Try again is
// offered for a cause a retry cannot clear (a damaged save).
test('Try again retries the open on the other-tab lock and nowhere else', () => {
  const tried: string[] = [];
  // The lock as useWebSession reports it: untyped, no Start over.
  const message = 'Access Handles cannot be created if there is another open Access Handle';
  const locked = draw({ message, startOver: false }, tried);
  assert.deepEqual(labels(locked), ['Try again']);
  locked[0].props.onPress();
  assert.deepEqual(tried, ['try again']);
  const corrupt = {
    kind: 'save_corrupt',
    message: 'row 4 failed its hash',
    startOver: true,
  } as const;
  assert.deepEqual(labels(draw(corrupt, tried)), ['Start over']);
});
