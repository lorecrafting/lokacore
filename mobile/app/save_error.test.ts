import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from './book/__tests__/polish-book.test.ts';

const { SaveError } = await import('./SaveError.tsx');
const lock = 'Access Handles cannot be created if there is another open Access Handle';
const draw = (
  kind: 'save_corrupt' | 'pinned_release_missing',
  message: string,
  tried: string[],
) => {
  const g = globalThis as any;
  g[Symbol.for('loka-book-test-state')] = (v: unknown) => [v, () => {}];
  g[Symbol.for('loka-book-test-effect')] = () => {};
  return nodes(
    SaveError({
      failed: { kind, message, startOver: kind !== 'save_corrupt' },
      startOver: () => tried.push('start over'),
      tryAgain: () => tried.push('try again'),
    }),
  ).filter((n) => n.type === 'Pressable');
};

// Breaks (loka-x6t.25): the other-tab lock screen is a dead end with no Try again, or Try again is
// offered for a cause a retry cannot clear (a damaged save, a missing release).
test('Try again retries the open on the other-tab lock and nowhere else', () => {
  const tried: string[] = [];
  const locked = draw('save_corrupt', lock, tried);
  assert.deepEqual(
    locked.map((n) => n.props.accessibilityLabel),
    ['Try again'],
  );
  locked[0].props.onPress();
  assert.deepEqual(tried, ['try again']);
  for (const [kind, message, shown] of [
    ['save_corrupt', 'row 4 failed its hash', []],
    ['pinned_release_missing', 'pinned_release_missing', ['Start over']],
  ] as const)
    assert.deepEqual(
      draw(kind, message, tried).map((n) => n.props.accessibilityLabel),
      shown,
      kind,
    );
});
